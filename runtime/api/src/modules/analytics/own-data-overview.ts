/**
 * 「数据分析」页只用自有数据（审计 P0-2）：发布任务、内容、AI 生成记录。
 *
 * 原来 /analytics 三个组件全部写死（「本周发布 12」「互动率 8.5%」「本周涨粉 893」「10.2w」）。
 * 平台互动数据（播放、点赞、涨粉）只有接通开放平台授权后才拿得到，在那之前一律不给数字。
 */
import { chinaDayStart, chinaMonthStart } from '../../common/china-period';

/** 北京时间本周一 0 点。 */
export function chinaWeekStart(now: Date | number = Date.now()): Date {
  const dayStart = chinaDayStart(now);
  // dayStart 是北京时间 0 点对应的 UTC 时刻；加 8 小时后的 UTC 星期就是北京时间星期
  const weekday = new Date(dayStart.getTime() + 8 * 3600 * 1000).getUTCDay(); // 0=周日
  const sinceMonday = (weekday + 6) % 7;
  return new Date(dayStart.getTime() - sinceMonday * 86400 * 1000);
}

export const PUBLISH_STATUS_TEXT: Record<string, string> = {
  pending: '待处理',
  queued: '排队中',
  processing: '发布中',
  submitted_unconfirmed: '已提交待平台确认',
  published: '已发布',
  failed: '失败',
  cancelled: '已取消',
  manual_pending: '待人工发布',
  manual_done: '已人工发布',
};

const FAILURE_CODE_TEXT: Record<string, string> = {
  ADAPTER_NOT_INTEGRATED: '该平台尚未完成开放平台接入',
  QUEUE_UNAVAILABLE: '发布队列暂时不可用',
  DISPATCH_FAILED: '发布服务调用失败',
  CONTENT_COMPLIANCE_BLOCKED: '内容未通过发布前合规检查',
};

const CJK = /[㐀-鿿]/;

export type OverviewLang = 'zh' | 'en';

/** 国际版客户端传 ?lang=en；其余一律中文。 */
export function normalizeLang(raw?: string | null): OverviewLang {
  return String(raw ?? '').toLowerCase().startsWith('en') ? 'en' : 'zh';
}

const FAILURE_CODE_TEXT_EN: Record<string, string> = {
  ADAPTER_NOT_INTEGRATED: 'This platform is not connected to its open API yet',
  QUEUE_UNAVAILABLE: 'The publishing queue was temporarily unavailable',
  DISPATCH_FAILED: 'The publishing service call failed',
  CONTENT_COMPLIANCE_BLOCKED: 'Content did not pass the pre-publish compliance check',
};

/**
 * 失败原因：中文版只给中文（后端写的中文原样用；英文原文换成按错误码的中文说明）。
 * 英文版只给英文：按错误码给英文说明；中文原文无法翻译，也不外露，未知时如实说未记录。
 */
export function failureReasonText(code?: string | null, message?: string | null, lang: OverviewLang = 'zh'): string {
  if (lang === 'en') {
    if (code && FAILURE_CODE_TEXT_EN[code]) return FAILURE_CODE_TEXT_EN[code];
    return 'Publishing failed (no specific reason recorded)';
  }
  if (message && CJK.test(message)) return message.slice(0, 80);
  if (code && FAILURE_CODE_TEXT[code]) return FAILURE_CODE_TEXT[code];
  return '发布失败（未记录具体原因）';
}

export const AI_TYPE_TEXT: Record<string, string> = {
  article: '文章',
  titles: '标题',
  script: '分镜脚本',
  image: '封面图片',
  viral_analysis: '爆款分析',
  content_pack: '内容包',
};

export const AI_TYPE_TEXT_EN: Record<string, string> = {
  article: 'Articles',
  titles: 'Titles',
  script: 'Scripts',
  image: 'Cover images',
  viral_analysis: 'Viral analysis',
  content_pack: 'Content packs',
};

export interface PublishSummary {
  total: number;
  published: number;
  failed: number;
  inProgress: number;
  manualPending: number;
  manualDone: number;
  cancelled: number;
}

export function summarizePublish(rows: Array<{ status: string; n: number }>): PublishSummary {
  const sum = (...statuses: string[]) => rows.filter((r) => statuses.includes(r.status)).reduce((s, r) => s + r.n, 0);
  return {
    total: rows.reduce((s, r) => s + r.n, 0),
    published: sum('published'),
    failed: sum('failed'),
    inProgress: sum('pending', 'queued', 'processing', 'submitted_unconfirmed'),
    manualPending: sum('manual_pending'),
    manualDone: sum('manual_done'),
    cancelled: sum('cancelled'),
  };
}

export const ENGAGEMENT_UNAVAILABLE = {
  available: false as const,
  message: '接通平台授权后显示',
  detail: '播放、点赞、评论、涨粉等互动数据只能通过平台开放接口获取。目前抖音、B 站授权尚未开通，小红书、视频号、公众号没有可用的第三方数据接口，所以这里不显示任何互动数字。',
};

export const ENGAGEMENT_UNAVAILABLE_EN = {
  available: false as const,
  message: 'Shown once your platforms are connected',
  detail: 'Views, likes, comments and follower growth can only be read through each platform\'s official API. Those connections are not available yet, so no engagement numbers are shown here.',
};

export function engagementUnavailable(lang: OverviewLang) {
  return lang === 'en' ? ENGAGEMENT_UNAVAILABLE_EN : ENGAGEMENT_UNAVAILABLE;
}

/**
 * 统计窗口：整周（北京时间周一 0 点到下周一 0 点）、整月（1 日 0 点到下月 1 日 0 点）。
 * 发布任务按计划发布时间算，所以本周晚些时候排好的任务也计入「本周」。
 */
export function overviewWindows(now: Date | number = Date.now()) {
  const weekStart = chinaWeekStart(now);
  const monthStart = chinaMonthStart(now);
  const nextMonth = chinaMonthStart(new Date(monthStart.getTime() + 32 * 86400 * 1000));
  return {
    week: { start: weekStart, end: new Date(weekStart.getTime() + 7 * 86400 * 1000) },
    month: { start: monthStart, end: nextMonth },
  };
}
