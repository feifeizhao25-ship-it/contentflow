import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { NullGateway, approvalPolicyFromEnv } from './approval';
import { configFromEnv } from './config';
import { DRAFT_NOTICE_ZH, KnowledgeEntry, answerNotice, entryStatus, factAllowed, resolveConflict, retrievable, validateEntry } from './freshness';
import { DEFAULT_THRESHOLDS, evaluateGates } from './gates';
import { PROMPT_VARIANTS, buildPrompt, cohensKappa, debiasedVote, judgeUsable } from './judge';
import { Hooks, SelfImprovementLoop } from './loop';
import { CONTENTFLOW_THRESHOLDS } from './self-improve.service';
import { newCandidate } from './store';
import { UtilityLedger } from './utility';
import { englishWords, zhOnlyOk, zhOnlyRate } from './zh-gate';

const tmp = () => mkdtempSync(join(tmpdir(), 'sil11-'));
const T0 = new Date('2026-11-01T03:00:00+08:00');
const TODAY = new Date('2026-11-01T00:00:00+08:00');

describe('效用账本与退役名单', () => {
  it('EMA：首次取观测值，之后 α=0.4', () => {
    const led = new UtilityLedger(tmp(), { alpha: 0.4 });
    expect(led.utility('skill-a')).toBe(0.5);
    expect(led.record('skill-a', 1).ema).toBe(1);
    expect(led.record('skill-a', 0).ema).toBeCloseTo(0.6);
    expect(led.record('skill-a', 0).ema).toBeCloseTo(0.36);
    expect(led.get('skill-a').n).toBe(3);
    expect(() => led.record('skill-a', 1.5)).toThrow('outcome_out_of_range');
    expect(() => new UtilityLedger(tmp(), { alpha: 0 })).toThrow('alpha_out_of_range');
  });
  it('重排按效用；weight=0 回到纯相关度', () => {
    const led = new UtilityLedger(tmp());
    led.record('good', 1);
    led.record('bad', 0);
    const items: [string, number][] = [['bad', 0.8], ['good', 0.75]];
    expect(led.rank(items, 0).map((x) => x[0])).toEqual(['bad', 'good']);
    expect(led.rank(items, 0.5).map((x) => x[0])).toEqual(['good', 'bad']);
    expect(() => led.rank(items, 2)).toThrow('weight_out_of_range');
  });
  it('退役名单按名字匹配（空白/标点/全角不能让同名复活），移出需有权限的审批人', () => {
    const led = new UtilityLedger(tmp());
    led.bury('旧 技能-A', '效用长期偏低', '2026-10-31');
    expect(led.isBuried('旧技能a')).toBe(true);
    expect(led.isBuried('旧 技能-A ')).toBe(true);
    expect(led.isBuried('旧技能Ａ')).toBe(true);
    expect(led.isBuried('旧技能B')).toBe(false);
    expect(() => led.unbury('旧技能a', 'alice', () => false)).toThrow('reviewer_not_authorised');
    expect(led.isBuried('旧技能a')).toBe(true);
    expect(led.unbury('旧技能a', 'alice', (r) => r === 'alice')).toBe(true);
    expect(led.isBuried('旧技能a')).toBe(false);
    expect(() => led.bury('x', '')).toThrow('name_and_reason_required');
  });
  it('退役候选与容量裁剪只给名单', () => {
    const led = new UtilityLedger(tmp(), { capacity: 2 });
    for (let i = 0; i < 5; i++) led.record('weak', 0);
    led.record('new-one', 0);
    expect(led.retireCandidates(5, 0.3)).toEqual(['weak']);
    expect(led.prunePlan(['a', 'b'])).toEqual([]);
    led.record('keep1', 1);
    led.record('keep2', 0.9);
    expect(led.prunePlan(['weak', 'keep1', 'keep2'])).toEqual(['weak']);
  });
});

