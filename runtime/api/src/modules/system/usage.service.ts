import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { effectiveEntitlements } from '../billing/effective-limits';
import { buildAiMediaMetadata } from '../../common/ai-content-label';
import { PrismaService } from '../../database/prisma.service';
import { chinaMonthPeriod } from '../../common/china-period';

/** 慢于文生图轮询上限（默认 60 次，每次请求最多 30 秒），避免还在生成时被对账任务退回。 */
const AI_RESERVATION_TTL_MS = 45 * 60 * 1000;

/**
 * 本月 AI 令牌额度（唯一算法）。
 *
 * AI 接口的额度闸（UsageService.checkQuota(TOKENS)）和界面上显示的「本月 AI 额度」
 * （GET /billing/subscription）都走这里，保证「界面显示还剩多少」和「接口会不会拦」是同一个数。
 * 原来两处各写一套兜底（一处缺省按 0、一处缺省按免费档），创作工作室还另外显示一套
 * 与额度无关的「签到积分」余额和写死的「单次消耗 5 积分」。
 * limit = -1 表示不限量。
 * 已入账和仍占着的预扣加在一起，避免界面把正在生成的额度显示成还能用。
 */
export const AI_CALL_TOKEN_EQUIVALENT = 2500;

export const AI_MONTHLY_QUOTA_MESSAGE = '本月 AI 额度已用完，可升级套餐，或在下月 1 日额度恢复后再试';

export class AiQuotaExceededError extends Error {
  constructor(holdTokens?: number) {
    super(holdTokens
      ? `本月 AI 剩余额度不足，本次生成需要 ${holdTokens} 令牌，可升级套餐，或在下月 1 日额度恢复后再试`
      : AI_MONTHLY_QUOTA_MESSAGE);
    this.name = 'AiQuotaExceededError';
  }
}

export class AiRequestInProgressError extends Error {
  constructor() {
    super('同一请求正在处理，请稍后用同一个 Idempotency-Key 重试');
    this.name = 'AiRequestInProgressError';
  }
}

const IDEMPOTENCY_KEY = /^[A-Za-z0-9_.:-]{8,128}$/;

export function normalizeIdempotencyKey(raw: unknown): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value == null || String(value).trim() === '') return randomUUID();
  const key = String(value).trim();
  if (!IDEMPOTENCY_KEY.test(key)) {
    throw new BadRequestException('Idempotency-Key 需为 8 到 128 位字母、数字、点、下划线、冒号或短横线');
  }
  return key;
}

export interface AiTokenAllowance {
  limit: number;
  used: number;
  reserved: number;
  remaining: number;
  unlimited: boolean;
}

export function aiTokenAllowance(
  limits: Record<string, number>,
  meter: { ai_tokens?: number | null; ai_tokens_reserved?: number | null } | null | undefined,
): AiTokenAllowance {
  const raw = limits.max_ai_tokens_monthly ?? ((limits.max_ai_calls_monthly ?? 0) * AI_CALL_TOKEN_EQUIVALENT);
  const limit = Number.isFinite(Number(raw)) ? Number(raw) : 0;
  const committed = Math.max(0, Number(meter?.ai_tokens ?? 0) || 0);
  const reserved = Math.max(0, Number(meter?.ai_tokens_reserved ?? 0) || 0);
  const used = committed + reserved;
  const unlimited = limit === -1;
  return { limit, used, reserved, remaining: unlimited ? -1 : Math.max(0, limit - used), unlimited };
}

export interface AiGenerationDraft {
  userId: string;
  generationType: string;
  inputParams: unknown;
  outputContent?: string;
  modelProvider?: string;
  modelName?: string;
  tokensInput?: number;
  tokensOutput?: number;
  costAmount?: number;
  durationMs?: number;
  status: string;
}

export interface AiSettlement {
  tokens: number;
  images: number;
  type: string;
  generation: AiGenerationDraft | null;
  response: unknown;
  attachContentId: 'text' | 'image' | null;
}

