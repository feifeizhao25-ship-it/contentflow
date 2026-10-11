/**
 * 发布中心的筛选条件、批量重试、导出日志（纯函数 + 下载封装）。
 *
 * 原来 TaskFilterBar 的搜索框、平台 / 状态 / 日期筛选、「批量重试」「导出日志」都没有绑定事件，
 * 点了没反应。现在筛选条件统一转成后端 GET /publish/tasks 的查询串，导出用同一份查询串，
 * 保证「看到的」和「导出的」是同一批任务。
 */
import { apiErrorText } from './api-error';

export interface PublishFilter {
  keyword: string;
  platforms: string[];
  /** 'all' 或后端认识的状态分组：success / in_progress / failed / manual_pending / manual_done / cancelled */
  status: string;
  /** 北京日期 YYYY-MM-DD，含首尾 */
  from?: string;
  to?: string;
}

export const EMPTY_PUBLISH_FILTER: PublishFilter = { keyword: '', platforms: [], status: 'all' };

export const PUBLISH_FILTER_PLATFORMS = [
  { value: 'douyin', label: '🎵 抖音' },
  { value: 'bilibili', label: '📺 B站' },
  { value: 'xhs', label: '📕 小红书' },
  { value: 'weixin', label: '💬 视频号' },
  { value: 'wechat_mp', label: '📰 公众号' },
];

export const PUBLISH_FILTER_STATUSES = [
  { value: 'all', label: '全部状态' },
  { value: 'success', label: '✅ 已发布（含人工）' },
  { value: 'in_progress', label: '🔄 排队 / 发布中' },
  { value: 'failed', label: '❌ 发布失败' },
  { value: 'manual_pending', label: '待人工发布' },
  { value: 'manual_done', label: '已人工发布' },
  { value: 'cancelled', label: '已取消' },
];

export function isFilterActive(filter: PublishFilter): boolean {
  return Boolean(filter.keyword.trim() || filter.platforms.length || filter.status !== 'all' || filter.from || filter.to);
}

/** 筛选条件 → 查询串（不含问号）。分页参数只有列表需要，导出不带。 */
export function publishFilterQuery(filter: PublishFilter, paging?: { page: number; pageSize: number }): string {
  const params = new URLSearchParams();
  const keyword = filter.keyword.trim();
  if (keyword) params.set('keyword', keyword);
  if (filter.platforms.length) params.set('platform', filter.platforms.join(','));
  if (filter.status && filter.status !== 'all') params.set('status', filter.status);
  if (filter.from) params.set('from', filter.from);
  if (filter.to) params.set('to', filter.to);
  if (paging) {
    params.set('page', String(paging.page));
    params.set('pageSize', String(paging.pageSize));
  }
  return params.toString();
}

const PLATFORM_CN: Record<string, string> = { douyin: '抖音', bilibili: 'B站', xhs: '小红书', weixin: '视频号', wechat_mp: '公众号', weibo: '微博', kuaishou: '快手' };

/**
 * 任务卡、重试结果里显示的失败原因：只显示中文；旧记录里「平台 douyin …」这类英文平台代码换成中文名。
 */
export function displayFailureReason(reason: unknown): string {
  const text = typeof reason === 'string' ? reason.trim() : '';
  if (!text || !/[㐀-鿿]/.test(text)) return '平台没有返回可识别的原因';
  return text
    .replace(/平台\s*(douyin|bilibili|xhs|weixin|wechat_mp|weibo|kuaishou)\s*/g, (_m, code: string) => PLATFORM_CN[code])
    .replace(/\b(douyin|bilibili|xhs|weixin|wechat_mp|weibo|kuaishou)\b/g, (_m, code: string) => PLATFORM_CN[code]);
}

export interface RetrySummary {
  retried: number;
  failed: Array<{ reason: string; count: number }>;
  text: string;
}

/** POST /publish/tasks/retry 的结果 → 给人看的一句话 + 按原因归类的失败数。 */
export function summarizeRetry(result: any): RetrySummary {
  const results: any[] = Array.isArray(result?.results) ? result.results : [];
  const retried = results.filter((r) => r?.ok).length;
  const counts = new Map<string, number>();
  for (const r of results) {
    if (r?.ok) continue;
    const reason = typeof r?.reason === 'string' && /[㐀-鿿]/.test(r.reason) ? displayFailureReason(r.reason) : '暂时无法重试';
    counts.set(reason, (counts.get(reason) ?? 0) + 1);
  }
  const failed = [...counts.entries()].map(([reason, count]) => ({ reason, count }));
  const notRetried = results.length - retried;
  const text = notRetried === 0
    ? `已重新排队 ${retried} 条任务`
    : retried === 0
      ? `${notRetried} 条任务都没能重试`
      : `已重新排队 ${retried} 条，${notRetried} 条没能重试`;
  return { retried, failed, text };
}

/** 从 Content-Disposition 里取文件名（优先 filename*=UTF-8''…）。 */
export function fileNameFromDisposition(header: string | null, fallback: string): string {
  if (!header) return fallback;
  const star = header.match(/filename\*=UTF-8''([^;]+)/i);
  if (star) {
    try { return decodeURIComponent(star[1].trim()); } catch { /* 用下面的 */ }
  }
  const plain = header.match(/filename="?([^";]+)"?/i);
  return plain ? plain[1] : fallback;
}

/**
 * 下载发布日志 CSV。失败时抛出中文错误；返回是否因条数过多被截断。
 * 只经过同源 /api/v1 代理，登录态由 httpOnly cookie 带上。
 */
export async function downloadPublishLog(filter: PublishFilter): Promise<{ truncated: boolean }> {
  const query = publishFilterQuery(filter);
  let res: Response;
  try {
    res = await fetch(`/api/v1/publish/tasks/export${query ? `?${query}` : ''}`, { credentials: 'include' });
  } catch {
    throw new Error('网络连接失败，请稍后重试');
  }
  if (!res.ok) {
    let body: unknown = null;
    try { body = await res.json(); } catch { /* 非 JSON */ }
    throw new Error(apiErrorText(body) ?? '导出失败，请稍后重试');
  }
  const blob = await res.blob();
  const name = fileNameFromDisposition(res.headers.get('content-disposition'), '发布记录.csv');
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return { truncated: res.headers.get('x-export-truncated') === '1' };
}
