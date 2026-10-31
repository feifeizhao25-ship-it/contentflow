'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Tag } from 'antd';
import data from '@/data/rule-library.json';
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
    const entry = visibleEntries(library.entries, SHOW_PENDING_LIBRARY).find((e) => e.id === params?.id);

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

    return (
        <main className="p-6 md:p-8 max-w-3xl mx-auto">
            <Link href="/rules" className="text-sm font-bold text-indigo-600">
                ← 规则库
            </Link>

            <div className="mt-4 flex flex-wrap items-center gap-2">
                <Tag color="geekblue">{entry.category}</Tag>
                <Tag color={STATUS_COLOR[entry.status]}>{entry.status}</Tag>
                {entry.review_status === '待审核' && <Tag color="gold">待审核</Tag>}
            </div>
            <h1 className="text-2xl md:text-3xl font-black mt-3 leading-snug">{entry.title}</h1>
            <p className="mt-3 text-zinc-600 leading-7">{entry.summary}</p>

            {entry.status_note && (
                <div className="mt-4 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-900" role="note">
                    状态说明：{entry.status_note}
                </div>
            )}

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
        </main>
    );
}
