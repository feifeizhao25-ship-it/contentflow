/**
 * 「为你推荐」排序：纯函数，同样的输入得到同样的结果。
 *
 * 只用账号自己有的：在哪些平台有账号 / 发过内容、人设里写的账号定位、关注的主题、读过哪些；
 * 以及规则库自己的变化（审核通过的「更新」）。不使用其它租户的任何数据，也不猜测没写过的东西。
 * 打分（加法，原因逐条写给用户看）：
 *   关注的主题 +5   条目标明适用的平台正是你发布的平台 +5   你发布的平台有直播功能（直播类）+3
 *   账号定位里提到相关词 +3   所有发布者都要知道的（广告标识）+1   读过同类 +1（上限 +2）
 *   最近 14 天更新 +2 / 上次来访之后更新 +3（只对相关或看过旧版的人）   上次来访之后新增 +2
 *   读过这一条 −6（14 天内）   最近 3 天推荐过 −1.5、7 天内 −1（只轮换，不压过相关度）   静音主题：不出现
 */
import { createHash } from 'crypto';
import { Decision } from './live/display';
import { LibEntry, daysBetween, dayStr, parseDay } from './live/util';

export interface Topic {
  id: string;
  name: string;
  categories: string[];
  /** 账号定位里出现这些词就算相关（只匹配用户自己写的文字） */
  keywords: string[];
}

export const TOPICS: Topic[] = [
  { id: 'ad', name: '广告标识', categories: ['广告标识'], keywords: ['带货', '好物', '种草', '测评', '推广', '广告', '探店'] },
  { id: 'ai', name: 'AI 标识', categories: ['AI 标识'], keywords: ['AI', 'ai', '数字人', '虚拟', '人工智能', '深度合成'] },
  { id: 'health', name: '健康食品宣传', categories: ['健康食品宣传'], keywords: ['养生', '保健', '食品', '美食', '营养', '健康', '中医', '药食', '减脂', '食谱'] },
  { id: 'minors', name: '未成年人', categories: ['未成年人'], keywords: ['学生', '儿童', '青少年', '亲子', '母婴', '早教', '校园', '考试'] },
  { id: 'live', name: '直播营销', categories: ['直播营销'], keywords: ['直播', '连麦', '带货'] },
];
export const TOPIC_BY_ID = new Map(TOPICS.map((t) => [t.id, t]));
const CATEGORY_TOPIC = new Map(TOPICS.flatMap((t) => t.categories.map((c) => [c, t.id] as const)));

export const PLATFORM_NAMES: Record<string, string> = { douyin: '抖音', xiaohongshu: '小红书', xhs: '小红书', bilibili: 'B站', weibo: '微博', kuaishou: '快手', wechat_mp: '微信公众号', weixin: '微信', channels: '视频号', zhihu: '知乎' };
/** 平台本身有直播功能（公开事实）。 */
export const LIVE_PLATFORMS = new Set(['douyin', 'kuaishou', 'bilibili', 'xiaohongshu', 'xhs', 'weibo', 'channels']);

export const topicOf = (e: { category?: string }): string => CATEGORY_TOPIC.get(e.category ?? '') ?? 'other';
const pname = (p: string) => PLATFORM_NAMES[p] ?? p;
export const RECENT_UPDATE_DAYS = 14;

export interface Signals {
  enabled: boolean;
  today: number; // 上海当天 00:00 UTC 毫秒
  platforms: string[]; // 已绑定账号 / 近期发布 / 默认平台（去重）
  positioning: string; // 人设说明 + 配置里的定位文字（账号自己写的）
  followed: string[];
  muted: string[];
  opened: Record<string, string>; // id → 日期
  shown: Record<string, string>;
  lastVisit: string | null;
}

export interface AnnotatedEntry extends LibEntry {
  display: Decision;
}

export interface FeedItem {
  id: string;
  title: string;
  summary: string;
  category: string;
  topic: string;
  topic_name: string;
  reason: string;
  reason_codes: string[];
  badge: 'new' | 'updated' | null;
  badges: Decision['badges'];
  change_note: string | null;
  last_verified_at: string | null;
  updated_on: string | null;
  status: string;
  source: { title?: string; publisher?: string; url?: string; doc_no?: string };
  score: number;
}

export interface Feed {
  enabled: boolean;
  items: FeedItem[];
}

const noise = (user: string, day: number, id: string): number => {
  const h = createHash('sha256').update(`${user}|${dayStr(day)}|${id}`).digest();
  return (h.readUInt32BE(0) / 2 ** 32) * 0.9;
};

type Part = [string, string];

function reason(parts: Part[]): string {
  if (!parts.length) return '发布前的通用参考';
  const f: Record<string, (v: string) => string> = {
    follow: (v) => `你关注了「${TOPIC_BY_ID.get(v)?.name ?? v}」`,
    platform: (v) => `你在${v}发布，这条写明了适用的平台`,
    live: (v) => `你在${v}发布，这些平台有直播功能`,
    position: (v) => `你的账号定位里提到「${v}」`,
    general: () => '所有发布者都要知道的基础规则',
    read: () => '你读过同类内容',
    updated: () => '规则有更新，可能影响你',
    new: () => '上次来之后新增的',
  };
  return parts.map(([k, v]) => f[k](v)).join('；');
}

