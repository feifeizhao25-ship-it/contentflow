'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { tryLoad } from '@/lib/library-live';

export interface TodaySuggestion {
    id: string;
    title: string;
    href: string;
    reason: string;
}

export interface TodayPending {
    id: string;
    title: string;
    href: string;
}

export interface TodayData {
    generated_for: string;
    signals: { accounts: number; content_7d: number; published_7d: number; failed_7d: number; pending_review: number; scheduled_upcoming: number };
    next_step: { id: string; title: string; description: string; href: string; reason: string };
    suggestions?: TodaySuggestion[];
    pending_items?: TodayPending[];
}

/** 工作台首页「今天先做什么」：下一步来自你自己的活动；没绑账号时仍展示注册资料能对上的选题，并列出待审核正文。 */
export function TodayCard() {
    const [data, setData] = useState<TodayData | null>(null);
    useEffect(() => {
        let alive = true;
        void tryLoad(() => apiClient.get<TodayData>('/home/today', { redirectOn401: false })).then((r) => alive && setData(r));
        return () => {
            alive = false;
        };
    }, []);
    if (!data) return null;
    const { next_step: n, signals: s } = data;
    const suggestions = Array.isArray(data.suggestions) ? data.suggestions.filter((item) => item?.title && item?.href) : [];
    const pending = Array.isArray(data.pending_items) ? data.pending_items.filter((item) => item?.title && item?.href) : [];
    return (
        <section className="rounded-[24px] border border-emerald-100 bg-emerald-50/60 px-5 py-4 space-y-4" data-testid="today-card">
            <Link href={n.href} className="block">
                <p className="text-xs font-bold text-emerald-700">今天先做什么</p>
                <p className="mt-1 font-bold text-zinc-900 leading-snug">{n.title}</p>
                <p className="mt-1 text-sm text-zinc-600 leading-6">{n.description}</p>
                <p className="mt-2 text-xs text-emerald-700">依据：{n.reason}（近 7 天：新建 {s.content_7d} · 已发布 {s.published_7d} · 失败 {s.failed_7d}）</p>
            </Link>
            {suggestions.length > 0 && (
                <div data-testid="today-suggestions" className="border-t border-emerald-100 pt-3 space-y-2">
                    <p className="text-xs font-bold text-emerald-700">按你的注册资料</p>
                    {suggestions.map((item) => (
                        <Link key={item.id || item.title} href={item.href} className="block">
                            <p className="text-sm font-medium text-zinc-900">{item.title}</p>
                            {item.reason && <p className="text-xs text-zinc-600 leading-5">依据：{item.reason}</p>}
                        </Link>
                    ))}
                </div>
            )}
            {pending.length > 0 && (
                <div data-testid="today-pending" className="border-t border-emerald-100 pt-3 space-y-1">
                    <p className="text-xs font-bold text-emerald-700">待审核</p>
                    {pending.map((item) => (
                        <Link key={item.id} href={item.href} className="block text-sm text-zinc-800">
                            {item.title}
                        </Link>
                    ))}
                </div>
            )}
        </section>
    );
}
