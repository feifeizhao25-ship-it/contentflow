import { Logger } from '@nestjs/common';
import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { PrismaService } from '../../database/prisma.service';
import { PublishJobData } from '../../queue/publish-queue.service';
import { AdapterRegistry } from './adapters/adapter.registry';
import { PlatformPayload } from './adapters/adapter.interface';

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

@Processor('publish-queue')
export class PublishProcessor {
  private readonly logger = new Logger(PublishProcessor.name);

  constructor(private readonly prisma: PrismaService, private readonly adapters: AdapterRegistry) {}

  @Process()
  async publish(job: Job<PublishJobData>) {
    const task = await this.prisma.publishTask.findUnique({
      where: { id: job.data.taskId },
      include: { content: true, platform_account: true },
    });
    if (!task) throw new Error('PUBLISH_TASK_NOT_FOUND');
    if (task.status === 'published') return { alreadyPublished: true, externalId: task.platform_post_id };
    if (task.status === 'cancelled') return { cancelled: true };
    if (!task.platform_account || task.platform_account.tenant_id !== task.tenant_id) throw new Error('PLATFORM_ACCOUNT_TENANT_MISMATCH');

    const adapter = this.adapters.get(task.platform_account.platform);
    if (!adapter.isLive) {
      await this.fail(task.id, 'ADAPTER_NOT_INTEGRATED', `平台 ${task.platform_account.platform} 尚未完成真实接入`);
      throw new Error('ADAPTER_NOT_INTEGRATED');
    }
    await this.prisma.publishTask.update({ where: { id: task.id }, data: { status: 'processing', started_at: new Date(), error_code: null, error_message: null } });
    const payload: PlatformPayload = {
      platform: task.platform_account.platform,
      contentId: task.content_id,
      title: task.content.title || undefined,
      body: task.content.body || undefined,
      bodyHtml: task.content.body_html || undefined,
      hashtags: stringArray(task.content.tags),
      coverUrl: task.content.cover_url || undefined,
      mediaUrls: stringArray(task.content.media_urls),
    };
    const validation = await adapter.validate(payload);
    if (!validation.ok) {
      await this.fail(task.id, validation.errorCode || 'PLATFORM_VALIDATION_FAILED', validation.humanMessage || validation.errorMessage || '平台内容校验失败');
      throw new Error(validation.errorCode || 'PLATFORM_VALIDATION_FAILED');
    }
    if (adapter.uploadMedia) {
      const upload = await adapter.uploadMedia(payload);
      if (!upload.ok) {
        await this.fail(task.id, upload.errorCode || 'MEDIA_UPLOAD_FAILED', upload.humanMessage || upload.errorMessage || '媒体上传失败');
        throw new Error(upload.errorCode || 'MEDIA_UPLOAD_FAILED');
      }
      payload.extra = { ...payload.extra, mediaRefs: upload.data?.mediaRefs };
    }
    const result = await adapter.createPost(payload);
    if (!result.ok || !result.data?.externalId) {
      await this.fail(task.id, result.errorCode || 'PLATFORM_PUBLISH_FAILED', result.humanMessage || result.errorMessage || '平台发布失败');
      throw new Error(result.errorCode || 'PLATFORM_PUBLISH_FAILED');
    }
    await this.prisma.publishTask.update({ where: { id: task.id }, data: { status: result.data.status || 'submitted', platform_post_id: result.data.externalId, completed_at: new Date() } });
    this.logger.log(`Publish task ${task.id} submitted as ${result.data.externalId}`);
    return { externalId: result.data.externalId, status: result.data.status };
  }

  private async fail(taskId: string, code: string, message: string) {
    await this.prisma.publishTask.update({ where: { id: taskId }, data: { status: 'failed', error_code: code, error_message: message, completed_at: new Date() } });
  }
}
