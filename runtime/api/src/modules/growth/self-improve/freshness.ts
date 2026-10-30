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
}

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
  if ((entry.source_tier === 'official' || entry.source_tier === 'standard') && !entry.url) problems.push('missing:url');
  return problems;
}

export function retrievable(entry: KnowledgeEntry, today: Date): { ok: boolean; why: string } {
  if (entry.origin === 'generated') return { ok: false, why: 'origin_generated' };
  if (entry.superseded_by) return { ok: false, why: 'superseded' };
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
