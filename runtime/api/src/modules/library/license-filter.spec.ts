import { mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { decideHarvestLicense } from './license-filter';
import { harvestWeekly } from './weekly-harvest';

const TODAY = new Date('2026-11-13T00:00:00Z');

function source(partial: Record<string, string>) {
  return {
    section: 'skill-discovery',
    product: 'contentflow-cn',
    publisher: 'fixture',
    excerpt: '测试夹具，不安装。',
    language: 'zh',
    region: 'CN',
    ...partial,
  };
}

describe('周收获许可过滤', () => {
  it('拒绝 AGPL、NC、NOASSERTION 和爬虫，MIT 与 Apache 通过', () => {
    expect(decideHarvestLicense({ id: 'guizang', license: 'AGPL-3.0' }).pass).toBe(false);
    expect(decideHarvestLicense({ id: 'mindchat', license: 'GPL-3.0' }).pass).toBe(false);
    expect(decideHarvestLicense({ id: 'psych-books', license: 'CC-BY-NC-4.0' }).pass).toBe(false);
    expect(decideHarvestLicense({ id: 'NanmiCoder/MediaCrawler', url: 'https://github.com/NanmiCoder/MediaCrawler', license: 'NOASSERTION' })).toEqual({
      pass: false,
      reason: 'scraper_or_auto_comment',
    });
    expect(decideHarvestLicense({ id: 'xpzouying/xiaohongshu-mcp', url: 'https://github.com/xpzouying/xiaohongshu-mcp', license: 'Apache-2.0' })).toEqual({
      pass: false,
      reason: 'scraper_or_auto_comment',
    });
    expect(decideHarvestLicense({ id: 'auto-comment-bot', license: 'MIT', kind: '自动评论' }).pass).toBe(false);
    expect(decideHarvestLicense({ id: 'mit-sample', license: 'MIT' })).toEqual({ pass: true });
    expect(decideHarvestLicense({ id: 'apache-sample', license: 'Apache-2.0' })).toEqual({ pass: true });
  });

  it('收获时被拒的仓库不写入候选，通过的技能清单会留下', () => {
    const catalog = {
      product: 'contentflow',
      cadence: 'weekly:SUN@03:00',
      sections: [{ id: 'skill-discovery', title: '技能发现线索', language: 'zh' }],
      sources: [
        source({ id: 'MediaCrawler', url: 'https://github.com/NanmiCoder/MediaCrawler', license: 'NOASSERTION', title: 'MediaCrawler' }),
        source({ id: 'xiaohongshu-mcp', url: 'https://github.com/xpzouying/xiaohongshu-mcp', license: 'Apache-2.0', title: 'xiaohongshu-mcp' }),
        source({ id: 'agpl-card', url: 'https://github.com/example/agpl-card', license: 'AGPL-3.0', title: 'agpl card' }),
        source({ id: 'nc-set', url: 'https://github.com/example/nc-set', license: 'CC-BY-NC-4.0', title: 'nc set' }),
        source({ id: 'mit-ok', url: 'https://github.com/example/mit-ok', license: 'MIT', title: 'mit sample' }),
        source({ id: 'apache-ok', url: 'https://github.com/example/apache-ok', license: 'Apache-2.0', title: 'apache sample' }),
      ],
    };
    const dir = mkdtempSync(join(tmpdir(), 'cf-license-'));
    const catalogPath = join(dir, 'catalog.json');
    writeFileSync(catalogPath, JSON.stringify(catalog));
    const out = join(dir, 'candidates');
    const report = harvestWeekly({ candidatesDir: out, today: TODAY, catalogPath });
    expect(report.added).toEqual(['mit-ok', 'apache-ok']);
    expect(report.skipped.map((row) => row.id)).toEqual(['MediaCrawler', 'xiaohongshu-mcp', 'agpl-card', 'nc-set']);
    expect(report.skipped.every((row) => row.status === 'license_rejected')).toBe(true);
    expect(report.auto_promoted).toBe(false);
    expect(report.reviewer).toBe('');
    const passed = JSON.parse(readFileSync(join(out, 'skill-discovery', 'mit-ok.json'), 'utf8'));
    expect(passed.state).toBe('unpublished');
    expect(passed.reviewer).toBe('');
    expect(passed.review_status).toBe('待审核');
  });
});
