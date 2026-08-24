import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

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
        const period = new Date().toISOString().substring(0, 7); // YYYY-MM

        // 查找或创建当前周期的额度统计
        let meter = await this.getMeter(tenantId, period);

        const updateData: any = {};
        updateData[resource] = { increment: amount };

        await this.prisma.usageMeter.update({
            where: { id: (meter as any).id },
            data: updateData,
        });

        // 记录明细
        if (resource === ResourceType.TOKENS) {
            await this.prisma.costLedger.create({
                data: {
                    tenant_id: tenantId,
                    source: 'ai',
                    tokens_used: amount,
                    cost_est_usd: (amount / 1000) * 0.002,
                    ref_id: metadata?.refId,
                }
            });
        }
    }

    async checkQuota(tenantId: string, resource: ResourceType): Promise<boolean> {
        const period = new Date().toISOString().substring(0, 7);
        const meter = await this.getMeter(tenantId, period);
        const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });

        if (!tenant || !meter) return false;

        const resStr = resource as string;
        const limitKey = `max_${resStr.replace('_count', 'es_monthly').replace('_mb', '_gb').replace('ai_tokens', 'ai_calls_monthly')}`;
        const limit = (tenant.limits as any)?.[limitKey] || 0;
        const current = (meter as any)[resource] || 0;

        // 如果限制是 GB，需要转换
        const adjustedCurrent = resource === ResourceType.STORAGE ? current / 1024 : current;

        return adjustedCurrent < limit;
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
