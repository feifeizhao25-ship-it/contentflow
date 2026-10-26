import { readFileSync } from 'fs';
import { join } from 'path';
import { hashText } from './hash';
import { ALLOWED_LICENSES, GrowthRegistry, GrowthSource } from './types';

const REQUIRED = ['source_id', 'url', 'tier', 'license', 'fetched_at', 'expires_at', 'title', 'text', 'content_hash'] as const;

export function validateSource(source: Partial<GrowthSource>, now = new Date()): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  for (const field of REQUIRED) {
    if (!source[field]) errors.push(`缺少 ${field}`);
  }
  if (source.url && !source.url.startsWith('https://')) errors.push('url 必须是 https');
  if (source.license && source.license.toUpperCase().includes('CC-BY-NC')) errors.push('拒绝 CC-BY-NC');
  if (source.license && !ALLOWED_LICENSES.includes(source.license as (typeof ALLOWED_LICENSES)[number])) {
    errors.push('license 不在允许列表');
  }
  if (source.fetched_at && Number.isNaN(Date.parse(source.fetched_at))) errors.push('fetched_at 无效');
  if (source.expires_at && Number.isNaN(Date.parse(source.expires_at))) errors.push('expires_at 无效');
  if (source.expires_at && !Number.isNaN(Date.parse(source.expires_at)) && new Date(source.expires_at).getTime() <= now.getTime()) {
    errors.push('来源已过期');
  }
  if (source.text && source.content_hash && source.content_hash !== hashText(source.text)) {
    errors.push('content_hash 与正文不一致');
  }
  if (source.review_status === 'needs_review') errors.push('来源待复核');
  return { ok: errors.length === 0, errors };
}

export function markIfHashChanged(source: GrowthSource): GrowthSource {
  if (hashText(source.text) !== source.content_hash) {
    return { ...source, review_status: 'needs_review' };
  }
  return source;
}

export function complianceConclusionsPaused(sources: GrowthSource[]): boolean {
  return sources.some((source) => source.review_status === 'needs_review' || hashText(source.text) !== source.content_hash);
}

export function loadRegistry(file = join(__dirname, 'sources.registry.json')): GrowthRegistry {
  const parsed = JSON.parse(readFileSync(file, 'utf8')) as GrowthRegistry;
  return { sources_status: parsed.sources_status ?? 'none', sources: parsed.sources ?? [] };
}
