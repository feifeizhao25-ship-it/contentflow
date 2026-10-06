'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Button, Segmented, Skeleton } from 'antd';
import { apiClient } from '@/lib/api-client';
import { parseAnalyticsOverview, type AnalyticsOverview } from '@/lib/page-data';
import { AiUsage, EngagementPlaceholder, FailureReasons, PublishStats } from '@/components/analytics/OwnDataOverview';

/**
 * 数据分析：只用自有数据（发布任务、内容、AI 生成记录），时间按北京时间。
 * 原来整页是写死的假数据（爆款结论、互动率、涨粉、播放曲线）。
 */
export default function AnalyticsPage() {
    const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
    const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
    const [range, setRange] = useState<'week' | 'month'>('week');

    const load = useCallback(async () => {
        setState('loading');
        try {
            const result = await apiClient.get<any>('/analytics/overview');
            const parsed = parseAnalyticsOverview(result);
            setOverview(parsed);
            setState(parsed ? 'ready' : 'error');
        } catch {
            setState('error');
        }
    }, []);

    useEffect(() => { void load(); }, [load]);

    const period = overview ? overview[range] : null;
    const empty = period ? period.publish.total === 0 && period.ai.generations === 0 : false;

    return (
        <div className="mx-auto w-full max-w-6xl min-w-0 space-y-5 px-4 py-6 sm:px-6">
            <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0">
                    <h1 className="text-2xl font-black">数据分析</h1>
                    <p className="mt-1 text-sm leading-6 text-zinc-500">只统计分发侠里的自有数据：发布任务、内容与 AI 生成记录。时间按北京时间计算。</p>
                </div>
                <Segmented
                    value={range}
                    onChange={(value) => setRange(value as 'week' | 'month')}
                    options={[{ label: '本周', value: 'week' }, { label: '本月', value: 'month' }]}
                />
            </header>

            {state === 'loading' && <Skeleton active paragraph={{ rows: 6 }} />}

            {state === 'error' && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-800">
                    <p>数据加载失败，请稍后重试。</p>
                    <Button className="mt-3" onClick={() => void load()}>重试</Button>
                </div>
            )}

            {state === 'ready' && overview && period && (
                <>
                    {empty && (
                        <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-5 text-sm text-indigo-800">
                            {range === 'week' ? '本周' : '本月'}还没有发布任务或 AI 生成记录。
                            <Link href="/studio" className="ml-1 font-bold underline">去创作第一篇</Link>
                        </div>
                    )}
                    <PublishStats period={period} />
                    <div className="grid min-w-0 gap-4 lg:grid-cols-2">
                        <AiUsage period={period} label={range === 'week' ? '本周' : '本月'} />
                        <FailureReasons reasons={overview.failureReasons} />
                    </div>
                    <EngagementPlaceholder engagement={overview.engagement} />
                </>
            )}
        </div>
    );
}