describe('状态字段', () => {
  const e = (o: Partial<KnowledgeEntry> = {}): KnowledgeEntry => ({ id: 'e1', source_tier: 'official', license: 'gov-public', valid_from: '2026-01-01', valid_until: '2027-01-01', content_hash: 'h', origin: 'external', url: 'https://www.gov.cn/x', lang: 'zh', ...o });
  it('征求意见稿可检索但不是事实，回答必须带提示', () => {
    expect(validateEntry(e())).toEqual([]);
    expect(validateEntry(e({ status: 'foo' }))).toContain('bad_status:foo');
    const draft = e({ status: 'draft_consultation', valid_until: undefined });
    expect(retrievable(draft, TODAY)).toEqual({ ok: true, why: 'draft_consultation' });
    expect(factAllowed(draft)).toBe(false);
    expect(answerNotice(draft)).toBe(DRAFT_NOTICE_ZH);
    expect(DRAFT_NOTICE_ZH).toContain('征求意见稿');
    expect(answerNotice(e())).toBe('');
    expect(entryStatus(draft, TODAY)).toBe('draft_consultation');
  });
  it('被取代/过期不可检索；系统生成的内容仍然不可检索', () => {
    expect(retrievable(e({ status: 'superseded' }), TODAY).why).toBe('superseded');
    expect(retrievable(e({ superseded_by: 'e2' }), TODAY).why).toBe('superseded');
    expect(retrievable(e({ status: 'expired' }), TODAY).why).toBe('expired');
    expect(retrievable(e({ valid_until: '2026-10-01' }), TODAY).why).toBe('expired');
    expect(retrievable(e({ origin: 'generated', status: 'draft_consultation' }), TODAY).why).toBe('origin_generated');
    expect(entryStatus(e({ valid_until: '2026-10-01' }), TODAY)).toBe('expired');
    expect(entryStatus(e({ superseded_by: 'e2' }), TODAY)).toBe('superseded');
    expect(entryStatus(e(), TODAY)).toBe('in_force');
  });
  it('证据冲突取舍：状态 > 来源层级 > 中文优先 > 交人工', () => {
    expect(resolveConflict(e({ id: 'a' }), e({ id: 'b', status: 'draft_consultation' })).winner).toBe('a');
    expect(resolveConflict(e({ id: 'm', source_tier: 'academic' }), e({ id: 'o' })).winner).toBe('o');
    const r = resolveConflict(e({ id: 'n', lang: 'en' }), e({ id: 'z', lang: 'zh' }));
    expect(r).toEqual({ winner: 'z', rule: 'prefer_zh_official', annotate: true });
    expect(resolveConflict(e({ id: 'c', lang: 'cn' }), e({ id: 'n', lang: 'en' })).winner).toBe('c');
    expect(resolveConflict(e({ id: 'p' }), e({ id: 'q' }))).toEqual({ winner: null, rule: 'escalate_human', annotate: true });
  });
});

describe('零英文门与额外门禁下限', () => {
  it('英文词检测', () => {
    expect(zhOnlyOk('该项目年上网电量不超过总可用发电量的 20%，装机 12.97 亿 kW，依据 GB 50797。')).toBe(true);
    expect(englishWords('请使用 smart contract 结算')).toEqual(['smart', 'contract']);
    expect(zhOnlyOk('详见 https://www.gov.cn/zhengce/x 与 a@b.com')).toBe(true);
    expect(zhOnlyRate(['全中文回答', '含 hello 的回答'])).toBe(0.5);
    expect(zhOnlyRate([])).toBe(0);
  });
  it('extraFloors 缺失即不通过；默认不设不影响现有行为', () => {
    const good = { recall_at_8: 0.9, faithfulness: 0.95, citation_accuracy: 1, freshness_correctness: 0.99, redteam_pass_rate: 1, calc_error: 0.005, cost_ratio: 1, latency_ratio: 1 };
    const base = { ...good, recall_at_8: 0.89 };
    const th = { ...DEFAULT_THRESHOLDS, extraFloors: [['zh_only_rate', 1.0]] as [string, number][] };
    expect(evaluateGates(base, good, th, { noSkill: { recall_at_8: 0.7 } }).reasons).toContain('missing_metric:zh_only_rate');
    expect(evaluateGates(base, { ...good, zh_only_rate: 1 }, th, { noSkill: { recall_at_8: 0.7 } }).passed).toBe(true);
    expect(DEFAULT_THRESHOLDS.extraFloors).toBeUndefined();
  });
});

describe('评审去偏与校准', () => {
  it('多评审员去偏投票', () => {
    const alwaysFirst = () => 'first' as const;
    const prefersA = (x: string) => (x.startsWith('A') ? ('first' as const) : ('second' as const));
    const prefersB = (x: string) => (x.startsWith('B') ? ('first' as const) : ('second' as const));
    const a = 'A答案内容';
    const b = 'B答案内容';
    expect(debiasedVote([alwaysFirst], a, b)).toBe('tie');
    expect(debiasedVote([prefersA, prefersA, prefersB], a, b)).toBe('a');
    expect(debiasedVote([prefersA, prefersB], a, b)).toBe('tie');
    expect(debiasedVote([prefersA], 'A'.repeat(100), 'B')).toBe('length_confound');
    expect(() => debiasedVote([], a, b)).toThrow('no_judges');
  });
  it('提示词变体与 kappa 校准', () => {
    for (const v of PROMPT_VARIANTS) {
      const p = buildPrompt(v, '问', '答1', '答2');
      expect(p).toContain('first');
      expect(p).toContain('tie');
    }
    expect(buildPrompt('bias_reminder', '问', 'a', 'b')).toContain('忽略回答的长度');
    expect(() => buildPrompt('nope', 'q', 'a', 'b')).toThrow('unknown_variant');
    const human = Array.from({ length: 30 }, (_, i) => ['a', 'b', 'tie'][i % 3]);
    expect(cohensKappa(human, human)).toBeCloseTo(1);
    expect(judgeUsable(human, human).ok).toBe(true);
    expect(judgeUsable(human, Array(30).fill('a')).ok).toBe(false);
    expect(judgeUsable(human.slice(0, 5), human.slice(0, 5)).why).toMatch(/^too_few_human_labels/);
  });
});

