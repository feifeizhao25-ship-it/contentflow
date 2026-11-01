/** 2026-11-01 研究补充：变好才上线闸门 / 版本发布与回滚 / 闸门任务 / 新暂存规则。离线、确定性；闸门开关在测试里打开，出厂保持关闭。 */
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { main } from './cli';
import { BM25Index, tokenize } from './bm25';
import { Candidate, HIT_K, duplicates, evaluate, evaluateAll, evidenceScore, gateEnforced, impact, safetyScore } from './promote-gate';
import * as releases from './releases';
import { LibraryStore, bundledDoc, loadStagedRules, sources } from './store';
import { domainOk } from '../growth/self-improve/sources';
import { CONTINUOUS_CRON, CONTINUOUS_SLOTS, runContinuous, runContinuousIfEnabled } from '../growth/self-improve/continuous';
import { nextRun } from '../growth/self-improve/schedule';
import { SILConfig } from '../growth/self-improve/config';

const TODAY = new Date('2026-11-01T08:00:00+08:00');
const domOk = (h: string) => domainOk(h, { allowedDomains: sources().allowed_domains });
const good = (o: Partial<Candidate> = {}): Candidate => ({
  id: 't-1', title: '测试：多平台发布的广告标识', summary: '官方对广告标识的概括。', points: ['要显著标明广告。'], plain_tip: '醒目位置写广告。', caution: '仅供了解，不是法律意见。', tags: ['广告标识'],
  probes: ['发种草笔记要不要标广告', '广告标识怎么写'], category: '广告标识', status: '现行', review_status: '待审核',
  source: { title: '办法', publisher: '国家市场监督管理总局', url: 'https://www.samr.gov.cn/x', read_scope: '全文', tier: 'A' } as Candidate['source'], publish_date: '2026-05-01', retrieved_at: '2026-10-31', ...o,
});
const doc = () => bundledDoc().entries;
const tmp = () => mkdtempSync(join(tmpdir(), 'cf-lib-'));

describe('bm25', () => {
  it('tokenizes cn bigrams and en words', () => {
    expect(tokenize('广告标识', 'cn')).toContain('广告');
    expect(tokenize('AI label rules', 'en')).toEqual(expect.arrayContaining(['ai', 'label', 'rules']));
  });
  it('ranks the heading match first', () => {
    const idx = new BM25Index([{ heading: '直播带货', content: '内容甲' }, { heading: '微短剧', content: '内容乙' }]);
    expect(idx.query('微短剧')[0].index).toBe(1);
    expect(idx.query('完全无关xyz')).toEqual([]);
  });
});

describe('promote gate', () => {
  it('keeps a good candidate', () => {
    const r = evaluate(good(), doc(), { today: TODAY, domainOk: domOk });
    expect(r.decision).toBe('keep');
    expect(r.evidence).toBeGreaterThanOrEqual(0.85);
  });
  it('each check can reject', () => {
    const d = doc();
    expect(evaluate(good({ source: { ...good().source, tier: 'D' } }), d, { today: TODAY }).decision).toBe('reject');
    const b = good({ source: { ...good().source, tier: 'B' } });
    expect(evaluate(b, d, { today: TODAY }).decision).toBe('reject');
    expect(evaluate({ ...b, second_source: { url: 'https://y' } }, d, { today: TODAY }).decision).toBe('keep');
    expect(evaluate(good({ summary: '用本工具保证过审，百分百合规' }), d, { today: TODAY }).decision).toBe('reject');
    expect(evaluate(good({ probes: [] }), d, { today: TODAY }).decision).toBe('reject');
    expect(evaluate(good({ caution: '' }), d, { today: TODAY }).decision).toBe('reject');
    expect(evaluate(good({ source: { ...good().source, url: 'http://x' } }), d, { today: TODAY }).decision).toBe('reject');
    expect(evidenceScore(good({ retrieved_at: '2026-01-01' }), TODAY).score).toBeLessThan(0.85);
    expect(evaluate(good({ id: d[0].id }), d, { today: TODAY }).decision).toBe('reject');
    expect(duplicates(good({ source: { ...good().source, url: d[0].source.url } }), d).length).toBeGreaterThanOrEqual(1);
  });
  it('disclaimers like "不能替代律师" are allowed, real claims are not', () => {
    expect(safetyScore(good({ caution: '不能替代律师的法律意见。' })).score).toBe(1);
    expect(safetyScore(good({ summary: '一定不会被处罚' })).score).toBe(0);
  });
  it('detects regression of existing probes', () => {
    HIT_K.value = 1;
    try {
      const base = [{ id: 'a', title: '直播带货规则', tags: ['直播'], summary: '直播带货规则要点', points: ['直播'], probes: ['直播带货规则'] }, ...[1, 2, 3].map((i) => ({ id: `f${i}`, title: `别的${i}`, summary: `内容${i}`, points: [] as string[] }))] as unknown as Candidate[];
      const hog = good({ id: 'hog', title: '直播带货规则', tags: ['直播', '带货'], summary: '直播带货规则 '.repeat(20), points: ['直播带货规则 '.repeat(10)], probes: ['直播带货规则', '直播'] });
      const r = impact(hog, base);
      expect(r.regressions[0]?.entry).toBe('a');
      expect(r.decision).toBe('reject');
    } finally {
      HIT_K.value = 3;
    }
  });
});

