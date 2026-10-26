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

/** 内容的封面：有 cover_url 用它，否则用第一张非视频素材；都没有返回空串（界面不显示图片）。 */
export function contentCoverUrl(record: any): string {
  const cover = typeof record?.cover_url === 'string' ? record.cover_url.trim() : '';
  if (cover) return cover;
  const media = asArray(record?.media_urls).find((u) => typeof u === 'string' && u.trim() && !/\.(mp4|mov|m3u8)(\?|$)/i.test(u));
  return typeof media === 'string' ? media.trim() : '';
}

/**
 * 平台账号列表：GET /accounts 返回的就是数组（apiClient 已拆掉 { success, data } 外层）。
 * 工作室原来按「还带外层」读（res.success / res.data），于是「已绑定账号」永远是 0 个，
 * 抖音、B 站的自动发布任务也因此永远建不出来。
 */
export function parseAccountList(result: unknown): any[] {
  if (Array.isArray(result)) return result;
  const payload = unwrap(result);
  if (Array.isArray(payload)) return payload;
  return asArray(payload?.accounts);
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
  fetchedAt: string;
  source: string;
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
    fetchedAt: typeof t.fetchedAt === 'string' ? t.fetchedAt : (typeof payload?.fetchedAt === 'string' ? payload.fetchedAt : ''),
    source: typeof t.source === 'string' && t.source ? t.source : (typeof payload?.source === 'string' ? payload.source : ''),
  })).filter((t) => t.title);
  if (topics.length) return { topics, notice: '' };
  const message = payload?.message;
  return { topics: [], notice: typeof message === 'string' && /[一-鿿]/.test(message) ? message : '暂时没有可用的热点数据' };
}

/**
 * 「AI 爆款拆解」结果 → 可读的段落。模型可能返回 JSON（键名中文或英文）或纯文本（raw_analysis）。
 * 原来页面拿到结果后只显示一个标题「深度解构报告」，正文一个字都没渲染。
 * 英文键名不上屏（只显示值）；数组、嵌套对象展开成「· 」开头的行。
 */
export function flattenViralAnalysis(analysis: unknown): Array<{ heading: string; lines: string[] }> {
  const CJK = /[一-鿿]/;
  const toLines = (value: unknown, depth = 0): string[] => {
    if (value === null || value === undefined) return [];
    if (typeof value === 'string') return value.trim() ? [value.trim()] : [];
    if (typeof value === 'number' || typeof value === 'boolean') return [String(value)];
    if (Array.isArray(value)) return value.flatMap((v) => toLines(v, depth + 1)).map((l) => (l.startsWith('· ') ? l : `· ${l}`));
    if (typeof value === 'object' && depth < 4) {
      return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) => {
        const inner = toLines(v, depth + 1);
        if (!inner.length) return [];
        return CJK.test(k) && inner.length === 1 ? [`${k}：${inner[0]}`] : CJK.test(k) ? [`${k}：`, ...inner] : inner;
      });
    }
    return [];
  };
  if (typeof analysis === 'string') return analysis.trim() ? [{ heading: '', lines: [analysis.trim()] }] : [];
  if (!analysis || typeof analysis !== 'object') return [];
  const raw = (analysis as any).raw_analysis;
  if (typeof raw === 'string') return raw.trim() ? [{ heading: '', lines: [raw.trim()] }] : [];
  return Object.entries(analysis as Record<string, unknown>)
    .map(([k, v]) => ({ heading: CJK.test(k) ? k : '', lines: toLines(v, 1) }))
    .filter((section) => section.lines.length > 0);
}

const PLAN_NAMES: Record<string, string> = { free: '免费版', starter: '入门版', pro: 'Solo', team: 'Team', enterprise: 'Business' };

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
  const quotaUnconfirmed = subscription?.quotaStatus === 'unconfirmed' || subscription?.aiTokens?.quotaStatus === 'unconfirmed';
  const expires = tenant?.plan_expires_at ? dayjs(tenant.plan_expires_at) : null;
  const renewText = (plan === 'free' || !expires || !expires.isValid()
    ? '免费版长期有效，不会产生账单'
    : `当前套餐有效期至 ${expires.format('YYYY年M月D日')}`)
    + (quotaUnconfirmed ? '。Business 的 AI 令牌额度与平台账号上限待确认，页面不展示未确认数字。' : '');
  const limits = tenant?.limits && typeof tenant.limits === 'object' ? tenant.limits : null;
  const used = tenant?.usage_stats && typeof tenant.usage_stats === 'object' ? tenant.usage_stats : null;
  const usage: PlanView['usage'] = [];
  const add = (title: string, current: unknown, limit: unknown, unit: string, scale = 1) => {
    const c = Number(current), l = Number(limit);
    if (Number.isFinite(c) && Number.isFinite(l) && l > 0) usage.push({ title, current: Math.round((c / scale) * 100) / 100, limit: l, unit });
  };
  if (limits && used) {
    if (!quotaUnconfirmed) add('账号绑定', used.accounts_count, limits.max_accounts, '个');
    add('本月发布', used.publishes_this_month, limits.max_publishes_monthly, '次');
    add('存储空间', used.storage_used_mb, limits.max_storage_gb, 'GB', 1024);
  }
  if (subscription && typeof subscription === 'object' && !quotaUnconfirmed) {
    add('本月 AI 令牌', subscription.usedQuota, subscription.monthlyQuota, '个');
  }
  return { name: PLAN_NAMES[plan] ?? plan, renewText, usage };
}

