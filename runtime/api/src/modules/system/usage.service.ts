import { Injectable, Logger } from '@nestjs/common';
import { effectiveEntitlements } from '../billing/effective-limits';
import { PrismaService } from '../../database/prisma.service';
import { chinaMonthPeriod } from '../../common/china-period';

/**
 * 本月 AI 令牌额度（唯一算法）。
 *
 * AI 接口的额度闸（UsageService.checkQuota(TOKENS)）和界面上显示的「本月 AI 额度」
 * （GET /billing/subscription）都走这里，保证「界面显示还剩多少」和「接口会不会拦」是同一个数。
 * 原来两处各写一套兜底（一处缺省按 0、一处缺省按免费档），创作工作室还另外显示一套
 * 与额度无关的「签到积分」余额和写死的「单次消耗 5 积分」。
 * limit = -1 表示不限量。
 */
export const AI_CALL_TOKEN_EQUIVALENT = 2500;

export interface AiTokenAllowance {
    limit: number;
    used: number;
    remaining: number;
    unlimited: boolean;
}

export function aiTokenAllowance(limits: Record<string, number>, meter: { ai_tokens?: number | null } | null | undefined): AiTokenAllowance {
    const raw = limits.max_ai_tokens_monthly ?? ((limits.max_ai_calls_monthly ?? 0) * AI_CALL_TOKEN_EQUIVALENT);
    const limit = Number.isFinite(Number(raw)) ? Number(raw) : 0;
    const used = Math.max(0, Number(meter?.ai_tokens ?? 0) || 0);
    const unlimited = limit === -1;
    return { limit, used, remaining: unlimited ? -1 : Math.max(0, limit - used), unlimited };
}

export enum ResourceType {
    TOKENS = 'ai_tokens',
    IMAGES = 'image_count',
    VIDEOS = 'video_count',
    PUBLISHES = 'publish_count',
    STORAGE = 'storage_mb',
}

@Injectable()
export class UsageService {
    private readonly logger = new Logger(UsageService.name);

    constructor(private readonly prisma: PrismaService) { }

    async trackUsage(tenantId: string, resource: ResourceType, amount: number, metadata?: any) {
        const period = chinaMonthPeriod(); // YYYY-MM，北京时间自然月

        if (!Number.isSafeInteger(amount) || amount < 0 || amount > 2147483647) {
            throw new RangeError('用量必须是非负整数且不超过数据库计数范围');
        }
        if (amount === 0) return;

        // 月用量和明细必须同时成功，避免账单写入失败后仍扣额度。
        await this.prisma.$transaction(async (tx) => {
            await tx.usageMeter.upsert({
                where: { tenant_id_period: { tenant_id: tenantId, period } },
                create: { tenant_id: tenantId, period, [resource]: amount },
                update: { [resource]: { increment: amount } },
            });
            if (resource === ResourceType.TOKENS) {
                await tx.costLedger.create({
                    data: {
                        tenant_id: tenantId,
                        source: 'ai',
                        tokens_used: amount,
                        // 金额以生成记录的模型价格为准，不使用无出处的美元估价。
                        cost_est_usd: 0,
                        ref_id: metadata?.refId,
                    },
                });
            }
        });
    }

    async checkQuota(tenantId: string, resource: ResourceType): Promise<boolean> {
        const period = chinaMonthPeriod();
        const meter = await this.getMeter(tenantId, period);
        const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });

        if (!tenant || !meter) return false;

        const limits: Record<string, number> = effectiveEntitlements(tenant).limits;
        if (resource === ResourceType.TOKENS) {
            const allowance = aiTokenAllowance(limits, meter as any);
            return allowance.unlimited || allowance.remaining > 0;
        }
        const limit = resource === ResourceType.STORAGE
              ? (limits.max_storage_gb ?? 0)
              : resource === ResourceType.PUBLISHES
                ? (limits.max_publishes_monthly ?? 0)
                : resource === ResourceType.IMAGES
                  ? (limits.max_images_monthly ?? 0)
                  : (limits.max_videos_monthly ?? 0);
        const current = (meter as any)[resource] || 0;

        // 如果限制是 GB，需要转换
        const adjustedCurrent = resource === ResourceType.STORAGE ? current / 1024 : current;

        return limit === -1 || adjustedCurrent < limit;
    }

    private async getMeter(tenantId: string, period: string) {
        let meter = await this.prisma.usageMeter.findFirst({
            where: { tenant_id: tenantId, period },
        });

        if (!meter) {
            meter = await this.prisma.usageMeter.create({
                data: {
                    tenant_id: tenantId,
                    period,
                    ai_tokens: 0,
                    image_count: 0,
                    video_count: 0,
                    publish_count: 0,
                    storage_mb: 0,
                },
            });
        }
        return meter;
    }
}
