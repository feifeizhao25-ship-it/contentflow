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
  status: 'scheduled' | 'published' | 'failed' | 'cancelled';
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
    platforms: t.platform_account?.platform ? [t.platform_account.platform] : [],
    status: t.status === 'published' ? 'published'
      : t.status === 'failed' ? 'failed'
        : t.status === 'cancelled' ? 'cancelled'
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
  aiCallsThisMonth: number | null;
}

/** 设置页「套餐与用量」：只用后端返回的工作区限额与用量，缺什么就不显示什么。 */
export function describePlan(tenant: any): PlanView {
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
  const ai = Number(used?.ai_calls_this_month);
  return { name: PLAN_NAMES[plan] ?? plan, renewText, usage, aiCallsThisMonth: used && Number.isFinite(ai) ? ai : null };
}
