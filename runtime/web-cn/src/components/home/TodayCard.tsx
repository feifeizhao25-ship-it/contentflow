'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { tryLoad } from '@/lib/library-live';

export interface TodayData {
    generated_for: string;
    signals: { accounts: number; content_7d: number; published_7d: number; failed_7d: number; pending_review: number; scheduled_upcoming: number };
    next_step: { id: string; title: string; description: string; href: string; reason: string };
}

/** 工作台首页「今天先做什么」：只用你账号自己的真实活动，随你的操作变化；接口连不上就不显示。 */
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
    return (
        <Link href={n.href} className="block rounded-[24px] border border-emerald-100 bg-emerald-50/60 px-5 py-4" data-testid="today-card">
            <p className="text-xs font-bold text-emerald-700">今天先做什么</p>
            <p className="mt-1 font-bold text-zinc-900 leading-snug">{n.title}</p>
            <p className="mt-1 text-sm text-zinc-600 leading-6">{n.description}</p>
            <p className="mt-2 text-xs text-emerald-700">依据：{n.reason}（近 7 天：新建 {s.content_7d} · 已发布 {s.published_7d} · 失败 {s.failed_7d}）</p>
        </Link>
    );
}
