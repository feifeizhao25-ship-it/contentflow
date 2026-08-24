import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../database/prisma.service';
import { PublishQueueService } from '../../queue/publish-queue.service';
import { TenantService } from '../tenant/tenant.service';
import { PublishService } from './publish.service';
import { AdapterRegistry } from './adapters/adapter.registry';

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
      ],
    }).compile();
    service = module.get(PublishService);
  });

  it('creates and queues one immediate task per active account', async () => {
    prisma.content.findFirst.mockResolvedValue({ id: 'content_1', status: 'approved' });
    tenant.checkQuota.mockResolvedValue(true);
    adapterRegistry.get.mockReturnValue({ isLive: true });
    prisma.platformAccount.findFirst.mockImplementation(({ where }: any) =>
      Promise.resolve({ id: where.id, status: 'active', platform: 'bilibili' }),
    );
    prisma.publishTask.create
      .mockResolvedValueOnce({ id: 'task_1' })
      .mockResolvedValueOnce({ id: 'task_2' });

    const tasks = await service.createTask('tenant_1', 'user_1', {
      contentId: 'content_1',
      platformAccountIds: ['account_1', 'account_2'],
      publishType: 'immediate',
    });

    expect(tasks).toHaveLength(2);
    expect(queue.addPublishTask).toHaveBeenCalledTimes(2);
    expect(tenant.incrementUsage).toHaveBeenCalledWith('tenant_1', 'publish', 2);
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
});
