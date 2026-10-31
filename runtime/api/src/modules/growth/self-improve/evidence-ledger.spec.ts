import { readFileSync } from 'fs';
import { join } from 'path';

// 证据账本的结构与规则校验：A 级才能驱动内容；待核条目不能是 A 级；受限许可证不能被标成可采用。
const LEDGER = join(__dirname, '..', '..', '..', '..', '..', '..', 'docs', 'research', 'evidence_ledger_20261031.jsonl');
const rows = readFileSync(LEDGER, 'utf-8')
  .split('\n')
  .filter((l) => l.trim())
  .map((l) => JSON.parse(l));

describe('evidence ledger 20261031', () => {
  it('字段齐全、id 唯一', () => {
    expect(rows.length).toBeGreaterThan(0);
    const ids = rows.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const r of rows) {
      for (const k of ['id', 'type', 'title', 'url', 'license', 'license_class', 'products', 'grade', 'url_status', 'flag', 'retrieved']) {
        expect(r).toHaveProperty(k);
      }
      expect(['A', 'B', 'lead']).toContain(r.grade);
      expect(r.url).toMatch(/^https?:\/\//);
    }
  });
  it('只含本产品或 all 的条目', () => {
    for (const r of rows) expect(r.products.includes('fenfaxia') || r.products.includes('all')).toBe(true);
  });
  it('待核条目不是 A 级', () => {
    for (const r of rows) if (r.flag) { expect(r.flag.startsWith('待核')).toBe(true); expect(r.grade).not.toBe('A'); }
  });
  it('受限许可证条目没有被标成可入库', () => {
    for (const r of rows) if (['do_not_ingest', 'do_not_introduce'].includes(r.license_class)) expect(r.adopt_as_content ?? false).toBe(false);
  });
});
