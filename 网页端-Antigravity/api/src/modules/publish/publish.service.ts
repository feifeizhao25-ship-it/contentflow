import { Injectable, Logger, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AdapterRegistry } from './adapters/adapter.registry';
import { PlatformPayload } from './adapters/adapter.interface';
import { GamificationService } from '../gamification/gamification.service';

@Injectable()
export class PublishService {
  private readonly logger = new Logger(PublishService.name);

  constructor(
    private prisma: PrismaService,
    private registry: AdapterRegistry,
    private gamificationService: GamificationService,
  ) { }

  /**
   * 创建发布任务 (带幂等校验)
   */
  async createPublishTask(userId: string, tenantId: string, data: {
    contentId: string;
    platform: string;
    accountId: string;
    publishType: 'immediate' | 'scheduled';
    scheduledAt?: Date;
    idempotencyKey: string;
    extra?: any;
  }) {
    // 1. 幂等检查
    const existed = await this.prisma.publishTask.findUnique({
      where: {
        tenant_id_idempotency_key: {
          tenant_id: tenantId,
          idempotency_key: data.idempotencyKey,
        },
      },
    });

    if (existed) {
      this.logger.log(`Task already exists for idempotencyKey: ${data.idempotencyKey}`);
      return existed;
    }

    // 2. 检查账号
    const account = await this.prisma.platformAccount.findFirst({
      where: { id: data.accountId, tenant_id: tenantId },
    });
    if (!account) throw new NotFoundException('Platform account not found');

    // 3. 创建任务 (使用 camel_case 与 schema 一致)
    const task = await this.prisma.publishTask.create({
      data: {
        tenant_id: tenantId,
        created_by: userId,
        content_id: data.contentId,
        platform: data.platform,
        platform_account_id: data.accountId,
        publish_type: data.publishType,
        scheduled_at: data.scheduledAt,
        status: data.publishType === 'scheduled' ? 'scheduled' : 'queued',
        idempotency_key: data.idempotencyKey,
        payload_snapshot: data.extra || {},
      },
    });

    // 4. 如果是立即发布且不是 scheduled 类型，则触发执行
    if (data.publishType === 'immediate') {
      this.executeTask(task.id).catch(err => {
        this.logger.error(`Failed to execute task ${task.id}: ${err.message}`);
      });
    }

    return task;
  }

  /**
   * 执行发布任务 (核心状态机)
   */
  async executeTask(taskId: string) {
    const task = await this.prisma.publishTask.findUnique({
      where: { id: taskId },
      include: { platform_account: true },
    });

    if (!task) return;
    if (!['queued', 'scheduled', 'retrying'].includes(task.status)) return;

    const adapter = this.registry.get(task.platform);

    try {
      // 1. 获取内容详情
      const content = await this.prisma.content.findUnique({ where: { id: task.content_id } });
      if (!content) throw new Error('Content not found');

      // 强制映射，解决 Mock 状态下的属性可见性问题
      const mediaUrls = (content as any).media_urls || (content as any).mediaUrls || [];

      const payload: PlatformPayload = {
        platform: task.platform,
        contentId: task.content_id,
        title: (content as any).title,
        body: (content as any).body,
        coverUrl: (content as any).cover_url,
        mediaUrls: mediaUrls as string[],
        extra: task.payload_snapshot || {},
      };

      // 2. 校验
      const vr = await adapter.validate(payload);
      if (!vr.ok) {
        return this.failTask(taskId, vr);
      }

      // 3. 更新状态为提交中
      await this.prisma.publishTask.update({
        where: { id: taskId },
        data: { status: 'submitting' },
      });

      // 4. 媒体上传
      if (adapter.uploadMedia) {
        const ur = await adapter.uploadMedia(payload);
        if (!ur.ok) return this.failTask(taskId, ur, true);
        payload.extra = { ...payload.extra, ...ur.data?.mediaRefs };
      }

      // 5. 提交发布
      const cr = await adapter.createPost(payload);
      if (!cr.ok) return this.failTask(taskId, cr, true);

      // 6. 完成任务
      await this.prisma.publishTask.update({
        where: { id: taskId },
        data: {
          status: cr.data?.status === 'reviewing' ? 'reviewing' : 'published',
          external_id: cr.data?.externalId,
          last_error_code: null,
          last_error_message: null,
        },
      });

      this.logger.log(`Task ${taskId} executed successfully: ${cr.data?.status}`);

      // 7. 触发游戏化奖励 (Publish Success -> +50 XP, +1 Streak)
      if (task.created_by) {
        try {
          await this.gamificationService.addXp(task.created_by, 50, 'publish_success');
          await this.gamificationService.updateStreak(task.created_by);

          if (task.platform === 'douyin' || task.platform === 'bilibili') {
            // 首次跨平台发布成就? (简单示范)
            // await this.gamificationService.unlockAchievement(task.created_by, 'first_publish');
          }
        } catch (e) {
          this.logger.warn(`Failed to trigger gamification for task ${taskId}: ${e.message}`);
        }
      }

    } catch (error) {
      this.logger.error(`Error executing task ${taskId}: ${error.message}`);
      await this.failTask(taskId, {
        errorCode: 'INTERNAL_ERROR',
        humanMessage: '系统内部错误',
        errorMessage: error.message
      }, true);
    }
  }

  private async failTask(taskId: string, res: any, retryable = false) {
    const task = await this.prisma.publishTask.findUnique({ where: { id: taskId } });
    const retryCount = (task as any)?.retry_count || 0;
    const maxRetries = (task as any)?.max_retries || 5;

    const isRetrying = retryable && retryCount < maxRetries;

    await this.prisma.publishTask.update({
      where: { id: taskId },
      data: {
        status: isRetrying ? 'retrying' : 'failed',
        retry_count: isRetrying ? { increment: 1 } : undefined,
        last_error_code: res.errorCode ?? 'UNKNOWN',
        last_error_message: res.humanMessage ?? res.errorMessage ?? 'Unknown error',
      },
    });
  }

  async getTasks(tenantId: string) {
    return this.prisma.publishTask.findMany({
      where: { tenant_id: tenantId },
      orderBy: { created_at: 'desc' },
    });
  }
}
