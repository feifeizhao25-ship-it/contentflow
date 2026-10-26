import { hashText } from './hash';
import { validateSource } from './registry';
import { GrowthSource } from './types';

export interface FreshnessReport {
  ran: true;
  checkedAt: string;
  fresh: string[];
  needsReview: string[];
}

/** 新鲜度任务。过期、哈希变化或字段不全的来源进入待复核，不自动放行。 */
export function runFreshnessJob(sources: GrowthSource[], now = new Date()): FreshnessReport {
  const fresh: string[] = [];
  const needsReview: string[] = [];
  for (const source of sources) {
    const changed = hashText(source.text) !== source.content_hash || source.review_status === 'needs_review';
    const checked = validateSource(source, now);
    if (changed || !checked.ok) needsReview.push(source.source_id);
    else fresh.push(source.source_id);
  }
  return { ran: true, checkedAt: now.toISOString(), fresh, needsReview };
}
