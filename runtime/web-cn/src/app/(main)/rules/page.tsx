'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Input, Select, Tag } from 'antd';
import data from '@/data/rule-library.json';
import {
    SHOW_PENDING_LIBRARY,
    STATUS_COLOR,
    categoriesOf,
    filterEntries,
    formatDateZh,
    visibleEntries,
    type RuleEntry,
    type RuleLibraryFile,
} from '@/lib/rule-library';

const library = data as RuleLibraryFile;
const STATUS_OPTIONS = ['现行', '征求意见稿', '已废止', '待核实'].map((s) => ({ value: s, label: s }));

export default function RulesPage() {
    const [query, setQuery] = useState('');
    const [category, setCategory] = useState('');
    const [status, setStatus] = useState<string | undefined>(undefined);

    const all = useMemo(() => visibleEntries(library.entries, SHOW_PENDING_LIBRARY), []);
    const categories = useMemo(() => categoriesOf(all), [all]);
    const shown = useMemo(() => filterEntries(all, { query, category, status }), [all, query, category, status]);

    return (
        <main className="p-6 md:p-8 max-w-6xl mx-auto">
            <h1 className="text-3xl font-black">平台与法规规则库</h1>
            <p className="text-zinc-500 mt-2">
                发内容前先看一眼：广告怎么标、直播间哪些话不能说、健康类内容有哪些红线。每一条都写明出处、文号、状态和读取日期，点进去可以看原文链接。
            </p>

            {SHOW_PENDING_LIBRARY && (
                <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="note">
                    预览模式：下面的条目已对照官方原文整理，但还在等待人工审核，请不要当作最终结论。内容是法规科普，不是法律意见。
                </div>
            )}

            {all.length === 0 ? (
                <div className="glass-card p-10 mt-8 text-center" data-testid="rules-empty-review">
                    <p className="text-lg font-bold">规则库正在审核中</p>
                    <p className="mt-3 text-sm text-zinc-500 leading-6">
                        新整理的规则条目要先经过人工核对原文，通过后才会在这里出现。审核期间，请以各平台和监管部门的官方公告为准。
                    </p>
                </div>
            ) : (
                <>
                    <div className="mt-6 flex flex-col md:flex-row gap-3">
                        <Input.Search
                            allowClear
                            size="large"
                            placeholder="搜索关键词，例如：广告、直播、保健"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            aria-label="搜索规则"
                        />
                        <Select
                            allowClear
                            size="large"
                            className="md:w-48"
                            placeholder="全部状态"
                            options={STATUS_OPTIONS}
                            value={status}
                            onChange={(v) => setStatus(v)}
                            aria-label="按状态筛选"
                        />
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="规则分类">
                        <Tag.CheckableTag checked={category === ''} onChange={() => setCategory('')}>
                            全部（{all.length}）
                        </Tag.CheckableTag>
                        {categories.map((c) => (
                            <Tag.CheckableTag key={c.name} checked={category === c.name} onChange={() => setCategory(c.name)}>
                                {c.name}（{c.count}）
                            </Tag.CheckableTag>
                        ))}
                    </div>

                    <p className="mt-4 text-sm text-zinc-500" aria-live="polite">
                        共 {shown.length} 条
                    </p>

                    {shown.length === 0 ? (
                        <div className="glass-card p-10 mt-4 text-center" data-testid="rules-empty-search">
                            <p className="font-bold">没有找到相关规则</p>
                            <p className="mt-2 text-sm text-zinc-500">换一个关键词，或者清除上面的分类和状态筛选再试试。</p>
                        </div>
                    ) : (
                        <div className="grid md:grid-cols-2 gap-5 mt-4">
                            {shown.map((e) => (
                                <RuleCard key={e.id} entry={e} />
                            ))}
                        </div>
                    )}
                </>
            )}

            <p className="mt-10 text-xs text-zinc-400 leading-5">
                本库是法规和平台规则的科普整理，不是法律意见，也不替代各平台的最新公告。条目只引用国家机关公开文件，未经审核的条目不会用于 AI 回答。
            </p>
        </main>
    );
}

function RuleCard({ entry }: { entry: RuleEntry }) {
    return (
        <Link href={`/rules/${entry.id}`} className="glass-card p-5 block" data-testid="rule-card">
            <div className="flex flex-wrap items-center gap-2">
                <Tag color="geekblue">{entry.category}</Tag>
                <Tag color={STATUS_COLOR[entry.status]}>{entry.status}</Tag>
                {entry.review_status === '待审核' && <Tag color="gold">待审核</Tag>}
            </div>
            <h2 className="font-bold text-lg mt-3 leading-snug">{entry.title}</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">{entry.summary}</p>
            <div className="mt-4 text-xs text-zinc-500 leading-5">
                <div>
                    出处：{entry.source.publisher} · {entry.source.title}
                </div>
                <div>
                    发布 {formatDateZh(entry.publish_date)} · 读取于 {formatDateZh(entry.retrieved_at)}
                </div>
            </div>
        </Link>
    );
}
