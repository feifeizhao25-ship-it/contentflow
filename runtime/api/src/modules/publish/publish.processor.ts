import { createHmac } from 'node:crypto';
import { Process, Processor } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Job } from 'bull';
import { PrismaService } from '../../database/prisma.service';
import type { PublishJobData } from '../../queue/publish-queue.service';
import { AI_TEXT_LABEL, buildAiMediaMetadata, labelAiGeneratedText } from '../../common/ai-content-label';
import { evaluateDomesticContent } from '../../common/domestic-content-compliance';

interface DispatchResult { state?: string; remotePostId?: string; remotePostUrl?: string; failureReason?: string }

/** 已经有结论（或已交给分发器）的任务：队列重投递时不能再发一次。 */
const TERMINAL_STATUSES = ['cancelled', 'published', 'submitted_unconfirmed'];

class DispatchRefused extends Error {
  constructor(message: string, readonly code: string) { super(message); }
}

@Injectable()
@Processor('publish-queue')
export class PublishProcessor {
  private readonly logger = new Logger(PublishProcessor.name);
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}

  /** 国际版保持英文原文；国内版一律中文（失败原因会展示给用户）。 */
  private text(en: string, zh: string): string {
    return this.config.get<string>('MARKET_REGION') === 'global' ? en : zh;
  }

  @Process()
  async dispatch(job: Job<PublishJobData>) {
    const webhookUrl = this.config.get<string>('PUBLISH_DISPATCH_WEBHOOK_URL', '');
    const webhookSecret = this.config.get<string>('PUBLISH_DISPATCH_WEBHOOK_SECRET', '');
    if (!webhookUrl || !webhookSecret) throw new Error(this.text('Production publishing dispatcher is not configured', '发布分发通道未配置，任务无法发出'));
    if (webhookSecret.length < 32) throw new Error(this.text('Publishing dispatcher secret must contain at least 32 characters', '发布分发通道的签名密钥至少需要 32 个字符'));
    if (new URL(webhookUrl).protocol !== 'https:') throw new Error(this.text('Publishing dispatcher must use HTTPS', '发布分发通道必须使用 HTTPS'));
    const task = await this.prisma.publishTask.findFirst({
      where: { id: job.data.taskId },
      include: { content: true, platform_account: { select: { id: true, platform: true, account_name: true, account_nickname: true, platform_account_id: true } } },
    });
    if (!task || !task.platform_account) throw new Error(this.text('Publish task or platform account not found', '发布任务或平台账号不存在'));

    // 用户取消、或已经发出过：队列里的作业仍会被执行 / 重投递，必须在这里挡住。
    if (TERMINAL_STATUSES.includes(task.status)) {
      this.logger.warn(`Task ${task.id} is ${task.status}; dispatch skipped`);
      return null;
    }

    const content = task.content as any;
    try {
      this.assertDispatchable(content);
    } catch (error) {
      const refused = error as DispatchRefused;
      await this.prisma.publishTask.update({
        where: { id: task.id },
        data: { status: 'failed', error_code: refused.code, error_message: refused.message.slice(0, 500), completed_at: new Date() },
      });
      throw refused;
    }

    // 有条件地抢占：判断状态与写入之间用户可能刚点了取消。
    const claimed = await this.prisma.publishTask.updateMany({
      where: { id: task.id, status: { notIn: TERMINAL_STATUSES } },
      data: { status: 'processing', started_at: new Date(), error_message: null },
    });
    if (claimed.count === 0) {
      this.logger.warn(`Task ${task.id} changed state before dispatch; skipped`);
      return null;
    }

    const isAi = content.source === 'ai';
    const payload = JSON.stringify({
      schemaVersion: 1, idempotencyKey: `contentflow:${task.id}`, taskId: task.id,
      tenantId: task.tenant_id, marketRegion: this.config.get<string>('MARKET_REGION'),
      scheduledAt: task.scheduled_at?.toISOString(), account: task.platform_account,
      content: {
        id: content.id, title: content.title,
        // AI 生成内容：显式标识随正文一起发出，不能在分发这一步丢掉（幂等，不重复叠加）。
        body: isAi && content.body ? labelAiGeneratedText(content.body) : content.body,
        bodyHtml: isAi && content.body_html && !String(content.body_html).includes(AI_TEXT_LABEL)
          ? `<p>${AI_TEXT_LABEL}</p>${content.body_html}` : content.body_html,
        coverUrl: content.cover_url, mediaUrls: content.media_urls, tags: content.tags,
        // 隐式标识：机器可读的 AI 生成元数据，分发器必须原样写入目标平台的 AI 生成声明字段。
        aiGenerated: isAi,
        ...(isAi ? { aiLabel: AI_TEXT_LABEL, aiMetadata: buildAiMediaMetadata({ mediaType: 'text', model: content.ai_model ?? undefined, contentId: content.id }) } : {}),
      },
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
      if (!response.ok) throw new Error(this.dispatcherFailure(result, response.status));
      const state = String(result.state || 'SUBMITTED').toUpperCase();
      const published = new Set(['PUBLISHED', 'POSTED', 'COMPLETED']).has(state);
      if (published && !result.remotePostId) throw new Error(this.text('Dispatcher claimed publication without a remote post ID', '分发通道声称已发布，但没有返回平台上的内容编号，无法确认发布结果'));
      return this.prisma.publishTask.update({
        where: { id: task.id },
        data: { status: published ? 'published' : 'submitted_unconfirmed', platform_post_id: result.remotePostId ?? null, platform_post_url: result.remotePostUrl ?? null, completed_at: published ? new Date() : null, error_details: { remote_state: state } },
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : this.text('Publishing dispatcher failed', '发布分发通道调用失败');
      this.logger.error(`Task ${task.id} dispatch failed: ${reason}`);
      await this.prisma.publishTask.update({ where: { id: task.id }, data: { status: 'failed', error_code: 'DISPATCH_FAILED', error_message: reason.slice(0, 500), completed_at: new Date() } });
      throw error;
    }
  }

  /** 发出前的最后一道检查：内容还在、（国内版）仍能通过六道闸。 */
  private assertDispatchable(content: any): void {
    if (!content || content.status === 'deleted') {
      throw new DispatchRefused(this.text('The content was deleted before publishing', '内容已被删除，未发出'), 'CONTENT_DELETED');
    }
    if (this.config.get<string>('MARKET_REGION') !== 'global') {
      const compliance = evaluateDomesticContent([content.title, content.body, content.body_html].filter(Boolean).join('\n'));
      if (!compliance.passed) {
        const terms = compliance.hits.flatMap((hit) => hit.matchedTerms).slice(0, 5).join('、');
        throw new DispatchRefused(`内容未通过发布前六道闸合规检查（命中：${terms}），未发出，请修改后重新提交`, 'CONTENT_COMPLIANCE_BLOCKED');
      }
    }
  }

  private dispatcherFailure(result: DispatchResult, status: number): string {
    if (this.config.get<string>('MARKET_REGION') === 'global') return result.failureReason || `Dispatcher HTTP ${status}`;
    // 国内版：分发器给的原因只有本身是中文才原样展示，否则用通用中文说明，不露出状态码原文。
    const reason = typeof result.failureReason === 'string' ? result.failureReason : '';
    return /[一-鿿]/.test(reason) ? reason : `发布分发通道返回失败（状态码 ${status}），稍后会自动重试`;
  }
}
