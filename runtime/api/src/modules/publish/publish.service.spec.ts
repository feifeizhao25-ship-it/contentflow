import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../database/prisma.service';
import { PublishQueueService } from '../../queue/publish-queue.service';
import { TenantService } from '../tenant/tenant.service';
import { PublishService } from './publish.service';
import { AdapterRegistry } from './adapters/adapter.registry';
import { ConfigService } from '@nestjs/config';

describe('PublishService', () => {
  let service: PublishService;
  const prisma = {
    content: { findFirst: jest.fn() },
    platformAccount: { findFirst: jest.fn() },
    publishTask: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
  };
  const queue = { addPublishTask: jest.fn() };
  const tenant = {
    checkQuota: jest.fn(),
    incrementUsage: jest.fn(),
  };
  const adapterRegistry = { get: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PublishService,
        { provide: PrismaService, useValue: prisma },
        { provide: PublishQueueService, useValue: queue },
        { provide: TenantService, useValue: tenant },
        { provide: AdapterRegistry, useValue: adapterRegistry },
        { provide: ConfigService, useValue: { get: jest.fn((_key: string, fallback: unknown) => fallback) } },
      ],
    }).compile();
    service = module.get(PublishService);
  });

  it('refuses to queue the same text to two accounts without a per-platform rewrite and a human confirm', async () => {
    prisma.content.findFirst.mockResolvedValue({ id: 'content_1', status: 'approved', title: '标题', body: '同一段正文' });
    tenant.checkQuota.mockResolvedValue(true);
    adapterRegistry.get.mockReturnValue({ isLive: true });
    prisma.platformAccount.findFirst.mockImplementation(({ where }: any) =>
      Promise.resolve({ id: where.id, status: 'active', platform: 'bilibili' }),
    );

    await expect(service.createTask('tenant_1', 'user_1', {
      contentId: 'content_1',
      platformAccountIds: ['account_1', 'account_2'],
      publishType: 'immediate',
      humanConfirmed: true,
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.publishTask.create).not.toHaveBeenCalled();
    expect(queue.addPublishTask).not.toHaveBeenCalled();
  });

  it('queues distinct per-platform rewrites only after a human confirms', async () => {
    prisma.content.findFirst.mockResolvedValue({ id: 'content_1', status: 'approved', title: '标题', body: '一段需要改写的正文。', source: 'manual' });
    tenant.checkQuota.mockResolvedValue(true);
    adapterRegistry.get.mockReturnValue({ isLive: true });
    (prisma as any).platformContent = { upsert: jest.fn().mockImplementation(({ create }: any) => Promise.resolve({ id: `pc-${create.platform}`, ...create })) };
    prisma.platformAccount.findFirst.mockImplementation(({ where }: any) =>
      Promise.resolve({ id: where.id, status: 'active', platform: where.id === 'account_1' ? 'xhs' : 'douyin' }),
    );
    prisma.publishTask.create
      .mockResolvedValueOnce({ id: 'task_1' })
      .mockResolvedValueOnce({ id: 'task_2' });

    const tasks = await service.createTask('tenant_1', 'user_1', {
      contentId: 'content_1',
      platformAccountIds: ['account_1', 'account_2'],
      publishType: 'immediate',
      humanConfirmed: true,
    });

    expect(tasks).toHaveLength(2);
    expect(queue.addPublishTask).toHaveBeenCalledTimes(2);
    const bodies = (prisma as any).platformContent.upsert.mock.calls.map((call: any) => call[0].create.body);
    expect(bodies[0]).not.toBe(bodies[1]);
  });

  it('rejects before creating tasks when a platform adapter is not live', async () => {
    prisma.content.findFirst.mockResolvedValue({ id: 'content_1', status: 'approved' });
    tenant.checkQuota.mockResolvedValue(true);
    prisma.platformAccount.findFirst.mockResolvedValue({ id: 'account_1', status: 'active', platform: 'douyin' });
    adapterRegistry.get.mockReturnValue({ isLive: false });
    await expect(service.createTask('tenant_1', 'user_1', { contentId: 'content_1', platformAccountIds: ['account_1'], publishType: 'immediate' })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.publishTask.create).not.toHaveBeenCalled();
    expect(queue.addPublishTask).not.toHaveBeenCalled();
  });

  it('queues scheduled tasks with a delay instead of leaving them pending forever', async () => {
    const scheduledAt = new Date(Date.now() + 60_000);
    prisma.content.findFirst.mockResolvedValue({ id: 'content_1', status: 'approved' });
    tenant.checkQuota.mockResolvedValue(true);
    prisma.platformAccount.findFirst.mockResolvedValue({ id: 'account_1', status: 'active', platform: 'custom-live' });
    adapterRegistry.get.mockReturnValue({ isLive: true });
    prisma.publishTask.create.mockResolvedValue({ id: 'task_1' });
    await service.createTask('tenant_1', 'user_1', { contentId: 'content_1', platformAccountIds: ['account_1'], publishType: 'scheduled', scheduledAt });
    expect(queue.addPublishTask).toHaveBeenCalledWith(expect.objectContaining({ taskId: 'task_1', scheduledAt }), expect.any(Number));
  });

  it('rejects content that does not belong to the tenant', async () => {
    prisma.content.findFirst.mockResolvedValue(null);
    await expect(
      service.createTask('tenant_1', 'user_1', {
        contentId: 'missing',
        platformAccountIds: ['account_1'],
        publishType: 'immediate',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects publishing when the tenant quota is exhausted', async () => {
    prisma.content.findFirst.mockResolvedValue({ id: 'content_1', status: 'approved' });
    tenant.checkQuota.mockResolvedValue(false);
    await expect(
      service.createTask('tenant_1', 'user_1', {
        contentId: 'content_1',
        platformAccountIds: ['account_1'],
        publishType: 'immediate',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('fails closed before queueing domestic content that hits a compliance gate', async () => {
    prisma.content.findFirst.mockResolvedValue({
      id: 'content_1', status: 'approved', title: '稳赚项目', body: '百分之百有效', body_html: null,
    });
    await expect(service.createTask('tenant_1', 'user_1', {
      contentId: 'content_1', platformAccountIds: ['account_1'], publishType: 'immediate',
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.publishTask.create).not.toHaveBeenCalled();
    expect(queue.addPublishTask).not.toHaveBeenCalled();
  });
});
