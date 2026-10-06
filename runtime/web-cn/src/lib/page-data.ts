/**
 * 页面读取后端数据时的形状转换（纯函数，便于测试）。
 *
 * apiClient 已经把后端的 { success, data } 信封解开，页面拿到的是里面那一层。
 * 各页面此前按「没解开」的形状读（result?.success、res.data），永远读不到东西。
 */
import dayjs from 'dayjs';

const asArray = (value: unknown): any[] => (Array.isArray(value) ? value : []);
const unwrap = (value: any): any => (value && typeof value === 'object' && value.success === true && 'data' in value ? value.data : value);

/** 内容库：GET /contents → { contents, pagination } */
export function parseContentList(result: unknown): Array<Record<string, any>> {
  const payload = unwrap(result);
  return asArray(payload?.contents).map((item) => ({
    ...item,
    key: item.id,
    type: item.content_type,
    created_at: item.created_at ? new Date(item.created_at).toLocaleString('zh-CN') : '',
  }));
}

export interface CalendarTask {
  id: string;
  title: string;
  date: string;
  time: string;
  platforms: string[];
  status: 'scheduled' | 'published' | 'failed' | 'cancelled' | 'manual_pending' | 'manual_done';
  thumbnail?: string;
  account?: string;
}

/** 发布日历：GET /publish/tasks → { tasks, pagination }；平台在 platform_account.platform。 */
export function mapPublishTasks(result: unknown): CalendarTask[] {
  const payload = unwrap(result);
  return asArray(payload?.tasks).map((t) => ({
    id: t.id,
    title: t.content?.title || '未命名内容',
    date: dayjs(t.scheduled_at).format('YYYY-MM-DD'),
    time: dayjs(t.scheduled_at).format('HH:mm'),
    platforms: t.platform_account?.platform ? [t.platform_account.platform]
      : t.platform_content?.platform ? [t.platform_content.platform] : [],
    status: t.status === 'published' ? 'published'
      : t.status === 'failed' ? 'failed'
        : t.status === 'cancelled' ? 'cancelled'
          : t.status === 'manual_pending' ? 'manual_pending'
            : t.status === 'manual_done' ? 'manual_done'
              : 'scheduled',
    thumbnail: t.content?.cover_url ?? undefined,
    account: t.platform_account?.account_nickname || t.platform_account?.account_name || undefined,
  }));
}

export interface HotTopicRow {
  id: string;
  title: string;
  heat: number;
  platform: string;
  prediction: 'rising' | 'stable';
  tags: string[];
}

/** 热点页：GET /hot/list → { available, topics, message }。没有数据源就如实说明，不补任何热点。 */
export function parseHotTopics(result: unknown): { topics: HotTopicRow[]; notice: string } {
  const payload = unwrap(result);
  const topics = asArray(payload?.topics).map((t, i) => ({
    id: String(t.id ?? i),
    title: String(t.topic ?? t.title ?? ''),
    heat: Number(t.heat) || 0,
    platform: String(t.platform ?? ''),
    prediction: (t.prediction === 'rising' ? 'rising' : 'stable') as 'rising' | 'stable',
    tags: asArray(t.tags).map(String),
  })).filter((t) => t.title);
  if (topics.length) return { topics, notice: '' };
  const message = payload?.message;
  return { topics: [], notice: typeof message === 'string' && /[一-鿿]/.test(message) ? message : '暂时没有可用的热点数据' };
}

const PLAN_NAMES: Record<string, string> = { free: '免费版', starter: '入门版', pro: '专业版', team: '团队版', enterprise: '企业版' };

export interface PlanView {
  name: string;
  renewText: string;
  usage: Array<{ title: string; current: number; limit: number; unit: string }>;
}

/**
 * 设置页「套餐与用量」：只用后端返回的工作区限额与用量，缺什么就不显示什么。
 * `subscription` 是 GET /billing/subscription 的结果：AI 令牌按月记在 usage_meters，
 * 原来这里读的 usage_stats.ai_calls_this_month 从来没人累加，永远显示「本月 AI 调用 0 次」。
 */
