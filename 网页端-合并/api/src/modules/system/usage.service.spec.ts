import { Test, TestingModule } from '@nestjs/testing';
import { UsageService, ResourceType } from './usage.service';
import { PrismaService } from '../../database/prisma.service';

describe('UsageService', () => {
    let service: UsageService;
    let prisma: PrismaService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [UsageService, PrismaService],
        }).compile();

        service = module.get<UsageService>(UsageService);
        prisma = module.get<PrismaService>(PrismaService);

        prisma.mockMode = true;
        await prisma.onModuleInit();
    });

    describe('trackUsage', () => {
        it('should increment usage in usageMeter', async () => {
            const tenantId = 'tenant_demo_1';
            const period = new Date().toISOString().substring(0, 7);

            const initialMeter = await (service as any).getMeter(tenantId, period);
            const initialCount = (initialMeter as any).publish_count || 0;

            await service.trackUsage(tenantId, ResourceType.PUBLISHES, 1);

            const updatedMeter = await (service as any).getMeter(tenantId, period);
            expect((updatedMeter as any).publish_count).toBe(initialCount + 1);
        });

        it('should create a costLedger entry for AI tokens', async () => {
            const tenantId = 'tenant_demo_1';
            await service.trackUsage(tenantId, ResourceType.TOKENS, 1000, { refId: 't_123' });

            const entry = prisma.mockDb.cost_ledger.find((l: any) => l.ref_id === 't_123');
            expect(entry).toBeDefined();
            expect(entry.tokens_used).toBe(1000);
        });
    });

    describe('checkQuota', () => {
        it('should return true if under limit', async () => {
            const result = await service.checkQuota('tenant_demo_1', ResourceType.PUBLISHES);
            expect(result).toBe(true);
        });

        it('should return false if limit reached', async () => {
            const tenantId = 'tenant_demo_1';
            const period = new Date().toISOString().substring(0, 7);
            const meter = await (service as any).getMeter(tenantId, period);

            await prisma.usageMeter.update({
                where: { id: meter.id },
                data: { publish_count: 50 },
            });

            const result = await service.checkQuota(tenantId, ResourceType.PUBLISHES);
            expect(result).toBe(false);
        });
    });
});
