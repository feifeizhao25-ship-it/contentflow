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
      throw new NotFoundException('内容不存在');
    }

    if (content.status !== 'approved' && content.status !== 'published') {
      throw new BadRequestException('内容未通过审核');
    }

    // 检查配额
    const canPublish = await this.tenantService.checkQuota(tenantId, 'publish');
    if (!canPublish) {
      throw new BadRequestException('发布次数已达上限，请升级套餐');
    }

    // 创建发布任务
    const tasks = await Promise.all(
      data.platformAccountIds.map(async (accountId) => {
        // 检查账号是否存在
        const account = await this.prisma.platformAccount.findFirst({
          where: { id: accountId, tenant_id: tenantId },
        });

        if (!account || account.status !== 'active') {
          throw new NotFoundException(`平台账号不存在或已禁用: ${accountId}`);
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
      throw new NotFoundException('任务不存在');
    }

    if (task.status !== 'failed') {
      throw new BadRequestException('只有失败的任务可以重试');
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

    await this.publishQueue.addPublishTask({
      taskId: task.id,
      contentId: task.content_id,
      platformAccountId: task.platform_account_id,
      platform: '',
    });

    return { success: true, message: '任务已重新加入队列' };
  }

  async cancelTask(taskId: string, tenantId: string) {
    const task = await this.prisma.publishTask.findFirst({
      where: { id: taskId, tenant_id: tenantId },
    });

    if (!task) {
      throw new NotFoundException('任务不存在');
    }

    if (!['pending', 'queued'].includes(task.status)) {
      throw new BadRequestException('当前状态无法取消');
    }

    return this.prisma.publishTask.update({
      where: { id: taskId },
      data: { status: 'cancelled' },
    });
  }
}