function matchKeyword(text: string, topic: Topic): string | null {
  for (const k of topic.keywords) if (k && text.includes(k)) return k;
  return null;
}

export function rank(items: AnnotatedEntry[], sig: Signals, userKey: string, limit = 6): Feed {
  if (!sig.enabled) return { enabled: false, items: [] };
  const topicById = new Map(items.map((e) => [e.id, topicOf(e)]));
  const ref = parseDay(sig.lastVisit) ?? sig.today - 14 * 86_400_000;
  const opened = new Map(Object.entries(sig.opened).map(([k, v]) => [k, parseDay(v)] as const));
  const shown = new Map(Object.entries(sig.shown).map(([k, v]) => [k, parseDay(v)] as const));
  const scored: { s: number; e: AnnotatedEntry; parts: Part[]; codes: string[]; badge: 'new' | 'updated' | null; t: string }[] = [];
  for (const e of items) {
    if (!e.display.feed_eligible) continue;
    const t = topicOf(e);
    if (sig.muted.includes(t)) continue;
    let s = 0;
    const parts: Part[] = [];
    const codes: string[] = [];
    if (sig.followed.includes(t)) {
      s += 5;
      parts.push(['follow', t]);
      codes.push('follow');
    }
    const hit = (e.platforms ?? []).find((p) => sig.platforms.includes(p));
    if (hit) {
      s += 5;
      parts.push(['platform', pname(hit)]);
      codes.push('platform');
    }
    const live = t === 'live' ? sig.platforms.find((p) => LIVE_PLATFORMS.has(p)) : undefined;
    if (live) {
      s += 3;
      parts.push(['live', pname(live)]);
      codes.push('live');
    }
    const topic = TOPIC_BY_ID.get(t);
    const kw = topic ? matchKeyword(sig.positioning, topic) : null;
    if (kw) {
      s += 3;
      parts.push(['position', kw]);
      codes.push('position');
    }
    if (t === 'ad') {
      s += 1;
      parts.push(['general', '']);
      codes.push('general');
    }
    const sameReads = [...opened.keys()].filter((id) => id !== e.id && topicById.get(id) === t).length;
    if (sameReads) {
      s += Math.min(2, sameReads);
      parts.push(['read', '']);
      codes.push('read');
    }
    let badge: 'new' | 'updated' | null = null;
    const appr = parseDay(e.approved_at);
    const upd = parseDay(e.updated_on);
    const relevant = s >= 3 || e.id in sig.opened; // 只被推荐过不算「看过旧版」，真点开读过才算
    if (appr !== null && appr > ref) {
      badge = 'new';
      s += relevant ? 2 : 1;
      parts.push(['new', '']);
      codes.push('new');
    } else if (upd !== null && relevant && upd > ref) {
      badge = 'updated';
      s += 3;
      parts.push(['updated', '']);
      codes.push('updated');
    } else if (upd !== null && relevant && daysBetween(sig.today, upd) <= RECENT_UPDATE_DAYS) {
      s += 2;
      parts.push(['updated', '']);
      codes.push('updated');
    }
    const o = opened.get(e.id);
    if (o && daysBetween(sig.today, o) <= 14 && badge !== 'updated') s -= 6;
    const sh = shown.get(e.id);
    if (sh && sh < sig.today) {
      const age = daysBetween(sig.today, sh);
      s -= age <= 3 ? 1.5 : age <= 7 ? 1 : 0; // 轻微轮换：只是换个顺序，不压过账号相关度（+3）
    }
    s += noise(userKey, sig.today, e.id);
    scored.push({ s, e, parts, codes, badge, t });
  }
  scored.sort((a, b) => b.s - a.s || a.e.id.localeCompare(b.e.id));
  return {
    enabled: true,
    items: scored.slice(0, limit).map(({ s, e, parts, codes, badge, t }) => ({
      id: e.id,
      title: e.title,
      summary: e.summary,
      category: e.category,
      topic: t,
      topic_name: TOPIC_BY_ID.get(t)?.name ?? '',
      reason: reason(parts),
      reason_codes: codes,
      badge,
      badges: e.display.badges,
      change_note: e.display.change_note,
      last_verified_at: e.display.last_verified_at,
      updated_on: (e.updated_on as string) ?? null,
      status: e.status,
      source: { title: e.source?.title, publisher: e.source?.publisher, url: e.source?.url, doc_no: e.source?.doc_no },
      score: Math.round(s * 100) / 100,
    })),
  };
}

export interface HomeCard {
  id: 'library_for_you';
  kind: 'library';
  title: string;
  description: string;
  reason: string;
  href: string;
  entry_id: string;
}

/** 首页只放一张：有「新增/更新」或匹配度很高才出现，否则不打扰。 */
export function homeCard(feed: Feed): HomeCard | null {
  if (!feed.enabled || !feed.items.length) return null;
  const pick = feed.items.find((i) => i.badge) ?? (feed.items[0].score >= 5 ? feed.items[0] : null);
  if (!pick) return null;
  const title = pick.badge === 'updated' ? `规则库有更新：${pick.title}` : pick.badge === 'new' ? `规则库新增：${pick.title}` : `为你选了一条：${pick.title}`;
  return { id: 'library_for_you', kind: 'library', title, description: pick.summary, reason: pick.reason, href: '/rules', entry_id: pick.id };
}
