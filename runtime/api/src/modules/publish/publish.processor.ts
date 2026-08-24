import { createHmac } from 'node:crypto';
import { Process, Processor } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Job } from 'bull';
import { PrismaService } from '../../database/prisma.service';
import type { PublishJobData } from '../../queue/publish-queue.service';

interface DispatchResult { state?: string; remotePostId?: string; remotePostUrl?: string; failureReason?: string }

@Injectable()
@Processor('publish-queue')
export class PublishProcessor {
  private readonly logger = new Logger(PublishProcessor.name);
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}

  @Process()
  async dispatch(job: Job<PublishJobData>) {
    const webhookUrl = this.config.get<string>('PUBLISH_DISPATCH_WEBHOOK_URL', '');
    const webhookSecret = this.config.get<string>('PUBLISH_DISPATCH_WEBHOOK_SECRET', '');
    if (!webhookUrl || !webhookSecret) throw new Error('Production publishing dispatcher is not configured');
    if (webhookSecret.length < 32) throw new Error('Publishing dispatcher secret must contain at least 32 characters');
    if (new URL(webhookUrl).protocol !== 'https:') throw new Error('Publishing dispatcher must use HTTPS');
    const task = await this.prisma.publishTask.findFirst({
      where: { id: job.data.taskId },
      include: { content: true, platform_account: { select: { id: true, platform: true, account_name: true, account_nickname: true, platform_account_id: true } } },
    });
    if (!task || !task.platform_account) throw new Error('Publish task or platform account not found');
    await this.prisma.publishTask.update({ where: { id: task.id }, data: { status: 'processing', started_at: new Date(), error_message: null } });
    const payload = JSON.stringify({
      schemaVersion: 1, idempotencyKey: `contentflow:${task.id}`, taskId: task.id,
      tenantId: task.tenant_id, marketRegion: this.config.get<string>('MARKET_REGION'),
      scheduledAt: task.scheduled_at?.toISOString(), account: task.platform_account,
      content: { id: task.content.id, title: task.content.title, body: task.content.body, bodyHtml: task.content.body_html, coverUrl: task.content.cover_url, mediaUrls: task.content.media_urls, tags: task.content.tags },
    });
    const timestamp = Date.now().toString();
    const signature = createHmac('sha256', webhookSecret).update(`${timestamp}.${payload}`).digest('hex');
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': `contentflow:${task.id}`, 'X-ContentFlow-Timestamp': timestamp, 'X-ContentFlow-Signature': `sha256=${signature}` },
        body: payload,
        signal: AbortSignal.timeout(30_000),
      });
      const result = await response.json().catch(() => ({})) as DispatchResult;
      if (!response.ok) throw new Error(result.failureReason || `Dispatcher HTTP ${response.status}`);
      const state = String(result.state || 'SUBMITTED').toUpperCase();
      const published = new Set(['PUBLISHED', 'POSTED', 'COMPLETED']).has(state);
      if (published && !result.remotePostId) throw new Error('Dispatcher claimed publication without a remote post ID');
      return this.prisma.publishTask.update({
        where: { id: task.id },
        data: { status: published ? 'published' : 'submitted_unconfirmed', platform_post_id: result.remotePostId ?? null, platform_post_url: result.remotePostUrl ?? null, completed_at: published ? new Date() : null, error_details: { remote_state: state } },
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Publishing dispatcher failed';
      this.logger.error(`Task ${task.id} dispatch failed: ${reason}`);
      await this.prisma.publishTask.update({ where: { id: task.id }, data: { status: 'failed', error_code: 'DISPATCH_FAILED', error_message: reason.slice(0, 500), completed_at: new Date() } });
      throw error;
    }
  }
}
