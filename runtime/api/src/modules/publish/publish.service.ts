import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { PublishQueueService } from '../../queue/publish-queue.service';
import { TenantService } from '../tenant/tenant.service';

@Injectable()
export class PublishService {
  private readonly logger = new Logger(PublishService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly publishQueue: PublishQueueService,
    private readonly tenantService: TenantService,
  ) {}

  async createTask(tenantId: string, userId: string, data: {
    contentId: string;
    platformAccountIds: string[];
    publishType: 'immediate' | 'scheduled';
    scheduledAt?: Date;
  }) {
    // 检查内容是否存在且已审核通过
    const content = await this.prisma.content.findFirst({
      where: { id: data.contentId, tenant_id: tenantId },
    });

    if (!content) {
      throw new NotFoundException('Content not found');
    }

    if (content.status !== 'approved' && content.status !== 'published') {
      throw new BadRequestException('Content has not been approved');
    }

    // 检查配额
    const canPublish = await this.tenantService.checkQuota(tenantId, 'publish');
    if (!canPublish) {
      throw new BadRequestException('Publishing quota reached; upgrade the plan to continue');
    }

    // 创建发布任务
    const tasks = await Promise.all(
      data.platformAccountIds.map(async (accountId) => {
        // 检查账号是否存在
        const account = await this.prisma.platformAccount.findFirst({
          where: { id: accountId, tenant_id: tenantId },
        });

        if (!account || account.status !== 'active') {
          throw new NotFoundException(`Platform account not found or inactive: ${accountId}`);
        }

        const scheduledTime = data.publishType === 'scheduled' && data.scheduledAt
          ? data.scheduledAt
          : new Date();

        const task = await this.prisma.publishTask.create({
          data: {
            tenant_id: tenantId,
            content_id: data.contentId,
            platform_account_id: accountId,
            created_by: userId,
            publish_type: data.publishType,
            scheduled_at: scheduledTime,
            status: data.publishType === 'immediate' ? 'queued' : 'pending',
          },
        });

        // 立即发布的任务加入队列
        if (data.publishType === 'immediate') {
          await this.publishQueue.addPublishTask({
            taskId: task.id,
            contentId: data.contentId,
            platformAccountId: accountId,
            platform: account.platform,
          });
        }

        return task;
      })
    );

    // 增加使用量统计
    if (data.publishType === 'immediate') {
      await this.tenantService.incrementUsage(tenantId, 'publish', tasks.length);
    }

    return tasks;
  }

  async getTasks(tenantId: string, options: { status?: string; page?: number; pageSize?: number }) {
    const { status, page = 1, pageSize = 20 } = options;
    const skip = (page - 1) * pageSize;

    const where: any = { tenant_id: tenantId };
    if (status) where.status = status;

    const [tasks, total] = await Promise.all([
      this.prisma.publishTask.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.publishTask.count({ where }),
    ]);

    return {
      tasks,
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async retryTask(taskId: string, tenantId: string) {
    const task = await this.prisma.publishTask.findFirst({
      where: { id: taskId, tenant_id: tenantId },
    });

    if (!task) {
      throw new NotFoundException('Publish task not found');
    }

    if (task.status !== 'failed') {
      throw new BadRequestException('Only failed publish tasks can be retried');
    }

    // 更新任务状态并重新加入队列
    await this.prisma.publishTask.update({
      where: { id: taskId },
      data: {
        status: 'queued',
        retry_count: { increment: 1 },
        started_at: null,
        completed_at: null,
      },
    });

    if (!task.platform_account_id) {
      throw new BadRequestException('Publish task is missing a platform account');
    }

    await this.publishQueue.addPublishTask({
      taskId: task.id,
      contentId: task.content_id,
      platformAccountId: task.platform_account_id,
      platform: '',
    });

    return { success: true, message: 'Publish task queued for retry' };
  }

  async recordRemoteOutcome(taskId: string, outcome: {
    state: string;
    remotePostId?: string;
    remotePostUrl?: string;
    errorCode?: string;
    failureReason?: string;
    details?: Record<string, unknown>;
  }) {
    const normalizedState = outcome.state.trim().toUpperCase();
    const confirmed = new Set(['PUBLISHED', 'POSTED', 'COMPLETED']);
    const failed = new Set(['FAILED', 'REJECTED', 'CANCELLED']);
    const status = confirmed.has(normalizedState)
      ? 'published'
      : failed.has(normalizedState)
        ? 'failed'
        : 'submitted_unconfirmed';

    if (status === 'published' && !outcome.remotePostId) {
      throw new BadRequestException('A confirmed remote post ID is required for published state');
    }
    if (status === 'failed' && !outcome.failureReason) {
      throw new BadRequestException('A failure reason is required for failed state');
    }

    return this.prisma.publishTask.update({
      where: { id: taskId },
      data: {
        status,
        platform_post_id: outcome.remotePostId ?? null,
        platform_post_url: outcome.remotePostUrl ?? null,
        error_code: outcome.errorCode ?? null,
        error_message: outcome.failureReason ?? null,
        error_details: {
          remote_state: normalizedState,
          ...(outcome.details ?? {}),
        },
        completed_at: status === 'submitted_unconfirmed' ? null : new Date(),
      },
    });
  }

  async cancelTask(taskId: string, tenantId: string) {
    const task = await this.prisma.publishTask.findFirst({
      where: { id: taskId, tenant_id: tenantId },
    });

    if (!task) {
      throw new NotFoundException('Publish task not found');
    }

    if (!['pending', 'queued'].includes(task.status)) {
      throw new BadRequestException('The current publish task state cannot be cancelled');
    }

    return this.prisma.publishTask.update({
      where: { id: taskId },
      data: { status: 'cancelled' },
    });
  }
}
