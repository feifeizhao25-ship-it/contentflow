import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { checkContent, REASONS, ReasonCode, RECEIVER_PATH } from './template-page-receiver';

export interface ReceiveResult {
  status: number;
  body: Record<string, unknown>;
}

const ACTION = 'template_page_receive';
const ACTOR = 'ops_hub';

export function rejection(reason: ReasonCode, extra: Record<string, unknown> = {}): ReceiveResult {
  const { status, message } = REASONS[reason];
  return { status, body: { success: false, accepted: false, reason, message, failed: [reason], ...extra } };
}

/**
 * 四件事（批准单哈希、上海时间窗、AIGC 标识、只追加审计）都满足才存。存储和审计同一个事务：审计写不进去就什么都不存。
 * 只调用 create / findUnique，不调用 update / delete；数据库触发器也拒绝改和删。
 */
@Injectable()
export class TemplatePageReceiverService {
  private readonly logger = new Logger(TemplatePageReceiverService.name);
  constructor(private readonly prisma: PrismaService) {}

  async receive(payload: unknown, now: Date): Promise<ReceiveResult> {
    const checked = checkContent(payload, now);
    if (checked.failed.length > 0) {
      const primary = checked.failed[0];
      await this.auditRejection(primary, checked.failed, checked.sha);
      const base = rejection(primary, { content_sha256: checked.sha || undefined });
      return { status: base.status, body: { ...base.body, failed: checked.failed } };
    }
    const { content, sha, approval } = checked;
    const approvalId = approval && typeof approval.id === 'string' ? approval.id.slice(0, 200) : null;
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.growthTemplatePageSubmission.findUnique({ where: { content_sha256: sha } });
        if (existing) {
          await tx.growthPublishReceiveAudit.create({
            data: { action: ACTION, decision: 'duplicate', reason: 'already_received', content_sha256: sha, submission_id: existing.id, detail: { path: RECEIVER_PATH, actor: ACTOR, approval_id: approvalId } },
          });
          return { status: 200, body: this.accepted(existing.id, sha, true) };
        }
        const row = await tx.growthTemplatePageSubmission.create({
          data: {
            content_sha256: sha,
            approval_id: approvalId,
            title: String(content.title),
            body: String(content.body),
            url: typeof content.url === 'string' ? content.url : null,
            content_json: content as object,
            status: 'received',
          },
        });
        await tx.growthPublishReceiveAudit.create({
          data: { action: ACTION, decision: 'accepted', reason: 'ok', content_sha256: sha, submission_id: row.id, detail: { path: RECEIVER_PATH, actor: ACTOR, approval_id: approvalId } },
        });
        return { status: 201, body: this.accepted(row.id, sha, false) };
      });
    } catch (error) {
      this.logger.error(`template-page receive failed: ${error instanceof Error ? error.name : 'unknown'}`);
      return rejection('audit_unavailable', { content_sha256: sha });
    }
  }

  private accepted(id: string, sha: string, duplicate: boolean): Record<string, unknown> {
    return {
      success: true,
      accepted: true,
      id,
      url: null,
      content_sha256: sha,
      stored: true,
      published: false,
      duplicate,
      note: '已存进分发侠后台，未上线、未转发到任何外部平台',
    };
  }

  /** 拒绝也写审计；写不进去不影响拒绝本身。 */
  private async auditRejection(reason: ReasonCode, failed: ReasonCode[], sha: string): Promise<void> {
    try {
      await this.prisma.growthPublishReceiveAudit.create({
        data: { action: ACTION, decision: 'rejected', reason, content_sha256: sha || null, detail: { path: RECEIVER_PATH, actor: ACTOR, failed } },
      });
    } catch (error) {
      this.logger.warn(`template-page rejection audit failed: ${error instanceof Error ? error.name : 'unknown'}`);
    }
  }
}
