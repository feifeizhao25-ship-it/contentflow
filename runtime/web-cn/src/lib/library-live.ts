/**
 * 规则库的「自动更新 + 为你推荐」：前端这一层的纯函数和接口调用。
 *
 * 服务端（api/src/modules/library）决定一条规则能不能当「现行」展示、值不值得推荐给你；
 * 这里只负责：把服务端的结论翻成界面要用的样子，以及连不上服务端时的保守兜底
 * （随应用打包的那份只能当「可能不是最新」的参考，绝不显示成「现行」「核对于」）。
 */
import { apiClient, FriendlyApiError } from './api-client';
import type { RuleEntry } from './rule-library';

export type BadgeKind = 'verified' | 'updated';
export interface LiveBadge {
    kind: BadgeKind;
    text: string;
}
export type DisplayState =
    | 'pending'
    | 'repealed'
    | 'repeal_hold'
    | 'draft'
    | 'unverified'
    | 'source_changed'
    | 'unverifiable'
    | 'review_due'
    | 'current';

export interface LiveDisplay {
    state: DisplayState;
    visible: boolean;
    feed_eligible: boolean;
    current: boolean;
    banner: string | null;
    badges: LiveBadge[];
    change_note: string | null;
    last_verified_at: string | null;
    updated_on: string | null;
}

export type LiveEntry = RuleEntry & { display?: LiveDisplay; badge?: 'new' | 'updated' };

export interface FeedItem {
    id: string;
    title: string;
    summary: string;
    category: string;
    topic: string;
    topic_name: string;
    reason: string;
    badge: 'new' | 'updated' | null;
    badges: LiveBadge[];
    change_note: string | null;
    last_verified_at: string | null;
    updated_on: string | null;
    status: string;
}
export interface TopicState {
    id: string;
    name: string;
    followed: boolean;
    muted: boolean;
}
export interface FeedResponse {
    enabled: boolean;
    items: FeedItem[];
    topics?: TopicState[];
    since?: string | null;
    note?: string;
}
export interface PrefsResponse {
    enabled: boolean;
    followed: string[];
    muted: string[];
    topics: { id: string; name: string }[];
}
export interface HomeCardData {
    title: string;
    description: string;
    reason: string;
    href: string;
    entry_id: string;
}

export const BADGE_TEXT = { new: '上次来访后新增', updated: '上次来访后有更新' } as const;
export const OFFLINE_NOTE = '暂时连不上服务器，下面显示的是随应用保存的版本，可能不是最新，请以官方原文为准。';

/** 服务端挂的提示是否表示「不能当现行用」。 */
export const needsWarning = (e: LiveEntry): boolean => !!e.display && !e.display.current;

/** 离线兜底：已废止的照样不出现；没有服务端结论的条目一律带「可能不是最新」，不给「核对于」。 */
export function offlineEntries(bundled: RuleEntry[], showPending: boolean): LiveEntry[] {
    return bundled
        .filter((e) => e.review_status === '已审核' || (showPending && e.review_status === '待审核'))
        .filter((e) => e.status !== '已废止')
        .map((e) => ({ ...e }));
}

export const libraryApi = {
    entries: () => apiClient.get<{ entries: LiveEntry[]; personalized: boolean }>('/library/entries', { redirectOn401: false }),
    entry: (id: string) => apiClient.get<LiveEntry>(`/library/entries/${encodeURIComponent(id)}`, { redirectOn401: false }),
    feed: () => apiClient.get<FeedResponse>('/library/feed', { redirectOn401: false }),
    homeCard: () => apiClient.get<{ card: HomeCardData | null }>('/library/home-card', { redirectOn401: false }),
    preferences: () => apiClient.get<PrefsResponse>('/library/preferences', { redirectOn401: false }),
    setPreferences: (body: { enabled?: boolean; follow?: string[]; unfollow?: string[]; mute?: string[]; unmute?: string[] }) =>
        apiClient.put<PrefsResponse>('/library/preferences', body),
    visit: () => apiClient.post<{ ok: boolean }>('/library/visit', {}),
    opened: (id: string) => apiClient.post<{ ok: boolean }>(`/library/opened/${encodeURIComponent(id)}`, {}),
};

/** 失败时不打扰用户：返回 null，由调用方决定显示什么。 */
export async function tryLoad<T>(fn: () => Promise<T>): Promise<T | null> {
    try {
        return await fn();
    } catch (e) {
        if (e instanceof FriendlyApiError || e instanceof Error) return null;
        return null;
    }
}

/** 一个主题在设置里的状态文字。 */
export function topicStateText(t: TopicState): string {
    return t.followed ? '已关注' : t.muted ? '已设为不再推荐' : '默认';
}
