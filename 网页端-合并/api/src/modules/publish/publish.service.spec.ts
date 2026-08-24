import { Test, TestingModule } from '@nestjs/testing';
import { PublishService } from './publish.service';
import { PrismaService } from '../../database/prisma.service';
import { AdapterRegistry } from './adapters/adapter.registry';
import { BilibiliAdapter } from './adapters/bilibili.adapter';
import { DouyinAdapter } from './adapters/douyin.adapter';
import { NotFoundException } from '@nestjs/common';

describe('PublishService', () => {
    let service: PublishService;
    let prisma: PrismaService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                PublishService,
                PrismaService,
                AdapterRegistry,
                BilibiliAdapter,
                DouyinAdapter,
            ],
        }).compile();

        service = module.get<PublishService>(PublishService);
        prisma = module.get<PrismaService>(PrismaService);

        prisma.mockMode = true;
        await prisma.onModuleInit();

        const registry = module.get<AdapterRegistry>(AdapterRegistry);
        registry.register(module.get(BilibiliAdapter));
        registry.register(module.get(DouyinAdapter));
    });

    describe('executeTask', () => {
        it('should process a valid bilibili task to published or reviewing', async () => {
            const content = await prisma.content.create({
                data: { title: 'Bili Title', media_urls: ['http://v.mp4'] }
            });

            const task = await service.createPublishTask('u_1', 'tenant_demo_1', {
                contentId: content.id,
                platform: 'bilibili',
                accountId: 'acc_bili_1',
                publishType: 'scheduled',
                idempotencyKey: 'k_last_final',
                extra: { tid: 123 },
            } as any);

            await service.executeTask(task.id);

            const updated = await prisma.publishTask.findUnique({ where: { id: task.id } });
            // Bilibili 常用状态包括 published 或 reviewing
            expect(['published', 'reviewing']).toContain(updated.status);
        });

        it('should fail with MISSING_TID if tid is missing', async () => {
            const content = await prisma.content.create({
                data: { title: 'Bili No TID', media_urls: ['http://v.mp4'] }
            });

            const task = await service.createPublishTask('u_1', 'tenant_demo_1', {
                contentId: content.id,
                platform: 'bilibili',
                accountId: 'acc_bili_1',
                publishType: 'scheduled',
                idempotencyKey: 'k_err_vid_final',
            });

            await service.executeTask(task.id);

            const updated = await prisma.publishTask.findUnique({ where: { id: task.id } });
            expect(updated.status).toBe('failed');
            expect(updated.last_error_code).toBe('MISSING_TID');
        });
    });
});
