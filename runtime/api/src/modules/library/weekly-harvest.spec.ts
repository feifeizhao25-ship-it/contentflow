/** Weekly harvest writes candidates and a diff report, and refuses an empty publish signature. */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { main } from './cli';
import { LibraryStore, bundledDoc, loadStagedRules } from './store';
import {
  CANDIDATE_FIELDS,
  HARVEST_CADENCE,
  WEEKLY_CATALOG_PATH,
  defaultProductionPaths,
  harvestWeekly,
  loadWeeklyCatalog,
  publishCandidates,
  sha256,
} from './weekly-harvest';

const TODAY = new Date('2026-11-06T00:00:00Z');
const tmp = () => mkdtempSync(join(tmpdir(), 'cf-harvest-'));

function filesUnder(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, name.name);
    if (name.isDirectory()) out.push(...filesUnder(path));
    else out.push(path);
  }
  return out;
}

function treeText(dir: string): string {
  return filesUnder(dir).map((path) => readFileSync(path, 'utf8')).join('\n');
}

describe('weekly knowledge harvest', () => {
  const libraryData = join(__dirname, 'data');

  it('writes sectioned candidates and a report without touching production', () => {
    const production = defaultProductionPaths().map((path) => [path, readFileSync(path)] as const);
    expect(production.some(([path]) => path.endsWith('rule-library.json'))).toBe(true);
    expect(production.some(([path]) => path.endsWith(`${join('growth-rag', 'sources.registry.json')}`))).toBe(true);
    expect(production.some(([path]) => path.endsWith(`${join('skills', 'README.md')}`))).toBe(true);
    const dataBefore = readdirSync(libraryData).sort();
    const stagedBefore = loadStagedRules(tmp()).map((entry) => entry.id);
    const bundledBefore = bundledDoc().entries.map((entry) => entry.id);
    const skill = join(tmp(), 'skills', 'draft.md');
    mkdirSync(join(skill, '..'));
    writeFileSync(skill, 'production skill\n', 'utf8');
    const out = join(tmp(), 'candidates');
    const report = harvestWeekly({ candidatesDir: out, today: TODAY, productionPaths: [skill] });

    expect(report.state).toBe('unpublished');
    expect(report.production_written).toBe(false);
    expect(report.auto_promoted).toBe(false);
    expect(report.reviewer).toBe('');
    expect(report.named_reviewer).toBeNull();
    expect(report.review_status).toBe('待审核');
    expect(report.cadence).toBe(HARVEST_CADENCE);
    expect(report.added).toEqual(['CF-01', 'CF-02', 'CF-04', 'CF-05', 'CF-06', 'CF-07', 'CF-INT-255', 'CF-INT-FTC-PDF', 'CF-INT-ASA', 'CF-INT-AI-50', 'CF-INT-CODE', 'CF-INT-GL', 'CF-SKILL-AWESOME']);
    expect(report.skipped).toEqual([]);
    expect(report.sections['cn-official']).toEqual(['CF-01', 'CF-02', 'CF-04', 'CF-05']);
    expect(report.sections['intl-disclosure']).toEqual(['CF-INT-255', 'CF-INT-FTC-PDF', 'CF-INT-ASA']);
    expect(report.sections['skill-discovery']).toEqual(['CF-SKILL-AWESOME']);

    const cn = JSON.parse(readFileSync(join(out, 'cn-official', 'CF-01.json'), 'utf8'));
    expect(cn.reviewer).toBe('');
    expect(cn.named_reviewer).toBeNull();
    expect(cn.review_status).toBe('待审核');
    expect(cn.state).toBe('unpublished');
    expect(cn.excerpt).toContain('显式标识');
    expect(cn.url).toContain('cac.gov.cn');
    for (const field of CANDIDATE_FIELDS) expect(cn[field]).toEqual(expect.anything());
    expect(cn.content_hash).toBe(sha256(cn.excerpt));
    expect(cn.doi).toBe('');

    const gb = JSON.parse(readFileSync(join(out, 'cn-official', 'CF-02.json'), 'utf8'));
    expect(gb.excerpt).toContain('5%');
    expect(gb.excerpt).toContain('2秒');
    const order = JSON.parse(readFileSync(join(out, 'cn-official', 'CF-04.json'), 'utf8'));
    expect(order.effective_at).toBe('2026-09-01');
    expect(order.excerpt).toContain('同质化');
    const code = JSON.parse(readFileSync(join(out, 'intl-ai-transparency', 'CF-INT-CODE.json'), 'utf8'));
    expect(code.excerpt).toContain('has not confirmed that it has signed the Code of Practice');
    expect(code.language).toBe('en');
    expect(code.published_at).toBe('2026-06-10');
    const pdf = JSON.parse(readFileSync(join(out, 'intl-disclosure', 'CF-INT-FTC-PDF.json'), 'utf8'));
    expect(pdf.url).toContain('1001A_Influencer%20Guide_508.pdf');

    const blob = treeText(out);
    expect(blob).toContain('# 分发侠周知识候选差异');
    expect(blob).toContain('## Disclosure references');
    expect(blob).toContain('## 国内现行官方文书');
    expect(blob).not.toMatch(/disclosures-101-social-media-influencers|activity-community-rules|douyin\.com|xiaohongshu\.com|mp\.weixin\.qq\.com|weixin\.qq\.com/);
    expect(blob).not.toMatch(/ContentFlow has signed the Code of Practice|本公司已签署/);
    expect(blob).not.toMatch(/零宽|invisible text watermark/);
    expect(existsSync(join(out, 'diff-report.md'))).toBe(true);
    expect(existsSync(join(out, 'diff-report.json'))).toBe(true);

    for (const [path, bytes] of production) expect(readFileSync(path).equals(bytes)).toBe(true);
    expect(readFileSync(skill, 'utf8')).toBe('production skill\n');
    expect(readdirSync(libraryData).sort()).toEqual(dataBefore);
    expect(loadStagedRules(tmp()).map((entry) => entry.id)).toEqual(stagedBefore);
    expect(bundledDoc().entries.map((entry) => entry.id)).toEqual(bundledBefore);
    const job = readFileSync(join(__dirname, 'library-job.service.ts'), 'utf8');
    expect(job).not.toContain('harvestWeekly');
    expect(job.match(/@Cron\(/g)?.length).toBe(2);
    const hook = readFileSync(join(__dirname, 'weekly-harvest.ts'), 'utf8');
    expect(hook).not.toMatch(/@Cron\(|@nestjs\/schedule/);
  });

  it('second harvest is a diff and not a publish', () => {
    const out = join(tmp(), 'candidates');
    const first = harvestWeekly({ candidatesDir: out, today: TODAY });
    const second = harvestWeekly({ candidatesDir: out, today: TODAY });
    expect(first.added.length).toBeGreaterThan(0);
    expect(second.added).toEqual([]);
    expect(second.changed).toEqual([]);
    expect(second.unchanged).toEqual(first.added);
    expect(second.production_written).toBe(false);
  });

  it('a changed excerpt shows up in the diff and stays unpublished', () => {
    const catalog = join(tmp(), 'catalog.json');
    writeFileSync(catalog, readFileSync(WEEKLY_CATALOG_PATH));
    const out = join(tmp(), 'candidates');
    harvestWeekly({ candidatesDir: out, today: TODAY, catalogPath: catalog });
    const data = JSON.parse(readFileSync(catalog, 'utf8'));
    data.sources[0].excerpt += ' 复核人仍为空。';
    writeFileSync(catalog, JSON.stringify(data));
    const report = harvestWeekly({ candidatesDir: out, today: TODAY, catalogPath: catalog });
    expect(report.changed).toEqual(['CF-01']);
    const row = JSON.parse(readFileSync(join(out, 'cn-official', 'CF-01.json'), 'utf8'));
    expect(row.reviewer).toBe('');
    expect(row.state).toBe('unpublished');
    expect(readFileSync(join(out, 'diff-report.md'), 'utf8')).toContain('有变化');
  });

  it('does not write a blocked or unconfirmed url', () => {
    const catalog = loadWeeklyCatalog();
    const blocked = catalog.blocked_urls!.find((url) => url.includes('douyin.com/agreements'))!;
    const ftcHtml = catalog.blocked_urls!.find((url) => url.includes('disclosures-101-social-media-influencers'))!;
    expect(catalog.sources.some((source) => /douyin\.com|xiaohongshu\.com|weixin\.qq\.com/.test(source.url ?? ''))).toBe(false);
    expect(ftcHtml).toBeTruthy();
    const path = join(tmp(), 'catalog.json');
    writeFileSync(path, JSON.stringify({
      ...catalog,
      sources: [
        { id: 'BLOCKED-1', section: 'intl-disclosure', product: 'contentflow-intl', url: blocked, publisher: 'Douyin', excerpt: 'must not land', region: 'CN', license: '', language: 'zh' },
        { id: 'MISSING-1', section: 'cn-official', url: '', publisher: '未知', excerpt: 'no url', language: 'zh' },
      ],
    }));
    const out = join(tmp(), 'candidates');
    const report = harvestWeekly({ candidatesDir: out, today: TODAY, catalogPath: path });
    expect(report.added).toEqual([]);
    expect(report.skipped.map((row) => row.status)).toEqual(['blocked_unverified_url', 'unconfirmed_url']);
    expect(existsSync(join(out, 'intl-disclosure', 'BLOCKED-1.json'))).toBe(false);
    expect(treeText(out)).not.toContain('must not land');
  });

  it('hashes fetched bytes and keeps the catalog excerpt', () => {
    const out = join(tmp(), 'candidates');
    harvestWeekly({ candidatesDir: out, today: TODAY, fetcher: () => Buffer.from('official-page') });
    const row = JSON.parse(readFileSync(join(out, 'cn-official', 'CF-01.json'), 'utf8'));
    expect(row.fetch_status).toBe('fetched');
    expect(row.content_hash).toBe(sha256(Buffer.from('official-page')));
    expect(row.excerpt).toContain('显式标识');
    expect(row.reviewer).toBe('');
  });

  it('refuses an empty signature and does not copy candidates into production', () => {
    const out = join(tmp(), 'candidates');
    harvestWeekly({ candidatesDir: out, today: TODAY });
    const production = defaultProductionPaths().map((path) => [path, readFileSync(path)] as const);
    const candidate = readFileSync(join(out, 'cn-official', 'CF-04.json'));
    expect(() => publishCandidates('', { candidatesDir: out })).toThrow(/reviewer_signature is empty/);
    expect(() => publishCandidates('   ', { candidatesDir: out })).toThrow(/reviewer_signature is empty/);
    expect(existsSync(join(out, 'publish-receipt.json'))).toBe(false);
    const receipt = publishCandidates('reviewer-signed-in-the-call', { candidatesDir: out });
    expect(receipt.production_written).toBe(false);
    expect(receipt.auto_promoted).toBe(false);
    expect(receipt.reviewer_on_candidates).toBe('');
    expect(receipt.named_reviewer).toBeNull();
    expect(receipt.state).toBe('queued_unpublished');
    expect(readFileSync(join(out, 'cn-official', 'CF-04.json')).equals(candidate)).toBe(true);
    const row = JSON.parse(candidate.toString('utf8'));
    expect(row.reviewer).toBe('');
    expect(row.state).toBe('unpublished');
    expect(row.excerpt).toContain('令第23号');
    for (const [path, bytes] of production) expect(readFileSync(path).equals(bytes)).toBe(true);
    const registry = JSON.parse(readFileSync(join(__dirname, '..', 'ai', 'growth-rag', 'sources.registry.json'), 'utf8')) as {
      sources: { source_id: string; review_status: string; reviewer?: string | null }[];
    };
    const live = registry.sources.find((source) => source.source_id === 'cn-cac-ai-labeling-2025');
    expect(live?.review_status).toBe('needs_review');
    expect(live?.reviewer ?? null).toBeNull();
  });

  it('refuses the production registry and skills directories', () => {
    expect(() => harvestWeekly({ candidatesDir: libraryData, today: TODAY })).toThrow(/refusing to write candidates into production registry or skills/);
    expect(() => harvestWeekly({ candidatesDir: join(__dirname, '..', '..', '..', '..', '..', 'skills'), today: TODAY })).toThrow(/refusing to write candidates/);
    expect(() => publishCandidates('signed', { candidatesDir: join(__dirname, '..', 'ai', 'growth-rag') })).toThrow(/refusing to write candidates/);
  });

  it('cli harvest and publish leave the working document alone', async () => {
    const dir = tmp();
    const store = new LibraryStore(dir);
    const out = join(dir, 'candidates');
    const quiet = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const quietErr = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      expect(await main(['harvest', '--out', out], store, TODAY)).toBe(0);
      expect(existsSync(join(out, 'diff-report.md'))).toBe(true);
      expect(existsSync(join(dir, 'reference_entries.json'))).toBe(false);
      expect(await main(['publish-candidates', '--out', out, '--signature', ''], store, TODAY)).toBe(2);
      expect(await main(['publish-candidates', '--out', out], store, TODAY)).toBe(2);
      expect(existsSync(join(out, 'publish-receipt.json'))).toBe(false);
      expect(await main(['publish-candidates', '--signature', 'signed-in-the-call', '--out', out], store, TODAY)).toBe(0);
      const row = JSON.parse(readFileSync(join(out, 'cn-official', 'CF-01.json'), 'utf8'));
      expect(row.reviewer).toBe('');
      expect(row.review_status).toBe('待审核');
      expect(row.state).toBe('unpublished');
      expect(existsSync(join(dir, 'reference_entries.json'))).toBe(false);
    } finally {
      quiet.mockRestore();
      quietErr.mockRestore();
    }
  });
});
