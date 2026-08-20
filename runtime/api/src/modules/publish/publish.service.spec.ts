import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../database/prisma.service';
import { PublishQueueService } from '../../queue/publish-queue.service';
import { TenantService } from '../tenant/tenant.service';
import { PublishService } from './publish.service';

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

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PublishService,
        { provide: PrismaService, useValue: prisma },
        { provide: PublishQueueService, useValue: queue },
        { provide: TenantService, useValue: tenant },
      ],
    }).compile();
    service = module.get(PublishService);
  });

  it('creates and queues one immediate task per active account', async () => {
    prisma.content.findFirst.mockResolvedValue({ id: 'content_1', status: 'approved' });
    tenant.checkQuota.mockResolvedValue(true);
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

  it('queues scheduled tasks with the required delay and charges usage', async () => {
    prisma.content.findFirst.mockResolvedValue({ id: 'content_1', status: 'approved' });
    tenant.checkQuota.mockResolvedValue(true);
    prisma.platformAccount.findFirst.mockResolvedValue({ id: 'account_1', status: 'active', platform: 'x' });
    prisma.publishTask.create.mockResolvedValue({ id: 'task_1' });
    const scheduledAt = new Date(Date.now() + 60_000);

    await service.createTask('tenant_1', 'user_1', {
      contentId: 'content_1',
      platformAccountIds: ['account_1'],
      publishType: 'scheduled',
      scheduledAt,
    });

    expect(queue.addPublishTask).toHaveBeenCalledWith(
      expect.objectContaining({ taskId: 'task_1', scheduledAt }),
      expect.any(Number),
    );
    expect(tenant.incrementUsage).toHaveBeenCalledWith('tenant_1', 'publish', 1);
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

  it('rejects empty account lists and invalid schedule times', async () => {
    await expect(service.createTask('tenant_1', 'user_1', {
      contentId: 'content_1',
      platformAccountIds: [],
      publishType: 'immediate',
    })).rejects.toThrow('At least one platform account');

    await expect(service.createTask('tenant_1', 'user_1', {
      contentId: 'content_1',
      platformAccountIds: ['account_1'],
      publishType: 'scheduled',
      scheduledAt: new Date(Date.now() - 1_000),
    })).rejects.toThrow('must be in the future');
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

  it('persists confirmed remote publish identity and state', async () => {
    prisma.publishTask.update.mockResolvedValue({ id: 'task_1', status: 'published' });

    await service.recordRemoteOutcome('task_1', {
      state: 'POSTED',
      remotePostId: 'remote_42',
      remotePostUrl: 'https://social.example/posts/remote_42',
    });

    expect(prisma.publishTask.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'task_1' },
      data: expect.objectContaining({
        status: 'published',
        platform_post_id: 'remote_42',
        error_details: { remote_state: 'POSTED' },
        completed_at: expect.any(Date),
      }),
    }));
  });

  it('fails closed when the remote state is not confirmed', async () => {
    prisma.publishTask.update.mockResolvedValue({ id: 'task_1', status: 'submitted_unconfirmed' });

    await service.recordRemoteOutcome('task_1', { state: 'processing' });

    expect(prisma.publishTask.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: 'submitted_unconfirmed',
        error_details: { remote_state: 'PROCESSING' },
        completed_at: null,
      }),
    }));
  });

  it('requires a failure reason for failed remote states', async () => {
    await expect(
      service.recordRemoteOutcome('task_1', { state: 'FAILED' }),
    ).rejects.toThrow('A failure reason is required for failed state');
  });
});