describe('循环：退役名单、自引用、效用记录、指标', () => {
  function make(over: Partial<Hooks> = {}, reviewers = 'boss') {
    const dir = tmp();
    const cfg = configFromEnv('t', { SIL_ENABLED: '1' } as any, { dataDir: dir, thresholds: CONTENTFLOW_THRESHOLDS });
    const applied: string[] = [];
    const hooks: Hooks = {
      collect: () => [{ id: 's1', origin: 'internal', license: 'internal', text: '' }],
      propose: (_c, n) => [newCandidate({ id: 'p1', kind: 'rule', target: 'rule/x', summary: '提醒复核来源', origin: 'internal' })].slice(0, n),
      evaluate: () => ({ baseline: { redteam_pass_rate: 1 }, candidate: { redteam_pass_rate: 1, cost_ratio: 1, latency_ratio: 1 }, noSkill: { redteam_pass_rate: 0.4 } }),
      apply: (c) => (applied.push(c.id), { before: 1 }),
      rollback: () => undefined,
      ...over,
    };
    const loop = new SelfImprovementLoop(cfg, hooks, { approval: approvalPolicyFromEnv({ POLICY_REVIEWERS: reviewers } as any), gateway: new NullGateway() });
    return { loop, applied, dir };
  }
  it('退役名单拦截同名提案，并进入指标', async () => {
    const { loop, applied } = make();
    loop.retire('Rule/X', '长期无命中', T0);
    const rep = await loop.runWeekly(T0);
    expect(rep.rejected[0][1]).toContain('graveyard');
    expect(rep.pending_approval).toEqual([]);
    expect(applied).toEqual([]);
    expect((rep.metrics as any).rejected_by_reason.graveyard).toBe(1);
    expect((rep.metrics as any).graveyard_size).toBe(1);
    expect(loop.store.ledger.verify()).toBe(true);
  });
  it('移出退役名单只能由审批人；名单为空时无人可移出', () => {
    const { loop } = make();
    loop.retire('kb/x', 'r', T0);
    expect(() => loop.unretire('kb/x', 'mallory')).toThrow('reviewer_not_authorised');
    expect(loop.unretire('kb/x', 'boss')).toBe(true);
    const { loop: l2 } = make({}, '');
    l2.retire('kb/y', 'r', T0);
    expect(() => l2.unretire('kb/y', 'boss')).toThrow('reviewer_not_authorised');
  });
  it('证据来自系统自己的输出 → 拒绝（防自我投毒）', async () => {
    const { loop } = make({
      propose: () => [
        newCandidate({ id: 'c1', kind: 'rule', target: 'r/1', summary: 's', origin: 'internal', evidence: [{ url: 'file:///var/self_improve/t/reports/weekly.json' }] }),
        newCandidate({ id: 'c2', kind: 'rule', target: 'r/2', summary: 's', origin: 'internal', evidence: [{ url: 'https://x/var/self_improve/t/candidates/c1.json' }] }),
      ],
    });
    const rep = await loop.runWeekly(T0);
    expect(rep.rejected.map((r) => r[0]).sort()).toEqual(['c1', 'c2']);
    expect(rep.rejected.every((r) => r[1].includes('self_citation'))).toBe(true);
  });
  it('晋升后观察：不退步记 1，回滚记 0；周报带指标', async () => {
    const { loop } = make();
    const rep = await loop.runWeekly(T0);
    expect(rep.pending_approval).toEqual(['p1']);
    expect((rep.metrics as any).proposed).toBe(1);
    loop.recordDecision('p1', 'boss', true, new Date('2026-11-02T10:00:00+08:00'));
    await loop.runWeekly(new Date('2026-11-08T03:00:00+08:00'));
    const ok = { redteam_pass_rate: 1, cost_ratio: 1, latency_ratio: 1 };
    expect(await loop.monitor('p1', ok, { redteam_pass_rate: 1 })).toBe(false);
    expect(loop.utility.utility('rule/x')).toBe(1);
    expect(await loop.monitor('p1', { ...ok, redteam_pass_rate: 0.9 }, { redteam_pass_rate: 1 })).toBe(true);
    expect(loop.utility.utility('rule/x')).toBeCloseTo(0.6);
  });
});
