/**
 * 平台与法规规则库：数据整理与筛选（纯函数，不依赖界面，方便测试）。
 *
 * 数据文件 src/data/rule-library.json 里的每一条都带出处、文号、状态和读取日期。
 * 审核门禁：默认只展示 review_status === '已审核' 的条目；『待审核』条目只有在
 * NEXT_PUBLIC_SHOW_PENDING_LIBRARY=true（预览/审核环境）时才显示，并带“待审核”标记。
 * 本库不进入检索索引，AI 回答不会引用未审核条目。
 */

export type RuleStatus = '现行' | '征求意见稿' | '已废止' | '待核实';
export type ReviewStatus = '待审核' | '已审核';

export interface RuleSource {
    title: string;
    publisher: string;
    doc_no: string;
    url: string;
    url_note?: string;
    read_scope: string;
    read_via: string;
    tier: string;
    license_note: string;
}

export interface RuleEntry {
    id: string;
    title: string;
    summary: string;
    points: string[];
    plain_tip: string;
    caution: string;
    category: string;
    tags: string[];
    source: RuleSource;
    status: RuleStatus;
    status_note: string;
    publish_date: string;
    effective_date: string;
    retrieved_at: string;
    review_status: ReviewStatus;
}

export interface RuleLibraryFile {
    schema_version: string;
    library: string;
    generated_at: string;
    review_policy: string;
    entries: RuleEntry[];
}

export const STATUS_COLOR: Record<RuleStatus, string> = {
    现行: 'green',
    征求意见稿: 'blue',
    已废止: 'default',
    待核实: 'orange',
};

export const SHOW_PENDING_LIBRARY = process.env.NEXT_PUBLIC_SHOW_PENDING_LIBRARY === 'true';

/** 门禁：未打开预览开关时，只保留已审核条目。 */
export function visibleEntries(entries: RuleEntry[], showPending: boolean = SHOW_PENDING_LIBRARY): RuleEntry[] {
    return entries.filter((e) => e.review_status === '已审核' || (showPending && e.review_status === '待审核'));
}

export interface RuleFilter {
    query?: string;
    category?: string;
    status?: string;
}

/** 搜索范围：标题、摘要、要点、标签、出处名称和文号。大小写不敏感，空格分词后全部命中才算。 */
export function filterEntries(entries: RuleEntry[], f: RuleFilter): RuleEntry[] {
    const words = (f.query ?? '').trim().toLowerCase().split(/\s+/).filter(Boolean);
    return entries.filter((e) => {
        if (f.category && e.category !== f.category) return false;
        if (f.status && e.status !== f.status) return false;
        if (words.length === 0) return true;
        const hay = [e.title, e.summary, ...e.points, ...e.tags, e.source.title, e.source.doc_no, e.source.publisher]
            .join('\n')
            .toLowerCase();
        return words.every((w) => hay.includes(w));
    });
}

export function categoriesOf(entries: RuleEntry[]): { name: string; count: number }[] {
    const m = new Map<string, number>();
    for (const e of entries) m.set(e.category, (m.get(e.category) ?? 0) + 1);
    return [...m.entries()].map(([name, count]) => ({ name, count }));
}

/** 2026-10-31 → 2026年10月31日；只有年月时写成 2026年10月。 */
export function formatDateZh(d: string): string {
    const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(d);
    if (!m) return d;
    return m[3] ? `${m[1]}年${Number(m[2])}月${Number(m[3])}日` : `${m[1]}年${Number(m[2])}月`;
}

/** 只允许打开 http(s) 链接，避免数据里混入 javascript: 之类的地址。 */
export function safeHref(url: string): string | null {
    return /^https?:\/\//i.test(url) ? url : null;
}