export interface ReservationProduct<T> {
  tokens: number;
  images?: number;
  generation?: AiGenerationDraft | null;
  response: T;
  attachContentId?: 'text' | 'image' | null;
}

export type AiReserveOutcome =
  | { action: 'reserved'; reservationId: string }
  | { action: 'resume'; reservationId: string }
  | { action: 'in_progress'; reservationId: string }
  | { action: 'replay'; reservationId: string; response: unknown };

export function finalizeReservedResponse(settlement: { response: unknown; attachContentId?: 'text' | 'image' | null; generation?: object | null }, generationId?: string | null): unknown {
  const response = settlement.response;
  if (!settlement.attachContentId || !response || typeof response !== 'object') return response;
  const named = settlement.generation as { modelName?: string } | null | undefined;
  const modelName = typeof named?.modelName === 'string' ? named.modelName : undefined;
  const meta = buildAiMediaMetadata({
    mediaType: settlement.attachContentId,
    model: modelName,
    contentId: generationId,
  });
  if (settlement.attachContentId === 'image') return { ...(response as object), aiMetadata: meta };
  const body = response as { data?: { metadata?: Record<string, unknown> } };
  if (!body.data?.metadata) return response;
  return { ...body, data: { ...body.data, metadata: { ...body.data.metadata, ai_content: meta } } };
}

export enum ResourceType {
  TOKENS = 'ai_tokens',
  IMAGES = 'image_count',
  VIDEOS = 'video_count',
  PUBLISHES = 'publish_count',
  STORAGE = 'storage_mb',
}

type ReservationRow = {
  id: string;
  tenant_id: string;
  period: string;
  hold_tokens: number;
  committed_tokens: number;
  status: string;
  kind: string;
  idempotency_key: string;
  generation_id: string | null;
  settlement: AiSettlement | null;
};

@Injectable()
export class UsageService {
  private readonly logger = new Logger(UsageService.name);

  constructor(private readonly prisma: PrismaService) { }

  async trackUsage(tenantId: string, resource: ResourceType, amount: number, metadata?: any) {
    return this.trackUsageBatch(tenantId, { [resource]: amount }, metadata);
  }

  async trackUsageBatch(tenantId: string, amounts: Partial<Record<ResourceType, number>>, metadata?: { refId?: string; type?: string }) {
    const period = chinaMonthPeriod();
    const create: Partial<Record<ResourceType, number>> = {};
    const update: Partial<Record<ResourceType, { increment: number }>> = {};
    for (const [key, amount] of Object.entries(amounts)) {
      if (!Object.values(ResourceType).includes(key as ResourceType) ||
        !Number.isSafeInteger(amount) || amount < 0 || amount > 2147483647) {
        throw new RangeError('用量必须是有效资源的非负整数且不超过数据库计数范围');
      }
      if (amount === 0) continue;
      create[key as ResourceType] = amount;
      update[key as ResourceType] = { increment: amount };
    }
    if (Object.keys(create).length === 0) return;

    // 月用量和明细必须同时成功，避免账单写入失败后仍扣额度。
    await this.prisma.$transaction(async (tx) => {
      await tx.usageMeter.upsert({
        where: { tenant_id_period: { tenant_id: tenantId, period } },
        create: { tenant_id: tenantId, period, ...create },
        update,
      });
      if (create[ResourceType.TOKENS]) {
        await tx.costLedger.create({
          data: {
            tenant_id: tenantId,
            source: 'ai',
            tokens_used: create[ResourceType.TOKENS],
            // 金额以生成记录的模型价格为准，不使用无出处的美元估价。
            cost_est_usd: 0,
            ref_id: metadata?.refId,
          },
        });
      }
    });
  }