describe('shipped staged rules', () => {
  it('are pending, official https, invisible, and get the expected verdicts', () => {
    const staged = loadStagedRules(tmp());
    expect(staged.map((e) => e.id)).toEqual(expect.arrayContaining(['cf-rule-s01', 'cf-rule-s02']));
    for (const e of staged) {
      expect(e.review_status).toBe('待审核');
      expect(e.source.url.startsWith('https://')).toBe(true);
      expect((e as Candidate).probes!.length).toBeGreaterThanOrEqual(3);
    }
    expect(doc().some((e) => e.id.startsWith('cf-rule-s'))).toBe(false);
    const rep = evaluateAll(staged as Candidate[], doc(), { today: TODAY, domainOk: domOk });
    expect(rep.keep).toEqual(expect.arrayContaining(['cf-rule-s01', 'cf-rule-s02']));
  });
});

describe('releases', () => {
  it('chain, rollback, tamper', () => {
    const d = tmp();
    releases.record(d, { entries: [{ id: 'a' }] }, { action: 'baseline', entry_id: '-', reviewer: '张三' });
    releases.record(d, { entries: [{ id: 'a' }, { id: 'b' }] }, { action: 'promote', entry_id: 'b', reviewer: '张三' });
    expect(releases.verify(d).ok).toBe(true);
    expect(() => releases.record(d, {}, { action: 'x', entry_id: 'b', reviewer: ' ' })).toThrow();
    expect(() => releases.rollback(d, 1, '张三', ' ')).toThrow();
    expect(releases.rollback(d, 1, '张三', '回到基线')).toEqual({ entries: [{ id: 'a' }] });
    expect(releases.listReleases(d).map((r) => r.action)).toEqual(['baseline', 'promote', 'rollback']);
    const f = join(d, 'releases', '0001.json');
    const t = JSON.parse(readFileSync(f, 'utf8'));
    t.document.entries.push({ id: 'evil' });
    writeFileSync(f, JSON.stringify(t));
    expect(releases.verify(d).ok).toBe(false);
    expect(() => releases.rollback(d, 2, '张三', 'x')).toThrow();
  });
});

