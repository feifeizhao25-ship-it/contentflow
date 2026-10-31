/**
 * 人工审核后的写回。必须带审核人姓名；每一步写审计日志；不会被定时任务调用。
 *   approve  ：待审核 → 已审核，记下审核人/日期、当前来源内容摘要（之后来源再变就会被发现）
 *   update   ：来源变了、人重新读过并改好条目后，写「更新于」「变更说明」，并把基线换成最新来源
 *   confirm  ：人读过变化后确认「对本条没有影响」
 *   repeal   ：标为已废止（用户端不再显示）
 */
import { LibEntry, LibState } from './util';
import { Snapshots } from './freshness';

export class ReviewError extends Error {}

export interface ReviewCtx {
  doc: { entries: LibEntry[] };
  state: LibState;
  snapshots?: Snapshots;
  log?: (rec: Record<string, unknown>) => void;
  now?: () => Date;
}

const need = (reviewer: string): string => {
  const r = (reviewer ?? '').trim();
  if (!r) throw new ReviewError('reviewer name is required');
  return r;
};
const find = (doc: ReviewCtx['doc'], id: string): LibEntry => {
  const e = doc.entries.find((x) => x.id === id);
  if (!e) throw new ReviewError(`unknown entry ${id}`);
  return e;
};
const stamp = (c: ReviewCtx) => (c.now ? c.now() : new Date()).toISOString();

function pin(e: LibEntry, c: ReviewCtx): void {
  const st = c.state.entries[e.id];
  if (st?.content_hash) {
    e.reviewed_hash = st.content_hash;
    st.baseline_hash = st.content_hash;
    st.baseline_title = st.title ?? '';
    st.check = 'ok';
    st.change = null;
    st.baseline_unverified = false;
    const latest = c.snapshots?.read(e.id, 'latest');
    if (latest != null) c.snapshots!.write(e.id, 'baseline', latest);
  }
}

export function approve(c: ReviewCtx, id: string, reviewer: string, today: string): LibEntry {
  const who = need(reviewer);
  const e = find(c.doc, id);
  if (e.review_status === '已审核') throw new ReviewError('already reviewed');
  Object.assign(e, { review_status: '已审核', reviewer: who, reviewed_at: today, last_verified_at: today, version: Number(e.version ?? 0) + 1 });
  if (!e.approved_at) e.approved_at = today; // 首次上线日：推荐里的「新」只看它
  pin(e, c);
  c.log?.({ at: stamp(c), action: 'approve', id, reviewer: who, reviewed_hash: e.reviewed_hash });
  return e;
}

export function update(c: ReviewCtx, id: string, reviewer: string, today: string, note: string): LibEntry {
  const who = need(reviewer);
  if (!(note ?? '').trim()) throw new ReviewError('change_note is required');
  const e = find(c.doc, id);
  Object.assign(e, { updated_on: today, change_note: note.trim(), last_verified_at: today, reviewer: who, reviewed_at: today, version: Number(e.version ?? 0) + 1 });
  pin(e, c);
  c.log?.({ at: stamp(c), action: 'update', id, reviewer: who, note: note.trim(), reviewed_hash: e.reviewed_hash });
  return e;
}

export function confirmUnchanged(c: ReviewCtx, id: string, reviewer: string, today: string): LibEntry {
  const who = need(reviewer);
  const e = find(c.doc, id);
  Object.assign(e, { last_verified_at: today, reviewer: who, reviewed_at: today });
  pin(e, c);
  c.log?.({ at: stamp(c), action: 'confirm_unchanged', id, reviewer: who });
  return e;
}

export function repeal(c: ReviewCtx, id: string, reviewer: string, today: string, note = '', supersededBy?: string): LibEntry {
  const who = need(reviewer);
  const e = find(c.doc, id);
  Object.assign(e, { status: '已废止', status_note: note || e.status_note, reviewer: who, reviewed_at: today, updated_on: today });
  if (supersededBy) e.superseded_by = supersededBy;
  c.log?.({ at: stamp(c), action: 'repeal', id, reviewer: who, note });
  return e;
}
