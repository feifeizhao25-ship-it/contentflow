import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { AiQuotaExceededError, AiRequestInProgressError, ResourceType, UsageService } from './usage.service';

/**
 * 用内存里的条件更新模拟多实例抢同一行月表。
 * 事务串行并且失败回滚，用来核对「占不住就失败、入账失败可以重放、过期未完成会退回」。
 */
function createQuotaDb(limit: number) {
  const meters = new Map<string, { ai_tokens: number; ai_tokens_reserved: number; image_count: number }>();
  const reservations: any[] = [];
  const ledgers: any[] = [];
  const generations: any[] = [];
  const sqlLog: string[] = [];
  let generationFailures = 0;
  let chain: Promise<void> = Promise.resolve();

  const snapshot = () => ({
    meters: new Map([...meters].map(([key, value]) => [key, { ...value }])),
    reservations: reservations.map((row) => ({ ...row })),
    ledgers: ledgers.map((row) => ({ ...row })),
    generations: generations.map((row) => ({ ...row })),
  });
  const restore = (saved: ReturnType<typeof snapshot>) => {
    meters.clear();
    for (const [key, value] of saved.meters) meters.set(key, value);
    reservations.splice(0, reservations.length, ...saved.reservations);
    ledgers.splice(0, ledgers.length, ...saved.ledgers);
    generations.splice(0, generations.length, ...saved.generations);
  };
  const meterKey = (tenantId: string, period: string) => `${tenantId}|${period}`;
  const apply = (sql: string, params: any[]) => {
    if (sql.includes('INSERT INTO usage_meters')) {
      const key = meterKey(params[1], params[2]);
      if (!meters.has(key)) meters.set(key, { ai_tokens: 0, ai_tokens_reserved: 0, image_count: 0 });
      return [];
    }
    if (sql.includes('ai_tokens = ai_tokens +')) {
      const meter = meters.get(meterKey(params[3], params[4]));
      if (!meter) return [];
      meter.ai_tokens_reserved = Math.max(0, meter.ai_tokens_reserved - Number(params[0]));
      meter.ai_tokens += Number(params[1]);
      meter.image_count += Number(params[2]);
      return [];
    }
    if (sql.includes('ai_tokens_reserved = ai_tokens_reserved +')) {
      const meter = meters.get(meterKey(params[1], params[2]));
      const unlimited = params[3] === true;
      if (!meter || (!unlimited && meter.ai_tokens + meter.ai_tokens_reserved + Number(params[0]) > Number(params[4]))) return [];
      meter.ai_tokens_reserved += Number(params[0]);
      return [{ id: 'meter' }];
    }
    if (sql.includes("status = 'released'")) {
      const row = reservations.find((item) => item.id === params[0] && item.status === 'held' && item.settlement == null);
      if (!row) return [];
      row.status = 'released';
      return [{ hold_tokens: row.hold_tokens, tenant_id: row.tenant_id, period: row.period }];
    }
    if (sql.includes('ai_tokens_reserved = GREATEST(0, ai_tokens_reserved -')) {
      const meter = meters.get(meterKey(params[1], params[2]));
      if (!meter) return [];
      meter.ai_tokens_reserved = Math.max(0, meter.ai_tokens_reserved - Number(params[0]));
      return [];
    }
    if (sql.includes('FROM ai_quota_reservations') && sql.includes('FOR UPDATE')) {
      return reservations.filter((item) => item.id === params[0]);
    }
    if (sql.includes('FROM usage_meters') && sql.includes('FOR UPDATE')) {
      const meter = meters.get(meterKey(params[0], params[1]));
      return meter ? [meter] : [];
    }
    throw new Error(`unexpected sql: ${sql}`);
  };

  const api: any = {
    tenant: { findUnique: async () => ({ id: 't', plan: 'pro', plan_expires_at: null, limits: { max_ai_tokens_monthly: limit } }) },
    usageMeter: {
      findFirst: async ({ where }: any) => {
        const meter = meters.get(meterKey(where.tenant_id, where.period));
        return meter ? { ...meter } : null;
      },
    },
    aiQuotaReservation: {
      findUnique: async ({ where }: any) => {
        if (where.tenant_id_idempotency_key) {
          const key = where.tenant_id_idempotency_key;
          return reservations.find((item) => item.tenant_id === key.tenant_id && item.idempotency_key === key.idempotency_key) ?? null;
        }
        return reservations.find((item) => item.id === where.id) ?? null;
      },
      findMany: async ({ where, take }: any) => {
        const rows = reservations.filter((row) => {
          if (where?.status && row.status !== where.status) return false;
          if (where?.expires_at?.lt && !(row.expires_at < where.expires_at.lt)) return false;
          if (where?.settlement?.equals === Prisma.DbNull && row.settlement != null) return false;
          if (where?.settlement?.not === Prisma.DbNull && row.settlement == null) return false;
          return true;
        });
        return take ? rows.slice(0, take) : rows;
      },
      create: async ({ data }: any) => {
        if (reservations.some((item) => item.tenant_id === data.tenant_id && item.idempotency_key === data.idempotency_key)) {
          const error: any = new Error('unique');
          error.code = 'P2002';
          throw error;
        }
        const row = { id: randomUUID(), committed_tokens: 0, generation_id: null, settlement: null, created_at: new Date(), ...data };
        reservations.push(row);
        return row;
      },
      update: async ({ where, data }: any) => {
        const row = reservations.find((item) => item.id === where.id);
        const next = { ...data };
        if (next.settlement === Prisma.DbNull) next.settlement = null;
        Object.assign(row, next);
        return row;
      },
      updateMany: async ({ where, data }: any) => {
        const row = reservations.find((item) => item.id === where.id && (!where.status || item.status === where.status));
        if (!row) return { count: 0 };
        Object.assign(row, data);
        return { count: 1 };
      },
    },
    costLedger: {
      findFirst: async ({ where }: any) => ledgers.find((item) => item.tenant_id === where.tenant_id && item.ref_id === where.ref_id) ?? null,
      create: async ({ data }: any) => {
        const row = { id: randomUUID(), ...data };
        ledgers.push(row);
        return row;
      },
    },
    aIGeneration: {
      create: async ({ data }: any) => {
        if (generationFailures > 0) {
          generationFailures -= 1;
          throw new Error('generation write failed');
        }
        const row = { id: randomUUID(), ...data };
        generations.push(row);
        return row;
      },
    },
    $executeRawUnsafe: async (sql: string, ...params: any[]) => {
      sqlLog.push(sql);
      apply(sql, params);
      return 1;
    },
    $queryRawUnsafe: async (sql: string, ...params: any[]) => {
      sqlLog.push(sql);
      return apply(sql, params);
    },
    $transaction: (fn: (tx: any) => Promise<any>) => {
      const run = chain.then(async () => {
        const saved = snapshot();
        try {
          return await fn(api);
        } catch (error) {
          restore(saved);
          throw error;
        }
      });
      chain = run.then(() => undefined, () => undefined);
      return run;
    },
  };

  return {
    api,
    sqlLog,
    ledgers,
    generations,
    reservations,
    meter: () => [...meters.values()][0],
    failNextGeneration() { generationFailures += 1; },
  };
}

