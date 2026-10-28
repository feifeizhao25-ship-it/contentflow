'use client';

/**
 * 数据分析页主体：只展示自有数据（发布任务、内容、AI 生成记录）。
 *
 * 原来这里是 ConclusionHero / ContentRankList / ReplayPanel 三个写死的组件
 * （「你最近的爆款来自：反常识开头」「本周发布 12」「互动率 8.5%」「10.2w」）。
 * 本目录里不允许出现写死的指标数字（verify_production_truthfulness.py 会检查）：
 * 所有数字都来自 GET /analytics/overview；互动数据在接通平台授权前只显示「接通平台授权后显示」。
 */
import React from 'react';
import Link from 'next/link';
import type { AnalyticsOverview, AnalyticsPeriod } from '@/lib/page-data';

function StatCard({ label, value, hint, tone = 'default' }: { label: string; value: number; hint?: string; tone?: 'default' | 'good' | 'bad' | 'warn' }) {
    const color = tone === 'good' ? 'text-emerald-600' : tone === 'bad' ? 'text-rose-600' : tone === 'warn' ? 'text-amber-600' : 'text-zinc-900';
    return (
        <div className="min-w-0 rounded-2xl border border-zinc-200 bg-white p-4">
            <p className="truncate text-xs font-medium text-zinc-500">{label}</p>
            <p className={`mt-1 text-2xl font-black tabular-nums ${color}`}>{value}</p>
            {hint && <p className="mt-1 text-xs leading-5 text-zinc-600">{hint}</p>}
        </div>
    );
}

export function PublishStats({ period }: { period: AnalyticsPeriod }) {
    const p = period.publish;
    return (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <StatCard label="发布任务" value={p.total} hint="按计划发布时间统计" />
            <StatCard label="已发布" value={p.published} tone="good" />
            <StatCard label="已人工发布" value={p.manualDone} tone="good" hint="你确认已在平台发出" />
            <StatCard label="待人工发布" value={p.manualPending} tone="warn" />
            <StatCard label="进行中" value={p.inProgress} hint="排队、发布中或待平台确认" />
            <StatCard label="失败" value={p.failed} tone={p.failed ? 'bad' : 'default'} />
        </div>
    );
}

export function FailureReasons({ reasons }: { reasons: AnalyticsOverview['failureReasons'] }) {
    return (
        <section className="min-w-0 rounded-2xl border border-zinc-200 bg-white p-5">
            <h2 className="text-base font-black">本月失败原因</h2>
            {reasons.length === 0 ? (
                <p className="mt-3 text-sm text-zinc-500">本月没有失败的发布任务。</p>
            ) : (
                <ul className="mt-3 space-y-2">
                    {reasons.map((r) => (
                        <li key={r.reason} className="flex items-start justify-between gap-3 text-sm">
                            <span className="min-w-0 break-words text-zinc-700">{r.reason}</span>
                            <span className="shrink-0 font-bold tabular-nums text-rose-600">{r.count} 次</span>
                        </li>
                    ))}
                </ul>
            )}
            <Link href="/publish" className="mt-4 inline-block text-sm font-bold text-indigo-600 hover:underline">去发布中心处理</Link>
        </section>
    );
}

export function AiUsage({ period, label }: { period: AnalyticsPeriod; label: string }) {
    const ai = period.ai;
    return (
        <section className="min-w-0 rounded-2xl border border-zinc-200 bg-white p-5">
            <h2 className="text-base font-black">{label} AI 生成与采纳</h2>
            <p className="mt-3 text-sm text-zinc-700">
                生成 <b className="tabular-nums">{ai.generations}</b> 次；保存进内容库 <b className="tabular-nums">{ai.savedAsContent}</b> 篇，
                其中已通过审核或已发布 <b className="tabular-nums">{ai.approvedOrPublished}</b> 篇。
            </p>
            {ai.byType.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                    {ai.byType.map((t) => (
                        <span key={t.type} className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">{t.label} {t.count} 次</span>
                    ))}
                </div>
            )}
            <p className="mt-3 text-xs leading-5 text-zinc-600">「采纳」按 AI 生成后保存进内容库的篇数计，不代表平台上的表现。</p>
        </section>
    );
}

export function EngagementPlaceholder({ engagement }: { engagement: AnalyticsOverview['engagement'] }) {
    return (
        <section className="min-w-0 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-5">
            <h2 className="text-base font-black">播放、互动与涨粉</h2>
            <p className="mt-2 text-lg font-black text-zinc-800 dark:text-zinc-100">{engagement.message}</p>
            {engagement.detail && <p className="mt-2 text-sm leading-6 text-zinc-500">{engagement.detail}</p>}
            <Link href="/accounts" className="mt-3 inline-block text-sm font-bold text-indigo-600 hover:underline">查看平台授权状态</Link>
        </section>
    );
}
