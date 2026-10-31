/**
 * 给用户看的唯一规则：什么叫「现行」，什么必须挂提示，什么绝不能显示。
 * 顺序（先命中先生效）：
 *   未审核 → pending（不显示）
 *   已废止 / 被取代 → repealed（列表和推荐里都不出现；只有直接打开链接才看到「已废止」横幅）
 *   来源页出现废止迹象 → repeal_hold（同上，核对完才恢复）
 *   征求意见稿 / 待核实 → 显示，但带横幅，不当作现行，不推荐
 *   来源内容有变化（与审核时不一致）→ source_changed（显示，带横幅，不推荐）
 *   来源连续多次打不开 → unverifiable（同上）
 *   距上次核对超过时限 → review_due（同上）
 *   其余 → current（显示「核对于 …」；近 30 天更新过的另显示「更新于 … + 变更说明」）
 */
import { EntryState, LibEntry, daysBetween, dayStr, isReviewed, parseDay, statusCode } from './util';

export const FAIL_LIMIT = 3;
export const UPDATED_DAYS = 30;
export const TTL_DEFAULT = 90;

export const TEXT = {
  verified: (d: string) => `核对于 ${d}`,
  updated: (d: string) => `更新于 ${d}`,
  pending: '待审核',
  repealed: '此条依据的文件已废止，只供查阅，不再适用。',
  repeal_hold: '官方来源页出现「废止/失效」字样，正在人工核对，核对完成前不作为现行内容。',
  draft: '这是征求意见稿，尚未生效，只供了解方向，请以正式文件为准。',
  unverified: '这条的来源信息还在核实中，请以官方原文为准。',
  source_changed: '官方来源近期有更新，本条内容还没有对照最新版本，请以官方原文为准。',
  unverifiable: '暂时无法访问官方来源，本条无法确认是否仍是最新，请以官方原文为准。',
  review_due: (n: number) => `已超过 ${n} 天没有对照官方来源核对，请以官方原文为准。`,
};

export type DecisionState = 'pending' | 'repealed' | 'repeal_hold' | 'draft' | 'unverified' | 'source_changed' | 'unverifiable' | 'review_due' | 'current';

export interface Badge {
  kind: 'verified' | 'updated';
  text: string;
}

export interface Decision {
  state: DecisionState;
  visible: boolean;
  feed_eligible: boolean;
  current: boolean;
  banner: string | null;
  badges: Badge[];
  change_note: string | null;
  last_verified_at: string | null;
  updated_on: string | null;
}

/** 人工核对日 与 自动核对（来源未变）日 中较晚的一个。 */
export function effectiveVerified(e: LibEntry, st?: EntryState | null): number | null {
  const days = [parseDay(e.last_verified_at), parseDay(e.reviewed_at)];
  if (st && (st.check === 'ok' || st.check === 'minor_change')) days.push(parseDay(st.last_ok_at));
  const ok = days.filter((d): d is number => d !== null);
  return ok.length ? Math.max(...ok) : null;
}

export function decide(e: LibEntry, st: EntryState | null | undefined, today: number, opts: { ttlByCategory?: Record<string, number>; ttlDefault?: number; preview?: boolean } = {}): Decision {
  const ver = effectiveVerified(e, st);
  const ttl = Number(e.ttl_days || opts.ttlByCategory?.[e.category] || opts.ttlDefault || TTL_DEFAULT);
  const base = { last_verified_at: ver === null ? null : dayStr(ver), updated_on: (e.updated_on as string) ?? null, badges: [] as Badge[], change_note: null as string | null };
  const mk = (state: DecisionState, visible: boolean, banner: string | null): Decision => ({ state, visible, feed_eligible: false, current: false, banner, ...base });
  if (!isReviewed(e)) return mk('pending', !!opts.preview, opts.preview ? TEXT.pending : null);
  const code = statusCode(e.status);
  if (code === 'repealed' || e.superseded_by) return mk('repealed', false, TEXT.repealed);
  const check = st?.check;
  if (check === 'repeal_signal') return mk('repeal_hold', false, TEXT.repeal_hold);
  if (code === 'draft') return mk('draft', true, TEXT.draft);
  if (code === 'unverified') return mk('unverified', true, TEXT.unverified);
  if (check === 'changed') return mk('source_changed', true, TEXT.source_changed);
  if ((check === 'url_broken' || check === 'unreachable' || check === 'refused') && Number(st?.failures ?? 0) >= FAIL_LIMIT) return mk('unverifiable', true, TEXT.unverifiable);
  if (ver === null || daysBetween(today, ver) > ttl) return mk('review_due', true, TEXT.review_due(ttl));
  const badges: Badge[] = [{ kind: 'verified', text: TEXT.verified(dayStr(ver)) }];
  const upd = parseDay(e.updated_on);
  let note: string | null = null;
  if (upd !== null) {
    const age = daysBetween(today, upd);
    if (age >= 0 && age <= UPDATED_DAYS) {
      badges.push({ kind: 'updated', text: TEXT.updated(dayStr(upd)) });
      note = (e.change_note as string) ?? null;
    }
  }
  return { state: 'current', visible: true, feed_eligible: true, current: true, banner: null, badges, change_note: note, last_verified_at: dayStr(ver), updated_on: (e.updated_on as string) ?? null };
}
