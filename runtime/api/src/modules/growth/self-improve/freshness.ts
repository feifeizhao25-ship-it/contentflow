import { createHash } from 'crypto';

export const SOURCE_TIERS = ['official', 'standard', 'academic', 'internal', 'legacy_unverified'] as const;
export type SourceTier = (typeof SOURCE_TIERS)[number];

export interface KnowledgeEntry {
  id: string;
  source_tier?: string;
  license?: string;
  valid_from?: string;
  valid_until?: string;
  superseded_by?: string | null;
  content_hash?: string;
  origin?: string;
  url?: string;
  /** 可选；缺省按 in_force。draft_consultation = 征求意见稿：可检索，但绝不能当现行规则回答。 */
  status?: string;
  lang?: string;
}

export const STATUSES = ['in_force', 'draft_consultation', 'superseded', 'expired'] as const;
export const DRAFT_NOTICE_ZH = '（征求意见稿，尚未生效，仅供参考，以官方正式文件为准）';
const TIER_RANK: Record<string, number> = { official: 4, standard: 3, academic: 2, internal: 1, legacy_unverified: 0 };

const REQUIRED: (keyof KnowledgeEntry)[] = ['id', 'source_tier', 'license', 'valid_from', 'valid_until', 'content_hash', 'origin'];

export function contentHash(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function day(value?: string): number | null {
  if (!value) return null;
  const t = Date.parse(value.slice(0, 10));
  return Number.isNaN(t) ? NaN : t;
}

export function validateEntry(entry: KnowledgeEntry): string[] {
  const problems = REQUIRED.filter((f) => !entry[f]).map((f) => `missing:${f}`);
  if (entry.source_tier && !(SOURCE_TIERS as readonly string[]).includes(entry.source_tier)) problems.push(`bad_tier:${entry.source_tier}`);
  const vf = day(entry.valid_from);
  const vu = day(entry.valid_until);
  if ((vf !== null && Number.isNaN(vf)) || (vu !== null && Number.isNaN(vu))) problems.push('bad_date');
  else if (vf && vu && vu < vf) problems.push('valid_until_before_valid_from');
  if (entry.origin === 'generated') problems.push('origin_generated_not_indexable');
  if (entry.status && !(STATUSES as readonly string[]).includes(entry.status)) problems.push(`bad_status:${entry.status}`);
  if ((entry.source_tier === 'official' || entry.source_tier === 'standard' || entry.status === 'draft_consultation') && !entry.url && !problems.includes('missing:url')) problems.push('missing:url');
  return problems;
}

export function retrievable(entry: KnowledgeEntry, today: Date): { ok: boolean; why: string } {
  if (entry.origin === 'generated') return { ok: false, why: 'origin_generated' };
  if (entry.superseded_by || entry.status === 'superseded') return { ok: false, why: 'superseded' };
  if (entry.status === 'expired') return { ok: false, why: 'expired' };
  // 征求意见稿：可检索、可引用，但必须带 DRAFT_NOTICE_ZH，且 factAllowed 为 false
  if (entry.status === 'draft_consultation') return { ok: true, why: 'draft_consultation' };
  const vf = day(entry.valid_from);
  const vu = day(entry.valid_until);
  if ((vf !== null && Number.isNaN(vf)) || (vu !== null && Number.isNaN(vu))) return { ok: false, why: 'bad_date' };
  if (vu === null) return { ok: false, why: 'no_valid_until' };
  const t = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  if (vf && t < vf) return { ok: false, why: 'not_yet_valid' };
  if (t > vu) return { ok: false, why: 'expired' };
  return { ok: true, why: 'ok' };
}

export interface RetirementReport {
  expired: string[];
  superseded: string[];
  idle: string[];
  expiringSoon: string[];
  retireIds: string[];
}

export function retirementScan(entries: KnowledgeEntry[], today: Date, hits90d: Record<string, number> = {}, warnDays = 30): RetirementReport {
  const rep = { expired: [] as string[], superseded: [] as string[], idle: [] as string[], expiringSoon: [] as string[], retireIds: [] as string[] };
  const soon = today.getTime() + warnDays * 86_400_000;
  for (const e of entries) {
    const r = retrievable(e, today);
    if (r.why === 'expired') rep.expired.push(e.id);
    else if (r.why === 'superseded') rep.superseded.push(e.id);
    else if (r.ok) {
      const vu = day(e.valid_until);
      if (vu && vu <= soon) rep.expiringSoon.push(e.id);
      if (e.id in hits90d && hits90d[e.id] === 0) rep.idle.push(e.id);
    }
  }
  rep.retireIds = Array.from(new Set([...rep.expired, ...rep.superseded, ...rep.idle])).sort();
  return rep;
}

const FACT_TIERS = ['official', 'standard', 'academic', 'internal'];
/** 能否作为事实陈述引用（legacy_unverified、征求意见稿、被取代、过期都不行）。 */
export function factAllowed(entry: KnowledgeEntry): boolean {
  if (entry.status === 'draft_consultation' || entry.status === 'superseded' || entry.status === 'expired') return false;
  return FACT_TIERS.includes(entry.source_tier ?? '') && !entry.superseded_by;
}

/** 推导当前状态：被取代 > 过期 > 征求意见稿 > 现行。 */
export function entryStatus(entry: KnowledgeEntry, today: Date): 'in_force' | 'draft_consultation' | 'superseded' | 'expired' {
  if (entry.superseded_by || entry.status === 'superseded') return 'superseded';
  const vu = entry.valid_until ? day(entry.valid_until) : null;
  const t = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  if (entry.status === 'expired' || (vu && !Number.isNaN(vu) && t > vu)) return 'expired';
  if (entry.status === 'draft_consultation') return 'draft_consultation';
  return 'in_force';
}

/** 回答里必须附带的状态提示；现行条目为空串。 */
export const answerNotice = (entry: KnowledgeEntry): string => (entry.status === 'draft_consultation' ? DRAFT_NOTICE_ZH : '');

/**
 * 两条互相矛盾的证据（常见于中英文来源）如何取舍。只给结论与规则，不改条目。
 * 顺序：现行 > 征求意见稿 > 被取代/过期；其次来源层级；同层级时中文来源优先并标注；仍无法区分 → escalate_human。
 */
export function resolveConflict(a: KnowledgeEntry, b: KnowledgeEntry): { winner: string | null; rule: string; annotate: boolean } {
  const statusRank = (e: KnowledgeEntry) => {
    const st = e.status ?? (e.superseded_by ? 'superseded' : 'in_force');
    return st === 'in_force' ? 2 : st === 'draft_consultation' ? 1 : 0;
  };
  const tierRank = (e: KnowledgeEntry) => TIER_RANK[e.source_tier ?? ''] ?? -1;
  for (const [rule, key] of [['status', statusRank], ['source_tier', tierRank]] as const) {
    const ka = key(a);
    const kb = key(b);
    if (ka !== kb) return { winner: ka > kb ? a.id : b.id, rule, annotate: true };
  }
  const isZh = (e: KnowledgeEntry) => ['zh', 'cn'].includes(String(e.lang ?? '').toLowerCase().slice(0, 2));
  if (isZh(a) !== isZh(b)) return { winner: isZh(a) ? a.id : b.id, rule: 'prefer_zh_official', annotate: true };
  return { winner: null, rule: 'escalate_human', annotate: true };
}
