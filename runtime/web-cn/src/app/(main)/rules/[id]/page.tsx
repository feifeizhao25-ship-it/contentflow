'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Tag } from 'antd';
import data from '@/data/rule-library.json';
import { OFFLINE_NOTE, libraryApi, tryLoad, type LiveEntry } from '@/lib/library-live';
import {
    SHOW_PENDING_LIBRARY,
    STATUS_COLOR,
    formatDateZh,
    safeHref,
    visibleEntries,
    type RuleLibraryFile,
} from '@/lib/rule-library';

const library = data as RuleLibraryFile;

export default function RuleDetailPage() {
    const params = useParams<{ id: string }>();
    const id = params?.id;
    const [entry, setEntry] = useState<LiveEntry | null>(null);
    const [state, setState] = useState<'loading' | 'ready' | 'offline'>('loading');
    useEffect(() => {
        if (!id) return;
        let alive = true;
        void tryLoad(() => libraryApi.entry(id)).then((r) => {
            if (!alive) return;
            if (r) {
                setEntry(r);
                setState('ready');
            } else {
                // 连不上服务器：用随应用保存的版本，已废止的不给看，并明说可能不是最新
                const local = visibleEntries(library.entries, SHOW_PENDING_LIBRARY).find((e) => e.id === id && e.status !== '已废止');
                setEntry(local ?? null);
                setState('offline');
            }
        });
        return () => {
            alive = false;
        };
    }, [id]);

    if (state === 'loading') {
        return (
            <main className="p-8 max-w-3xl mx-auto" aria-busy="true">
                <p className="text-zinc-500" data-testid="rule-loading">正在加载…</p>
            </main>
        );
    }

    if (!entry) {
        return (
            <main className="p-8 max-w-3xl mx-auto">
                <div className="glass-card p-10 text-center" data-testid="rule-not-found">
                    <p className="text-lg font-bold">没有找到这条规则</p>
                    <p className="mt-2 text-sm text-zinc-500">它可能还没有通过审核，或者链接已经变化。</p>
                    <Link href="/rules" className="mt-4 inline-block text-sm font-bold text-indigo-600">
                        回到规则库
                    </Link>
                </div>
            </main>
        );
    }

    const href = safeHref(entry.source.url);
    // 已废止、或来源出现废止迹象时：不再当现行规定展示（去掉「现行」标签，正文弱化并说明只供查阅）
    const inactive = entry.display?.state === 'repealed' || entry.display?.state === 'repeal_hold';

    return (
        <main className="p-6 md:p-8 max-w-3xl mx-auto">
            <Link href="/rules" className="text-sm font-bold text-indigo-600">
                ← 规则库
            </Link>

            <div className="mt-4 flex flex-wrap items-center gap-2">
                <Tag color="geekblue">{entry.category}</Tag>
                {inactive ? <Tag color="red" data-testid="rule-inactive-tag">不作为现行规定</Tag> : <Tag color={STATUS_COLOR[entry.status]}>{entry.status}</Tag>}
                {entry.review_status === '待审核' && <Tag color="gold">待审核</Tag>}
            </div>
            <h1 className="text-2xl md:text-3xl font-black mt-3 leading-snug">{entry.title}</h1>
            <p className="mt-3 text-zinc-600 leading-7">{entry.summary}</p>

            {state === 'offline' && (
                <div className="mt-4 rounded-xl border border-zinc-300 bg-zinc-50 px-4 py-3 text-sm text-zinc-700" role="note" data-testid="rule-offline">
                    {OFFLINE_NOTE}
                </div>
            )}

            {entry.display && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                    {entry.display.badges.map((b) => (
                        <Tag key={b.kind} color={b.kind === 'updated' ? 'orange' : 'default'} data-testid={`rule-badge-${b.kind}`}>
                            {b.text}
                        </Tag>
                    ))}
                </div>
            )}
            {entry.display?.banner && (
                <div
                    className={`mt-4 rounded-xl border px-4 py-3 text-sm ${entry.display.state === 'repealed' || entry.display.state === 'repeal_hold' ? 'border-red-300 bg-red-50 text-red-900' : 'border-amber-300 bg-amber-50 text-amber-900'}`}
                    role="note"
                    data-testid="rule-banner"
                >
                    {entry.display.banner}
                </div>
            )}
            {entry.display?.change_note && (
                <div className="mt-4 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-900" role="note" data-testid="rule-change-note">
                    更新说明：{entry.display.change_note}
                </div>
            )}

            {entry.status_note && (
                <div className="mt-4 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-900" role="note">
                    状态说明：{entry.status_note}
                </div>
            )}

            <div className={inactive ? 'opacity-60' : ''} data-testid={inactive ? 'rule-inactive-body' : undefined}>
                <section className="glass-card p-5 mt-6">
                    <h2 className="font-bold text-lg">要点</h2>
                    <ul className="mt-3 list-disc pl-5 space-y-2 text-sm leading-6 text-zinc-700">
                        {entry.points.map((p) => (
                            <li key={p}>{p}</li>
                        ))}
                    </ul>
                </section>

                {entry.plain_tip && (
                    <section className="glass-card p-5 mt-5">
                        <h2 className="font-bold text-lg">实际怎么做</h2>
                        <p className="mt-3 text-sm leading-6 text-zinc-700">{entry.plain_tip}</p>
                    </section>
                )}

                {entry.caution && (
                    <section className="mt-5 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm leading-6 text-zinc-600">
                        <span className="font-bold">注意：</span>
                        {entry.caution}
                    </section>
                )}

                <section className="glass-card p-5 mt-5">
                    <h2 className="font-bold text-lg">出处</h2>
                    <dl className="mt-3 grid grid-cols-[6rem_1fr] gap-y-2 text-sm leading-6">
                        <dt className="text-zinc-500">文件</dt>
                        <dd>{entry.source.title}</dd>
                        <dt className="text-zinc-500">发文机关</dt>
                        <dd>{entry.source.publisher}</dd>
                        <dt className="text-zinc-500">文号</dt>
                        <dd>{entry.source.doc_no}</dd>
                        <dt className="text-zinc-500">发布日期</dt>
                        <dd>{formatDateZh(entry.publish_date)}</dd>
                        <dt className="text-zinc-500">生效日期</dt>
                        <dd>{formatDateZh(entry.effective_date)}</dd>
                        <dt className="text-zinc-500">读取日期</dt>
                        <dd>{formatDateZh(entry.retrieved_at)}</dd>
                        <dt className="text-zinc-500">读到的范围</dt>
                        <dd>{entry.source.read_scope}</dd>
                        <dt className="text-zinc-500">原文链接</dt>
                        <dd className="break-all">
                            {href ? (
                                <a href={href} target="_blank" rel="noopener noreferrer" className="text-indigo-600 font-bold">
                                    打开官方原文
                                </a>
                            ) : (
                                '暂无可用链接'
                            )}
                            {entry.source.url_note && <span className="block text-zinc-500">{entry.source.url_note}</span>}
                        </dd>
                    </dl>
                </section>
            </div>
        </main>
    );
}
