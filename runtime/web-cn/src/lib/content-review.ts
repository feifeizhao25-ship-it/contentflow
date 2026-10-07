/**
 * 内容库的审核流（纯函数，便于测试）。
 *
 * 草稿 → 提交审核 → 有权限的审核人通过 / 驳回（驳回必须写原因）→ 已通过才能发布。
 * - 作者（创建人）不能审核自己的内容；后端同样拦（POST /contents/:id/review 返回 403）。
 * - 工作区没有作者以外的所有者 / 管理员时，所有者可以「自行确认」（POST /contents/:id/self-confirm），
 *   界面上必须二次确认，后端记录为 self_confirm，并在内容上写明「所有者自行确认」。
 *
 * 原来内容库根本没有「提交审核」按钮，新内容保存为草稿后永远走不到发布。
 */

export interface ReviewPolicy {
  userId: string;
  role: string;
  canReview: boolean;
  canSelfConfirm: boolean;
  otherReviewers: number;
}

export type ContentAction =
  | 'edit'
  | 'submit'
  | 'review' // 通过 / 驳回
  | 'self_confirm'
  | 'publish';

export interface ContentReviewState {
  actions: ContentAction[];
  /** 不能操作时给用户的一句说明（等谁、为什么） */
  hint?: string;
}

export const SELF_CONFIRM_PREFIX = '所有者自行确认';

/** GET /contents/review-policy 的结果；读不到时按「没有任何审核权限」处理（只少给按钮，不多给）。 */
export function parseReviewPolicy(result: unknown): ReviewPolicy | null {
  const p: any = result && typeof result === 'object' && (result as any).success === true ? (result as any).data : result;
  if (!p || typeof p !== 'object' || typeof p.userId !== 'string') return null;
  return {
    userId: p.userId,
    role: String(p.role ?? ''),
    canReview: p.canReview === true,
    canSelfConfirm: p.canSelfConfirm === true,
    otherReviewers: Number(p.otherReviewers) || 0,
  };
}

export function contentReviewState(record: { status?: string; created_by?: string | null }, policy: ReviewPolicy | null): ContentReviewState {
  const status = String(record?.status ?? '');
  const isAuthor = Boolean(policy && record?.created_by && record.created_by === policy.userId);
  switch (status) {
    case 'draft':
      return { actions: ['edit', 'submit'] };
    case 'rejected':
      return { actions: ['edit', 'submit'], hint: '已被驳回，按原因修改后可重新提交审核' };
    case 'pending_review':
    case 'pending': {
      if (!policy) return { actions: [], hint: '等待审核' };
      if (isAuthor) {
        if (policy.canSelfConfirm) return { actions: ['self_confirm'], hint: '工作区只有你有审核权限，可自行确认后发布' };
        return { actions: [], hint: '等待其他所有者或管理员审核（不能审核自己的内容）' };
      }
      if (policy.canReview) return { actions: ['review'] };
      return { actions: [], hint: '等待所有者或管理员审核' };
    }
    case 'approved':
    case 'published':
      return { actions: ['publish'] };
    default:
      return { actions: [] };
  }
}

/** 驳回原因：去掉首尾空格后必须有字，最多 500 字（与后端一致）。 */
export function validateRejectReason(reason: string): string | null {
  const text = (reason ?? '').trim();
  if (!text) return '请填写驳回原因，方便作者修改';
  if (text.length > 500) return '原因不能超过 500 字';
  return null;
}

/** 内容上的审核说明：自行确认的单独标出。 */
export function reviewNote(record: { status?: string; review_comment?: string | null }): { kind: 'rejected' | 'self_confirm' | 'approved'; text: string } | null {
  const comment = typeof record?.review_comment === 'string' ? record.review_comment.trim() : '';
  if (!comment) return null;
  if (record.status === 'rejected') return { kind: 'rejected', text: `驳回原因：${comment}` };
  if (comment.startsWith(SELF_CONFIRM_PREFIX)) return { kind: 'self_confirm', text: comment };
  if (record.status === 'approved' || record.status === 'published') return { kind: 'approved', text: `审核意见：${comment}` };
  return null;
}
