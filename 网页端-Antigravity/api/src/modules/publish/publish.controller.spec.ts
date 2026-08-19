import { Test, TestingModule } from '@nestjs/testing';
import { PublishController } from './publish.controller';
import { PublishService } from './publish.service';
import { PrismaService } from '../../database/prisma.service';
import { AdapterRegistry } from './adapters/adapter.registry';
import { BilibiliAdapter } from './adapters/bilibili.adapter';
import { DouyinAdapter } from './adapters/douyin.adapter';

describe('PublishController', () => {
    let controller: PublishController;
    let service: PublishService;
    let prisma: PrismaService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [PublishController],
            providers: [
                PublishService,
                PrismaService,
                AdapterRegistry,
                BilibiliAdapter,
                DouyinAdapter,
            ],
        }).compile();

        controller = module.get<PublishController>(PublishController);
        service = module.get<PublishService>(PublishService);
        prisma = module.get<PrismaService>(PrismaService);
        prisma.mockMode = true;
        await prisma.onModuleInit();

        const registry = module.get<AdapterRegistry>(AdapterRegistry);
        registry.register(module.get(BilibiliAdapter));
        registry.register(module.get(DouyinAdapter));
    });

    const mockReq = {
        user: { id: 'user_demo_1', tenantId: 'tenant_demo_1' }
    } as any;

    describe('createTasks', () => {
        it('should successfully create a task', async () => {
            // 先创建一个 content 以免 executeTask 报错
            const content = await prisma.content.create({ data: { title: 'C1' } });

            const dto = {
                contentId: content.id,
                platform: 'bilibili',
                accountId: 'acc_bili_1',
                publishType: 'immediate' as const,
                idempotencyKey: 'k_ctrl_1',
            };

            const result = await controller.createTasks(mockReq, dto);
            expect(result).toBeDefined();
            expect(result.id).toBeDefined();
        });
    });

    describe('getTasks', () => {
        it('should list tasks', async () => {
            const result = await controller.getTasks(mockReq);
            expect(Array.isArray(result)).toBe(true);
        });
    });
});