describe('cli', () => {
  it('promote → approve → rollback round trip, per-action releases, reviewer required', async () => {
    const dir = tmp();
    const store = new LibraryStore(dir);
    const quiet = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const quietErr = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      expect(await main(['promote', 'cf-rule-s01'], store, TODAY, {})).toBe(2); // 没有审核人
      expect(await main(['promote', 'cf-rule-s01', '--reviewer', '张三'], store, TODAY, {})).toBe(0);
      expect(await main(['promote', 'cf-rule-s01', '--reviewer', '张三'], store, TODAY, {})).toBe(2); // 不能重复
      expect(await main(['promote', 'nope', '--reviewer', '张三'], store, TODAY, {})).toBe(2);
      expect(await main(['approve', 'cf-rule-s01', '--reviewer', '张三'], store, TODAY, {})).toBe(0);
      expect(store.loadDoc().entries.find((e) => e.id === 'cf-rule-s01')!.review_status).toBe('已审核');
      expect(releases.listReleases(dir).map((r) => r.action)).toEqual(['baseline', 'promote', 'approve']);
      expect(await main(['rollback', 'v1', '--reviewer', '张三'], store, TODAY, {})).toBe(2); // 回滚必须写原因
      expect(await main(['rollback', 'v1', '--reviewer', '张三', '--note', '演练'], store, TODAY, {})).toBe(0);
      expect(store.loadDoc().entries.some((e) => e.id === 'cf-rule-s01')).toBe(false);
      expect(await main(['releases', '-', '--reviewer', '张三'], store, TODAY, {})).toBe(0);
    } finally {
      quiet.mockRestore();
      quietErr.mockRestore();
    }
  });
  it('gate reports; approve is blocked when LIBRARY_PROMOTE_GATE=1 and the gate rejects', async () => {
    const dir = tmp();
    const store = new LibraryStore(dir);
    const quiet = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const quietErr = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      expect(await main(['gate', 'cf-rule-s01', '--reviewer', '张三'], store, TODAY, {})).toBe(0);
      // 造一个不过闸门的暂存候选（B 级无第二来源）
      writeFileSync(join(dir, 'staged_entries.json'), JSON.stringify({ entries: [good({ id: 'cf-rule-x1', source: { ...good().source, tier: 'B' } })] }));
      expect(await main(['gate', 'cf-rule-x1', '--reviewer', '张三'], store, TODAY, {})).toBe(4);
      expect(await main(['promote', 'cf-rule-x1', '--reviewer', '张三'], store, TODAY, {})).toBe(0); // 暂存→待审核仍允许（用户看不到）
      expect(gateEnforced({ LIBRARY_PROMOTE_GATE: '1' })).toBe(true);
      expect(gateEnforced({})).toBe(false);
      expect(await main(['approve', 'cf-rule-x1', '--reviewer', '张三'], store, TODAY, { LIBRARY_PROMOTE_GATE: '1' })).toBe(2);
      expect(store.loadDoc().entries.find((e) => e.id === 'cf-rule-x1')!.review_status).toBe('待审核');
      expect(await main(['approve', 'cf-rule-x1', '--reviewer', '张三'], store, TODAY, {})).toBe(0); // 闸门关闭时流程不变
    } finally {
      quiet.mockRestore();
      quietErr.mockRestore();
    }
  });
});

describe('promote_gate job', () => {
  const cfg = (dir: string, enabled: boolean): SILConfig => ({ ...(({} as unknown) as SILConfig), product: 'contentflow', enabled, dataDir: dir } as SILConfig);
  it('is off by default, never writes the library, slot is Wednesday 07:00', () => {
    const libDir = tmp();
    const prev = process.env.LIBRARY_DATA_DIR;
    process.env.LIBRARY_DATA_DIR = libDir;
    try {
      const dir = tmp();
      expect(runContinuousIfEnabled('promote_gate', cfg(dir, false), TODAY)).toBeNull();
      const r = runContinuous('promote_gate', cfg(dir, true), TODAY) as { keep: string[]; new_keep: string[] };
      expect(r.keep).toEqual(expect.arrayContaining(['cf-rule-s01', 'cf-rule-s02']));
      expect(existsSync(join(dir, 'continuous', 'promote_gate_report.md'))).toBe(true);
      expect(existsSync(join(libDir, 'reference_entries.json'))).toBe(false);
      expect((runContinuous('promote_gate', cfg(dir, true), TODAY) as { new_keep: string[] }).new_keep).toEqual([]);
    } finally {
      if (prev === undefined) delete process.env.LIBRARY_DATA_DIR;
      else process.env.LIBRARY_DATA_DIR = prev;
    }
    expect(CONTINUOUS_SLOTS.promote_gate).toBe('weekly:WED@07:00');
    const n = nextRun(CONTINUOUS_CRON.promote_gate, TODAY);
    expect(new Date(n.getTime() + 8 * 3_600_000).getUTCDay()).toBe(3); // 上海时间周三
    expect(new Date(n.getTime() + 8 * 3_600_000).getUTCHours()).toBe(7);
  });
});