export function describePlan(tenant: any, subscription?: any): PlanView {
  const plan = String(tenant?.plan ?? 'free');
  const expires = tenant?.plan_expires_at ? dayjs(tenant.plan_expires_at) : null;
  const renewText = plan === 'free' || !expires || !expires.isValid()
    ? '免费版长期有效，不会产生账单'
    : `当前套餐有效期至 ${expires.format('YYYY年M月D日')}`;
  const limits = tenant?.limits && typeof tenant.limits === 'object' ? tenant.limits : null;
  const used = tenant?.usage_stats && typeof tenant.usage_stats === 'object' ? tenant.usage_stats : null;
  const usage: PlanView['usage'] = [];
  const add = (title: string, current: unknown, limit: unknown, unit: string, scale = 1) => {
    const c = Number(current), l = Number(limit);
    if (Number.isFinite(c) && Number.isFinite(l) && l > 0) usage.push({ title, current: Math.round((c / scale) * 100) / 100, limit: l, unit });
  };
  if (limits && used) {
    add('账号绑定', used.accounts_count, limits.max_accounts, '个');
    add('本月发布', used.publishes_this_month, limits.max_publishes_monthly, '次');
    add('存储空间', used.storage_used_mb, limits.max_storage_gb, 'GB', 1024);
  }
  if (subscription && typeof subscription === 'object') {
    add('本月 AI 令牌', subscription.usedQuota, subscription.monthlyQuota, '个');
  }
  return { name: PLAN_NAMES[plan] ?? plan, renewText, usage };
}

export interface PublishCounts {
  total: number;
  published: number;
  failed: number;
  inProgress: number;
  manualPending: number;
  manualDone: number;
  cancelled: number;
}

export interface AnalyticsPeriod {
  start: string;
  publish: PublishCounts;
  ai: {
    generations: number;
    byType: Array<{ type: string; label: string; count: number }>;
    savedAsContent: number;
    approvedOrPublished: number;
  };
}

export interface AnalyticsOverview {
  week: AnalyticsPeriod;
  month: AnalyticsPeriod;
  failureReasons: Array<{ reason: string; count: number }>;
  engagement: { available: boolean; message: string; detail: string };
}

const num = (value: unknown) => (Number.isFinite(Number(value)) ? Number(value) : 0);
const CJK_TEXT = /[㐀-鿿]/;

function parsePeriod(raw: any): AnalyticsPeriod {
  const p = raw?.publish ?? {};
  const ai = raw?.ai ?? {};
  return {
    start: String(raw?.start ?? ''),
    publish: {
      total: num(p.total), published: num(p.published), failed: num(p.failed), inProgress: num(p.inProgress),
      manualPending: num(p.manualPending), manualDone: num(p.manualDone), cancelled: num(p.cancelled),
    },
    ai: {
      generations: num(ai.generations),
      byType: asArray(ai.byType).map((r) => ({ type: String(r.type ?? ''), label: CJK_TEXT.test(String(r.label)) ? String(r.label) : '其他', count: num(r.count) })),
      savedAsContent: num(ai.savedAsContent),
      approvedOrPublished: num(ai.approvedOrPublished),
    },
  };
}

/**
 * 数据分析页：GET /analytics/overview。只有自有数据（发布任务、内容、AI 生成记录）；
 * 互动数据在接通平台授权前一律不给数字，页面显示「接通平台授权后显示」。
 */
export function parseAnalyticsOverview(result: unknown): AnalyticsOverview | null {
  const payload = unwrap(result);
  if (!payload || typeof payload !== 'object' || !payload.week || !payload.month) return null;
  const engagement = payload.engagement ?? {};
  return {
    week: parsePeriod(payload.week),
    month: parsePeriod(payload.month),
    failureReasons: asArray(payload.failureReasons)
      .filter((r) => CJK_TEXT.test(String(r?.reason ?? '')))
      .map((r) => ({ reason: String(r.reason), count: num(r.count) })),
    engagement: {
      // 只有后端明确说可用时才可能显示互动数字；当前后端恒为不可用
      available: engagement.available === true,
      message: CJK_TEXT.test(String(engagement.message ?? '')) ? String(engagement.message) : '接通平台授权后显示',
      detail: CJK_TEXT.test(String(engagement.detail ?? '')) ? String(engagement.detail) : '',
    },
  };
}
