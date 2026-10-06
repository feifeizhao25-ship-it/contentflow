/**
 * 内容状态的中文名（唯一出处）。
 *
 * 原来内容库只映射了 draft / pending / pending_review / approved / published，
 * 后端的 rejected（审核驳回）等状态直接把英文「rejected」渲染上屏。
 * 未知状态一律显示「未知状态」，绝不把英文原值上屏。
 */
export const CONTENT_STATUS_LABELS: Record<string, string> = {
    draft: '草稿',
    pending: '待审核',
    pending_review: '待审核',
    approved: '已通过',
    rejected: '已驳回',
    published: '已发布',
    scheduled: '已排期',
    archived: '已归档',
};

export const CONTENT_STATUS_COLORS: Record<string, string> = {
    draft: 'default',
    pending: 'processing',
    pending_review: 'processing',
    approved: 'success',
    rejected: 'error',
    published: 'blue',
    scheduled: 'cyan',
    archived: 'default',
};

export function contentStatusText(status: unknown): string {
    return CONTENT_STATUS_LABELS[String(status ?? '')] ?? '未知状态';
}

export const CONTENT_TYPE_LABELS: Record<string, string> = {
    article: '图文',
    video: '视频',
    image: '图片',
};

export function contentTypeText(type: unknown): string {
    return CONTENT_TYPE_LABELS[String(type ?? '')] ?? '其他';
}
