import { Injectable, NotFoundException, BadRequestException, InternalServerErrorException, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { PublishQueueService } from '../../queue/publish-queue.service';
import { TenantService } from '../tenant/tenant.service';
import { AdapterRegistry } from './adapters/adapter.registry';

@Injectable()
export class PublishService {
  private readonly logger = new Logger(PublishService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly publishQueue: PublishQueueService,
    private readonly tenantService: TenantService,
    private readonly adapterRegistry: AdapterRegistry,
  ) {}

  async createTask(tenantId: string, userId: string, data: {
    contentId: string;
    platformAccountIds: string[];
    publishType: 'immediate' | 'scheduled';
    scheduledAt?: Date;
  }) {
    if (!['immediate', 'scheduled'].includes(data.publishType)) throw new BadRequestException('发布类型无效');
    const accountIds = [...new Set(data.platformAccountIds || [])];
    if (!accountIds.length) throw new BadRequestException('请至少选择一个平台账号');
    if (accountIds.length !== data.platformAccountIds.length) throw new BadRequestException('平台账号不能重复');
    const scheduledAt = data.scheduledAt ? new Date(data.scheduledAt) : undefined;
    if (data.publishType === 'scheduled' && (!scheduledAt || Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() <= Date.now())) {
      throw new BadRequestException('定时发布时间必须晚于当前时间');
    }
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

    // 在写入任何任务前一次性验证所有账号与真实适配器能力，避免批量部分成功。
    const accounts = await Promise.all(
      accountIds.map(async (accountId) => {
        const account = await this.prisma.platformAccount.findFirst({
          where: { id: accountId, tenant_id: tenantId },
        });
        if (!account || account.status !== 'active') {
          throw new NotFoundException(`平台账号不存在或已禁用: ${accountId}`);
        }
        let adapter;
        try { adapter = this.adapterRegistry.get(account.platform); }
        catch { throw new BadRequestException(`平台 ${account.platform} 尚无发布适配器`); }
        if (!adapter.isLive) throw new BadRequestException(`平台 ${account.platform} 尚未完成真实开放平台接入，不能创建发布任务`);
        return account;
      }),
    );

    const tasks = await Promise.all(
      accounts.map(async (account) => {
        const scheduledTime = data.publishType === 'scheduled' && scheduledAt
          ? scheduledAt
          : new Date();

        const task = await this.prisma.publishTask.create({
          data: {
            tenant_id: tenantId,
            content_id: data.contentId,
            platform_account_id: account.id,
            created_by: userId,
            publish_type: data.publishType,
            scheduled_at: scheduledTime,
            status: 'queued',
            queued_at: new Date(),
          },
        });

        try {
          const delay = Math.max(0, scheduledTime.getTime() - Date.now());
          await this.publishQueue.addPublishTask({
            taskId: task.id,
            contentId: data.contentId,
            platformAccountId: account.id,
            platform: account.platform,
            scheduledAt: scheduledTime,
          }, delay);
        } catch (error) {
          await this.prisma.publishTask.update({ where: { id: task.id }, data: { status: 'failed', error_code: 'QUEUE_UNAVAILABLE', error_message: '发布队列暂时不可用' } });
          throw new InternalServerErrorException('发布队列暂时不可用，任务未进入发布流程');
        }

        return task;
      })
    );

    // 增加使用量统计
    await this.tenantService.incrementUsage(tenantId, 'publish', tasks.length);

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
        include: {
          content: { select: { title: true } },
          platform_account: { select: { platform: true, account_name: true, account_nickname: true } },
        },
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
      include: { platform_account: true },
    });

    if (!task) {
      throw new NotFoundException('任务不存在');
    }

    if (task.status !== 'failed') {
      throw new BadRequestException('只有失败的任务可以重试');
    }

    if (!task.platform_account_id || !task.platform_account) {
      throw new BadRequestException('发布任务缺少平台账号');
    }

    const adapter = this.adapterRegistry.get(task.platform_account.platform);
    if (!adapter.isLive) throw new BadRequestException(`平台 ${task.platform_account.platform} 尚未完成真实开放平台接入，不能重试`);

    await this.prisma.publishTask.update({ where: { id: taskId }, data: { status: 'queued', retry_count: { increment: 1 }, started_at: null, completed_at: null, error_code: null, error_message: null } });
    try {
      await this.publishQueue.retryPublishTask({ taskId: task.id, contentId: task.content_id, platformAccountId: task.platform_account_id, platform: task.platform_account.platform });
    } catch {
      await this.prisma.publishTask.update({ where: { id: taskId }, data: { status: 'failed', error_code: 'QUEUE_UNAVAILABLE', error_message: '发布队列暂时不可用' } });
      throw new InternalServerErrorException('发布队列暂时不可用，任务未重新进入发布流程');
    }

    return { success: true, message: '任务已重新加入队列' };
  }

  async cancelTask(taskId: string, tenantId: string) {
    const task = await this.prisma.publishTask.findFirst({
      where: { id: taskId, tenant_id: tenantId },
    });

    if (!task) {
      throw new NotFoundException('任务不存在');
    }

    if (!['pending', 'queued', 'failed'].includes(task.status)) {
      throw new BadRequestException('当前状态无法取消');
    }

    return this.prisma.publishTask.update({
      where: { id: taskId },
      data: { status: 'cancelled' },
    });
  }
}
