import { createHash } from 'crypto';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { loadRegistry } from './growth-rag/registry';
import { hashText } from './growth-rag/hash';

const dir = join(__dirname, '../../../data/rag_cache');
const hash = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');
const REQUIRED = [
  'cn-cac-ai-labeling-2025',
  'cn-gb45438-2025',
  'cn-order-23-multi-channel-2026',
  'cn-samr-ad-article-9',
  'cn-bilibili-creator-label-2023',
  'cn-bilibili-ai-abuse-2025',
];
const BANNED_URL = /disclosures-101-social-media-influencers|ftcs-endorsement-guides-what-people-are-asking|activity-community-rules\.html|douyin\.com\/agreements/i;

function records() {
  return readdirSync(dir).filter((name) => name.endsWith('.json')).map((name) => JSON.parse(readFileSync(join(dir, name), 'utf8')));
}

describe('国内规则 RAG 第一波（待审核，不代填复核人）', () => {
  it('用现行官方文书替换过期平台摘录，并带齐出处字段', () => {
    const all = records();
    const ids = all.map((r) => r.id);
    expect(ids).toEqual(expect.arrayContaining(REQUIRED));
    expect(ids).not.toContain('douyin-user-agreement-2025');
    expect(ids).not.toContain('bilibili-ai-policy');
    for (const record of all) {
      expect(String(record.reviewed_by ?? '')).not.toMatch(/openclaw|自动复核/i);
      expect(String(record.content ?? '').length).toBeGreaterThan(20);
      // Wave-1 contract: each source is either awaiting review (no reviewer fields)
      // or verified/approved by a named human reviewer (both fields stamped together).
      if (record.review_status === '待审核') {
        expect(record.reviewer ?? '').toBe('');
        expect(record.reviewed_by ?? null).toBeNull();
        expect(record.reviewed_at ?? null).toBeNull();
      } else {
        expect(['approved', 'verified']).toContain(record.review_status);
        expect(record.reviewed_by).toEqual(expect.any(String));
        expect(record.reviewed_by.length).toBeGreaterThan(1);
        expect(record.reviewed_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      }
      expect(record.publisher).toEqual(expect.any(String));
      expect(record.publisher.length).toBeGreaterThan(1);
      expect(record.source_url).toMatch(/^https:\/\//);
      expect(record.source_url).not.toMatch(BANNED_URL);
      expect(record.region).toBe('CN');
      expect(record.license.length).toBeGreaterThan(1);
      expect(record.content_hash).toBe(hash(record.content));
      expect(record.excerpt).toBe(record.content);
      expect(record.published_at).toBeTruthy();
      expect(record.retrieved_at).toBeTruthy();
    }
    const gb = all.find((r) => r.id === 'cn-gb45438-2025');
    expect(gb.content).toMatch(/5%/);
    expect(gb.content).toMatch(/2秒/);
    expect(gb.content).toMatch(/文件元数据/);
    const order = all.find((r) => r.id === 'cn-order-23-multi-channel-2026');
    expect(order.effective_at.startsWith('2026-09-01')).toBe(true);
    expect(order.content).toMatch(/同质化/);
  });

  it('增长注册表收录同一批来源，状态保持待复核且哈希一致', () => {
    const registry = loadRegistry();
    expect(registry.sources_status).toBe('review_required');
    for (const id of REQUIRED) {
      const source = registry.sources.find((item) => item.source_id === id);
      expect(source).toBeTruthy();
      expect(source!.review_status).toBe('needs_review');
      expect(source!.content_hash).toBe(hashText(source!.text));
      expect((source as { reviewer?: string | null }).reviewer ?? null).toBeNull();
      expect(source!.url).not.toMatch(BANNED_URL);
    }
  });
});