/** 不把空响应或不可显示的地址当作封面生成成功。 */
export function generatedCoverUrl(response: unknown): string {
  const payload = unwrap(response);
  const value = typeof payload?.url === 'string' ? payload.url.trim() : '';
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' || url.protocol === 'http:') return value;
  } catch { /* 统一给出用户可理解的错误 */ }
  throw new Error('未收到有效的封面图片，请重试；已有封面已保留');
}

export interface AiAllowanceView {
  /** 读不到（未登录、接口失败）时为 false，界面显示「暂时无法读取」，不显示任何数字 */
  available: boolean;
  unlimited: boolean;
  exhausted: boolean;
  /** 一行摘要，例如「本月 AI 额度：已用 1.2万 / 5万 令牌，剩余 3.8万」 */
  summary: string;
  /** 扣减口径说明 */
  rule: string;
}

const formatTokens = (n: number) => {
  if (n >= 10000) {
    const wan = Math.round((n / 10000) * 10) / 10;
    return `${Number.isInteger(wan) ? wan.toFixed(0) : wan}万`;
  }
  return n.toLocaleString('zh-CN');
};

/**
 * 创作工作室「本月 AI 额度」：只用 GET /billing/subscription 的 aiTokens，
 * 与 AI 接口的额度闸是同一个算法（后端 aiTokenAllowance）。
 * 原来这里显示签到积分余额和写死的「单次消耗 5 积分」，与套餐额度无关。
 */
export function describeAiAllowance(subscription: unknown): AiAllowanceView {
  const payload = unwrap(subscription);
  const t = payload?.aiTokens;
  const limit = Number(t?.limit), used = Number(t?.used), remaining = Number(t?.remaining);
  const perImage = Number(t?.imageTokenEquivalent);
  const reserved = Number(t?.reserved);
  const reserveNote = Number.isFinite(reserved) && reserved > 0
    ? `当前有 ${formatTokens(reserved)} 令牌处于生成预占，完成或失败后按实际用量结算或退回。`
    : '生成前会先预占额度，成功后按实际用量结算，失败则退回。';
  const rule = `按实际用量扣减：文案、标题按模型返回的令牌数计${Number.isFinite(perImage) && perImage > 0 ? `，封面每张计 ${perImage.toLocaleString('zh-CN')} 令牌` : ''}；每月 1 日（北京时间）恢复。${reserveNote}`;
  if (!t || typeof t !== 'object' || !Number.isFinite(limit) || !Number.isFinite(used)) {
    return { available: false, unlimited: false, exhausted: false, summary: '本月 AI 额度暂时无法读取', rule };
  }
  if (t.quotaStatus === 'unconfirmed') {
    const left = Number.isFinite(remaining) ? remaining : limit - used;
    if (Number.isFinite(left) && left <= 0) {
      return { available: true, unlimited: false, exhausted: true, summary: `本月 AI 额度已用完（已用 ${formatTokens(used)} 令牌）。Business 额度上限待确认，请联系客服核对。`, rule };
    }
    return { available: true, unlimited: false, exhausted: false, summary: `本月 AI 额度待确认（已用 ${formatTokens(used)} 令牌）。确认前不展示未确认的额度数字。`, rule };
  }
  if (t.unlimited === true || limit === -1) {
    return { available: true, unlimited: true, exhausted: false, summary: `本月 AI 额度：不限量（已用 ${formatTokens(used)} 令牌）`, rule };
  }
  const left = Number.isFinite(remaining) ? Math.max(0, remaining) : Math.max(0, limit - used);
  return {
    available: true,
    unlimited: false,
    exhausted: left <= 0,
    summary: `本月 AI 额度：已用 ${formatTokens(used)} / ${formatTokens(limit)} 令牌，剩余 ${formatTokens(left)}`,
    rule,
  };
}

/**
 * 侧栏底部的套餐卡：读 GET /billing/subscription 的 plan（已按到期时间回落），
 * 原来写死「免费版」，专业版用户也看到「免费版」。读不到时不猜档位。
 */
export function planBadge(subscription: unknown): { name: string; detail: string } {
  const payload = unwrap(subscription);
  const plan = typeof payload?.plan === 'string' ? payload.plan : '';
  if (!plan || !PLAN_NAMES[plan]) return { name: '我的套餐', detail: '查看各档会员权益' };
  if (plan === 'free') return { name: '免费版', detail: '查看各档会员权益' };
  if (typeof payload?.renewalNotice === 'string' && payload.renewalNotice.trim()) {
    return { name: PLAN_NAMES[plan], detail: payload.renewalNotice.trim() };
  }
  const renew = payload?.renewalDate ? dayjs(payload.renewalDate) : null;
  const soon = renew && renew.isValid() && renew.diff(dayjs(), 'day', true) >= 0 && renew.diff(dayjs(), 'day', true) <= 7;
  return {
    name: PLAN_NAMES[plan],
    detail: soon
      ? `将于 ${renew.format('YYYY年M月D日')} 到期，到期后回到免费版。当前不会自动扣款，继续使用请在到期前手动开通。`
      : renew && renew.isValid() ? `有效期至 ${renew.format('YYYY年M月D日')}` : '查看套餐与用量',
  };
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