describe('AI 额度数据库预占', () => {
  const product = {
    tokens: 100,
    images: 1,
    attachContentId: 'text' as const,
    response: { success: true, data: { metadata: { usage: { tokens: 100 } } } },
    generation: {
      userId: 'u',
      generationType: 'article',
      inputParams: { topic: '主题' },
      outputContent: '正文',
      modelProvider: 'dashscope',
      modelName: 'qwen-plus',
      tokensInput: 40,
      tokensOutput: 60,
      costAmount: 0.01,
      status: 'success',
    },
  };

  it('两个实例同时占，只有放得下的那次成功，条件写在更新语句里', async () => {
    const db = createQuotaDb(10000);
    const service = new UsageService(db.api);
    const results = await Promise.allSettled([
      service.reserveAiTokens({ tenantId: 't', holdTokens: 6000, kind: 'article', idempotencyKey: 'hold-a-0001' }),
      service.reserveAiTokens({ tenantId: 't', holdTokens: 6000, kind: 'article', idempotencyKey: 'hold-b-0002' }),
    ]);
    expect(results.filter((item) => item.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((item) => item.status === 'rejected') as PromiseRejectedResult;
    expect(rejected.reason).toBeInstanceOf(AiQuotaExceededError);
    expect(db.meter()).toMatchObject({ ai_tokens: 0, ai_tokens_reserved: 6000 });
    expect(db.sqlLog.some((sql) => sql.includes('ai_tokens + ai_tokens_reserved + $1 <= $5'))).toBe(true);
    expect(db.sqlLog.some((sql) => sql.includes('FOR UPDATE'))).toBe(false);
    await expect(service.checkQuota('t', ResourceType.TOKENS, 4001)).resolves.toBe(false);
    await expect(service.checkQuota('t', ResourceType.TOKENS, 4000)).resolves.toBe(true);
  });

  it('同一个幂等键在生成过程中重入不会再次占额度，也不会再次调用模型', async () => {
    const db = createQuotaDb(10000);
    const service = new UsageService(db.api);
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    let started: () => void = () => undefined;
    const startedGate = new Promise<void>((resolve) => { started = resolve; });
    const input = { tenantId: 't', holdTokens: 1000, kind: 'article', idempotencyKey: 'same-key-01' };
    const first = service.withAiHold(input, async () => {
      started();
      await gate;
      return product;
    });
    await startedGate;
    await expect(service.withAiHold(input, async () => { throw new Error('second model'); })).rejects.toBeInstanceOf(AiRequestInProgressError);
    expect(db.meter().ai_tokens_reserved).toBe(1000);
    release();
    await first;
    expect(db.meter()).toMatchObject({ ai_tokens: 100, ai_tokens_reserved: 0, image_count: 1 });
    expect(db.generations).toHaveLength(1);
    expect(db.ledgers).toEqual([expect.objectContaining({ tokens_used: 100, ref_id: db.reservations[0].id })]);
    let reran = false;
    const replay = await service.withAiHold(input, async () => { reran = true; return product; });
    expect(reran).toBe(false);
    expect(replay).toMatchObject({ success: true, data: { metadata: { ai_content: expect.objectContaining({ content_id: db.generations[0].id }) } } });
    expect(db.generations).toHaveLength(1);
    expect(db.meter().ai_tokens).toBe(100);
  });

  it('模型失败会退回预占，同一个幂等键可以重新占', async () => {
    const db = createQuotaDb(10000);
    const service = new UsageService(db.api);
    const input = { tenantId: 't', holdTokens: 1000, kind: 'script', idempotencyKey: 'retry-key-1' };
    await expect(service.withAiHold(input, async () => { throw new Error('model down'); })).rejects.toThrow('model down');
    expect(db.reservations[0].status).toBe('released');
    expect(db.meter()).toMatchObject({ ai_tokens: 0, ai_tokens_reserved: 0 });
    expect(db.generations).toHaveLength(0);
    const again = await service.reserveAiTokens(input);
    expect(again.action).toBe('reserved');
    expect(db.meter().ai_tokens_reserved).toBe(1000);
  });

  it('模型已成功但生成记录写入失败时，对账任务补记且只记一次', async () => {
    const db = createQuotaDb(10000);
    const service = new UsageService(db.api);
    const input = { tenantId: 't', holdTokens: 8000, kind: 'article', idempotencyKey: 'settle-key-1' };
    db.failNextGeneration();
    await expect(service.withAiHold(input, async () => ({ ...product, tokens: 9000 }))).rejects.toThrow('generation write failed');
    expect(db.meter()).toMatchObject({ ai_tokens: 0, ai_tokens_reserved: 8000 });
    expect(db.reservations[0].status).toBe('held');
    expect(db.reservations[0].settlement.tokens).toBe(9000);
    expect(db.generations).toHaveLength(0);
    db.reservations[0].expires_at = new Date(Date.now() - 1000);
    const first = await service.reconcileAiReservations();
    expect(first).toMatchObject({ committed: 1, released: 0 });
    expect(db.meter()).toMatchObject({ ai_tokens: 9000, ai_tokens_reserved: 0 });
    expect(db.generations).toHaveLength(1);
    expect(db.ledgers).toHaveLength(1);
    const second = await service.reconcileAiReservations();
    expect(second.committed).toBe(0);
    expect(db.generations).toHaveLength(1);
    expect(db.ledgers).toHaveLength(1);
    expect(db.meter().ai_tokens).toBe(9000);
  });

  it('实际消耗超过占位且剩余额度放不下时，只入账占位', async () => {
    const db = createQuotaDb(10000);
    const service = new UsageService(db.api);
    await service.withAiHold(
      { tenantId: 't', holdTokens: 8000, kind: 'article', idempotencyKey: 'over-hold-01' },
      async () => ({ ...product, tokens: 12000, images: 0 }),
    );
    expect(db.meter()).toMatchObject({ ai_tokens: 8000, ai_tokens_reserved: 0 });
    expect(db.reservations[0].committed_tokens).toBe(8000);
  });

  it('不限量档可以占住超过任何固定上限的用量', async () => {
    const db = createQuotaDb(-1);
    const service = new UsageService(db.api);
    await service.reserveAiTokens({ tenantId: 't', holdTokens: 500000, kind: 'article', idempotencyKey: 'unlimited-a1' });
    await service.reserveAiTokens({ tenantId: 't', holdTokens: 500000, kind: 'article', idempotencyKey: 'unlimited-b2' });
    expect(db.meter().ai_tokens_reserved).toBe(1000000);
  });

  it('没有结算数据且已过期的预占会被退回', async () => {
    const db = createQuotaDb(10000);
    const service = new UsageService(db.api);
    await service.reserveAiTokens({ tenantId: 't', holdTokens: 1500, kind: 'titles', idempotencyKey: 'stale-key-01' });
    db.reservations[0].expires_at = new Date(Date.now() - 1000);
    const result = await service.reconcileAiReservations();
    expect(result.released).toBe(1);
    expect(db.reservations[0].status).toBe('released');
    expect(db.meter()).toMatchObject({ ai_tokens: 0, ai_tokens_reserved: 0 });
  });
});