  async checkQuota(tenantId: string, resource: ResourceType, requiredTokens = 1): Promise<boolean> {
    if (!Number.isSafeInteger(requiredTokens) || requiredTokens <= 0) throw new RangeError('所需额度必须为正整数');
    const period = chinaMonthPeriod();
    const meter = await this.getMeter(tenantId, period);
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });

    if (!tenant) return false;

    const limits: Record<string, number> = effectiveEntitlements(tenant).limits;
    if (resource === ResourceType.TOKENS) {
      const allowance = aiTokenAllowance(limits, meter as any);
      return allowance.unlimited || allowance.remaining >= requiredTokens;
    }
    const limit = resource === ResourceType.STORAGE
      ? (limits.max_storage_gb ?? 0)
      : resource === ResourceType.PUBLISHES
        ? (limits.max_publishes_monthly ?? 0)
        : resource === ResourceType.IMAGES
          ? (limits.max_images_monthly ?? 0)
          : (limits.max_videos_monthly ?? 0);
    const current = (meter as any)?.[resource] || 0;

    // 如果限制是 GB，需要转换
    const adjustedCurrent = resource === ResourceType.STORAGE ? current / 1024 : current;

    return limit === -1 || adjustedCurrent < limit;
  }

  /**
   * 调用模型前占住令牌。条件更新在数据库里完成，多个实例同时扣同一行时只有还能放下的请求成功。
   * 同一个幂等键不会占第二次：已入账则重放结果，已有结算数据则接着入账，还在生成则拒绝重入。
   */
  async reserveAiTokens(input: { tenantId: string; holdTokens: number; kind: string; idempotencyKey: string; ttlMs?: number }): Promise<AiReserveOutcome> {
    this.assertHold(input.holdTokens);
    const idempotencyKey = normalizeIdempotencyKey(input.idempotencyKey);
    const period = chinaMonthPeriod();
    const tenant = await this.prisma.tenant.findUnique({ where: { id: input.tenantId } });
    if (!tenant) throw new AiQuotaExceededError();
    const allowance = aiTokenAllowance(effectiveEntitlements(tenant).limits, null);
    const expiresAt = new Date(Date.now() + (input.ttlMs ?? AI_RESERVATION_TTL_MS));
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.aiQuotaReservation.findUnique({
          where: { tenant_id_idempotency_key: { tenant_id: input.tenantId, idempotency_key: idempotencyKey } },
        });
        if (existing) return this.reuseReservation(tx, existing as ReservationRow, input, allowance, period, expiresAt);
        await tx.$executeRawUnsafe(
          `INSERT INTO usage_meters (id, tenant_id, period, ai_tokens, ai_tokens_reserved, image_count, video_count, publish_count, storage_mb, created_at, updated_at)
           VALUES ($1, $2, $3, 0, 0, 0, 0, 0, 0, NOW(), NOW())
           ON CONFLICT (tenant_id, period) DO NOTHING`,
          randomUUID(),
          input.tenantId,
          period,
        );
        const held = await this.incrementReserved(tx, input.holdTokens, input.tenantId, period, allowance);
        if (!held) throw new AiQuotaExceededError(input.kind === 'image' ? input.holdTokens : undefined);
        const created = await tx.aiQuotaReservation.create({
          data: {
            tenant_id: input.tenantId,
            period,
            hold_tokens: input.holdTokens,
            status: 'held',
            kind: input.kind,
            idempotency_key: idempotencyKey,
            expires_at: expiresAt,
          },
        });
        return { action: 'reserved' as const, reservationId: created.id };
      });
    } catch (error) {
      if ((error as { code?: string })?.code !== 'P2002') throw error;
      const existing = await this.prisma.aiQuotaReservation.findUnique({
        where: { tenant_id_idempotency_key: { tenant_id: input.tenantId, idempotency_key: idempotencyKey } },
      });
      if (!existing) throw error;
      if (existing.status === 'committed') return { action: 'replay', reservationId: existing.id, response: (existing.settlement as AiSettlement | null)?.response };
      if (existing.settlement) return { action: 'resume', reservationId: existing.id };
      if (existing.status === 'held') return { action: 'in_progress', reservationId: existing.id };
      throw error;
    }
  }

  async withAiHold<T>(
    input: { tenantId: string; holdTokens: number; kind: string; idempotencyKey: string },
    run: () => Promise<ReservationProduct<T>>,
  ): Promise<T> {
    const begun = await this.reserveAiTokens(input);
    if (begun.action === 'replay') return begun.response as T;
    if (begun.action === 'in_progress') throw new AiRequestInProgressError();
    if (begun.action === 'resume') return (await this.commitAiReservation(begun.reservationId)).response as T;
    let produced: ReservationProduct<T>;
    try {
      produced = await run();
    } catch (error) {
      await this.releaseAiReservation(begun.reservationId).catch((releaseError) => {
        this.logger.error(`退回 AI 额度预占失败 ${begun.reservationId}：${releaseError instanceof Error ? releaseError.message : releaseError}`);
      });
      throw error;
    }
    const tokens = Number(produced.tokens);
    const images = Number(produced.images ?? 0);
    if (!Number.isSafeInteger(tokens) || tokens < 0 || tokens > 2147483647 || !Number.isSafeInteger(images) || images < 0) {
      await this.releaseAiReservation(begun.reservationId).catch(() => undefined);
      throw new RangeError('AI token 用量无效');
    }
    const settlement: AiSettlement = {
      tokens,
      images,
      type: input.kind,
      generation: produced.generation ?? null,
      response: produced.response,
      attachContentId: produced.attachContentId ?? null,
    };
    await this.saveAiSettlementWithRetry(begun.reservationId, settlement);
    try {
      return (await this.commitAiReservation(begun.reservationId)).response as T;
    } catch (error) {
      this.logger.error(`模型已成功但 AI 额度入账失败 ${begun.reservationId}，留给对账任务重试：${error instanceof Error ? error.message : error}`);
      throw error;
    }
  }

  async saveAiSettlement(id: string, settlement: AiSettlement): Promise<void> {
    const result = await this.prisma.aiQuotaReservation.updateMany({
      where: { id, status: 'held' },
      data: { settlement: settlement as unknown as Prisma.InputJsonValue },
    });
    if (result.count === 1) return;
    const row = await this.prisma.aiQuotaReservation.findUnique({ where: { id } });
    if (row?.status === 'committed' || row?.settlement) return;
    throw new Error('无法保存 AI 额度结算');
  }

  async commitAiReservation(id: string): Promise<{ generationId: string | null; response: unknown; chargedTokens: number }> {
    return this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRawUnsafe<ReservationRow[]>(
        `SELECT id, tenant_id, period, hold_tokens, committed_tokens, status, kind, idempotency_key, generation_id, settlement
         FROM ai_quota_reservations WHERE id = $1 FOR UPDATE`,
        id,
      );
      const row = locked[0];
      if (!row) throw new Error('AI 额度预占不存在');
      const settlement = row.settlement as AiSettlement | null;
      if (row.status === 'committed') {
        return { generationId: row.generation_id, response: settlement?.response, chargedTokens: row.committed_tokens };
      }
      if (row.status !== 'held' || !settlement) throw new Error('AI 额度预占还不能入账');
      const meters = await tx.$queryRawUnsafe<Array<{ ai_tokens: number; ai_tokens_reserved: number }>>(
        `SELECT ai_tokens, ai_tokens_reserved FROM usage_meters WHERE tenant_id = $1 AND period = $2 FOR UPDATE`,
        row.tenant_id,
        row.period,
      );
      const meter = meters[0] ?? { ai_tokens: 0, ai_tokens_reserved: 0 };
      const tenant = await tx.tenant.findUnique({ where: { id: row.tenant_id } });
      const allowance = aiTokenAllowance(effectiveEntitlements(tenant ?? { plan: 'free' }).limits, null);
      const charge = this.billableTokens(settlement.tokens, row.hold_tokens, meter, allowance, id);
      const images = Math.max(0, Math.round(Number(settlement.images) || 0));
      await tx.$executeRawUnsafe(
        `UPDATE usage_meters
         SET ai_tokens_reserved = GREATEST(0, ai_tokens_reserved - $1),
             ai_tokens = ai_tokens + $2,
             image_count = image_count + $3,
             updated_at = NOW()
         WHERE tenant_id = $4 AND period = $5`,
        row.hold_tokens,
        charge,
        images,
        row.tenant_id,
        row.period,
      );
      if (charge > 0) {
        const existingLedger = await tx.costLedger.findFirst({ where: { tenant_id: row.tenant_id, ref_id: row.id } });
        if (!existingLedger) {
          await tx.costLedger.create({
            data: { tenant_id: row.tenant_id, source: 'ai', tokens_used: charge, cost_est_usd: 0, ref_id: row.id },
          });
        }
      }
      let generationId = row.generation_id;
      if (!generationId && settlement.generation?.userId) {
        const draft = settlement.generation;
        const created = await tx.aIGeneration.create({
          data: {
            tenant_id: row.tenant_id,
            user_id: draft.userId,
            generation_type: draft.generationType,
            input_params: (draft.inputParams ?? {}) as Prisma.InputJsonValue,
            model_provider: draft.modelProvider,
            model_name: draft.modelName,
            output_content: draft.outputContent,
            tokens_input: draft.tokensInput,
            tokens_output: draft.tokensOutput,
            cost_amount: draft.costAmount,
            duration_ms: draft.durationMs,
            status: draft.status,
            completed_at: draft.status === 'success' ? new Date() : undefined,
          },
        });
        generationId = created.id;
      }
      const response = finalizeReservedResponse(settlement, generationId);
      await tx.aiQuotaReservation.update({
        where: { id: row.id },
        data: {
          status: 'committed',
          committed_tokens: charge,
          generation_id: generationId,
          settlement: { ...settlement, response } as unknown as Prisma.InputJsonValue,
        },
      });
      return { generationId, response, chargedTokens: charge };
    });
  }

  /** 模型失败或结果无效时退回预占。已经写下结算数据的不退，交给入账。重复退回无副作用。 */
  async releaseAiReservation(id: string): Promise<{ released: boolean }> {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRawUnsafe<Array<{ hold_tokens: number; tenant_id: string; period: string }>>(
        `UPDATE ai_quota_reservations
         SET status = 'released', updated_at = NOW()
         WHERE id = $1 AND status = 'held' AND settlement IS NULL
         RETURNING hold_tokens, tenant_id, period`,
        id,
      );
      const row = rows[0];
      if (!row) return { released: false };
      await tx.$executeRawUnsafe(
        `UPDATE usage_meters
         SET ai_tokens_reserved = GREATEST(0, ai_tokens_reserved - $1), updated_at = NOW()
         WHERE tenant_id = $2 AND period = $3`,
        row.hold_tokens,
        row.tenant_id,
        row.period,
      );
      return { released: true };
    });
  }

  /** 入账「模型已成功但写入失败」的预占，并退回过期且没有结果的预占。不重新调用模型。 */
  async reconcileAiReservations(now = new Date(), limit = 50): Promise<{ committed: number; released: number; failed: number }> {
    const ready = await this.prisma.aiQuotaReservation.findMany({
      where: { status: 'held', settlement: { not: Prisma.DbNull } },
      take: limit,
      orderBy: { created_at: 'asc' },
    });
    let committed = 0;
    let failed = 0;
    for (const row of ready) {
      try {
        await this.commitAiReservation(row.id);
        committed += 1;
      } catch (error) {
        failed += 1;
        this.logger.error(`补偿入账失败 ${row.id}：${error instanceof Error ? error.message : error}`);
      }
    }
    const stale = await this.prisma.aiQuotaReservation.findMany({
      where: { status: 'held', settlement: { equals: Prisma.DbNull }, expires_at: { lt: now } },
      take: limit,
      orderBy: { expires_at: 'asc' },
    });
    let released = 0;
    for (const row of stale) {
      try {
        const result = await this.releaseAiReservation(row.id);
        if (result.released) released += 1;
      } catch (error) {
        failed += 1;
        this.logger.error(`退回过期 AI 预占失败 ${row.id}：${error instanceof Error ? error.message : error}`);
      }
    }
    return { committed, released, failed };
  }

  private async getMeter(tenantId: string, period: string) {
    // 额度查询只读；无月表即零用量，避免并发首次查询争抢创建记录。
    return this.prisma.usageMeter.findFirst({
      where: { tenant_id: tenantId, period },
    });
  }

  private assertHold(holdTokens: number) {
    if (!Number.isSafeInteger(holdTokens) || holdTokens <= 0 || holdTokens > 2147483647) {
      throw new RangeError('预占额度必须是正整数且不超过数据库计数范围');
    }
  }

  private async incrementReserved(tx: Prisma.TransactionClient, hold: number, tenantId: string, period: string, allowance: AiTokenAllowance): Promise<boolean> {
    const rows = await tx.$queryRawUnsafe<Array<{ id: string }>>(
      `UPDATE usage_meters
       SET ai_tokens_reserved = ai_tokens_reserved + $1, updated_at = NOW()
       WHERE tenant_id = $2 AND period = $3
         AND ($4::boolean OR ai_tokens + ai_tokens_reserved + $1 <= $5)
       RETURNING id`,
      hold,
      tenantId,
      period,
      allowance.unlimited,
      allowance.limit,
    );
    return rows.length > 0;
  }

  private async reuseReservation(
    tx: Prisma.TransactionClient,
    existing: ReservationRow,
    input: { tenantId: string; holdTokens: number; kind: string },
    allowance: AiTokenAllowance,
    period: string,
    expiresAt: Date,
  ): Promise<AiReserveOutcome> {
    if (existing.status === 'committed') {
      return { action: 'replay', reservationId: existing.id, response: (existing.settlement as AiSettlement | null)?.response };
    }
    if (existing.status === 'held' && existing.settlement) return { action: 'resume', reservationId: existing.id };
    if (existing.status === 'held') return { action: 'in_progress', reservationId: existing.id };
    if (existing.status !== 'released') throw new Error('AI 额度预占状态无效');
    await tx.$executeRawUnsafe(
      `INSERT INTO usage_meters (id, tenant_id, period, ai_tokens, ai_tokens_reserved, image_count, video_count, publish_count, storage_mb, created_at, updated_at)
       VALUES ($1, $2, $3, 0, 0, 0, 0, 0, 0, NOW(), NOW())
       ON CONFLICT (tenant_id, period) DO NOTHING`,
      randomUUID(),
      input.tenantId,
      period,
    );
    const held = await this.incrementReserved(tx, input.holdTokens, input.tenantId, period, allowance);
    if (!held) throw new AiQuotaExceededError(input.kind === 'image' ? input.holdTokens : undefined);
    await tx.aiQuotaReservation.update({
      where: { id: existing.id },
      data: {
        status: 'held',
        period,
        hold_tokens: input.holdTokens,
        committed_tokens: 0,
        kind: input.kind,
        generation_id: null,
        settlement: Prisma.DbNull,
        expires_at: expiresAt,
      },
    });
    return { action: 'reserved', reservationId: existing.id };
  }

  private async saveAiSettlementWithRetry(id: string, settlement: AiSettlement): Promise<void> {
    let last: unknown;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        await this.saveAiSettlement(id, settlement);
        return;
      } catch (error) {
        last = error;
      }
    }
    this.logger.error(`模型已成功但结算数据没写上 ${id}：${last instanceof Error ? last.message : last}`);
    throw last;
  }

  private billableTokens(
    actual: number,
    hold: number,
    meter: { ai_tokens: number; ai_tokens_reserved: number },
    allowance: AiTokenAllowance,
    reservationId: string,
  ): number {
    const normalized = Number.isSafeInteger(actual) && actual > 0 ? actual : 0;
    if (normalized <= hold) return normalized;
    const reservedOther = Math.max(0, Number(meter.ai_tokens_reserved) - hold);
    const fits = allowance.unlimited || Number(meter.ai_tokens) + reservedOther + normalized <= allowance.limit;
    if (fits && normalized <= 2147483647) return normalized;
    this.logger.warn(`预占 ${reservationId} 实际消耗 ${normalized} 超过占位 ${hold}，且剩余额度放不下，只入账占位`);
    return hold;
  }
}
