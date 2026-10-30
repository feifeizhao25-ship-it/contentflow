import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { ApprovalPolicy, Gateway, NullGateway, approvalPolicyFromEnv, buildCard, canApprove, isTimedOut } from './approval';
import { checkCompliance } from './compliance';
import { SILConfig } from './config';
import { KnowledgeEntry, retirementScan } from './freshness';
import { EvalItem, GateResult, Metrics, checkSetSeparation, editBudget, evaluateGates } from './gates';
import { SourcePolicy, SourceRecord, lintSource, scanInjection } from './sources';
import { Candidate, CandidateStore, IllegalTransition } from './store';

export interface EvalOutcome {
  baseline: Metrics;
  candidate: Metrics;
  noSkill?: Metrics | null;
  standardErrors?: Metrics;
}

export interface Hooks {
  collect: () => Promise<SourceRecord[]> | SourceRecord[];
  propose: (clean: SourceRecord[], budget: number) => Promise<Candidate[]> | Candidate[];
  evaluate: (c: Candidate) => Promise<EvalOutcome> | EvalOutcome;
  /** 晋升；返回回滚快照 */
  apply: (c: Candidate) => Promise<Record<string, any>> | Record<string, any>;
  rollback: (c: Candidate) => Promise<void> | void;
  entries?: () => KnowledgeEntry[];
  hits90d?: () => Record<string, number>;
  gateSets?: () => { optimization: EvalItem[]; gate: EvalItem[]; heldout: EvalItem[] };
}

export interface CycleReport {
  status: 'ok' | 'disabled' | 'aborted';
  started_at: string;
  budget: number;
  sources_seen: number;
  sources_rejected: { id?: string; why: string[] }[];
  proposed: string[];
  rejected: [string, string[]][];
  pending_approval: string[];
  promoted: string[];
  expired: string[];
  blocked: [string, string][];
  warnings: string[];
  problems: string[];
}

const emptyReport = (at: string): CycleReport => ({ status: 'ok', started_at: at, budget: 0, sources_seen: 0, sources_rejected: [], proposed: [], rejected: [], pending_approval: [], promoted: [], expired: [], blocked: [], warnings: [], problems: [] });

/**
 * 每周自改进闭环：采集 → 清洗 → 隔离 → 提案 → 评测 → 合规 → 审批 → 晋升 → 回滚。
 * 外部能力都由 Hooks 注入；本类不联网、不调模型。默认关闭；用户可见改动必须经企业微信批准，超时作废。
 */
export class SelfImprovementLoop {
  readonly store: CandidateStore;
  private readonly policy: SourcePolicy;
  private readonly approval: ApprovalPolicy;
  private readonly gateway: Gateway;

  constructor(
    private readonly cfg: SILConfig,
    private readonly hooks: Hooks,
    opts: { sourcePolicy?: SourcePolicy; approval?: ApprovalPolicy; gateway?: Gateway; store?: CandidateStore; extraLiterals?: string[] } = {},
  ) {
    this.policy = opts.sourcePolicy ?? { allowedDomains: cfg.allowedDomains };
    this.approval = opts.approval ?? approvalPolicyFromEnv();
    this.gateway = opts.gateway ?? new NullGateway();
    this.store = opts.store ?? new CandidateStore(cfg.dataDir);
    this.extraLiterals = opts.extraLiterals ?? [];
  }
  private readonly extraLiterals: string[];

  private get histPath() {
    return join(this.cfg.dataDir, 'weekly_history.json');
  }
  private history(): { week: string; net_gain: number }[] {
    return existsSync(this.histPath) ? JSON.parse(readFileSync(this.histPath, 'utf8')) : [];
  }
  private writeReport(rep: CycleReport, now: Date, kind: string) {
    const d = join(this.cfg.dataDir, 'reports');
    mkdirSync(d, { recursive: true });
    writeFileSync(join(d, `${kind}-${now.toISOString().slice(0, 10)}.json`), JSON.stringify(rep, null, 2), 'utf8');
  }

  async runWeekly(now: Date): Promise<CycleReport> {
    const iso = new Date(now.getTime() + 8 * 3_600_000).toISOString().slice(0, 19) + '+08:00';
    this.store.setClock(() => iso);
    const rep = emptyReport(iso);
    if (!this.cfg.enabled) return { ...rep, status: 'disabled' };
    if (this.hooks.gateSets) {
      const s = this.hooks.gateSets();
      rep.problems = checkSetSeparation(s.optimization, s.gate, s.heldout);
      if (rep.problems.length) {
        rep.status = 'aborted'; // 评测集污染时不得继续「改进」
        this.writeReport(rep, now, 'weekly');
        return rep;
      }
    }
    this.expire(now, rep);
    await this.promoteApproved(rep);

    const hist = this.history();
    rep.budget = Math.min(this.cfg.maxProposalsPerWeek, editBudget(hist));
    const clean: SourceRecord[] = [];
    for (const rec of await this.hooks.collect()) {
      rep.sources_seen++;
      const lint = lintSource(rec, this.policy);
      if (!lint.ok || lint.injectionFlags.length) {
        const why = [...lint.violations, ...(lint.injectionFlags.length ? [`injection:${lint.injectionFlags.length}`] : [])];
        rep.sources_rejected.push({ id: rec.id, why });
        this.store.ledger.append({ t: iso, source_rejected: rec.id ?? null, why });
        continue;
      }
      clean.push(rec);
    }
    const drafts = (await this.hooks.propose(clean, rep.budget)).slice(0, rep.budget);
    for (const draft of drafts) {
      draft.origin = draft.origin === 'external' || draft.origin === 'internal' ? draft.origin : 'generated';
      const c = this.store.add(draft);
      if (c.state !== 'quarantined') continue; // 同 id 已处理过
      rep.proposed.push(c.id);
      await this.evaluateOne(c, rep);
    }
    this.writeHistory([...hist, { week: now.toISOString().slice(0, 10), net_gain: rep.promoted.length }]);
    this.writeReport(rep, now, 'weekly');
    return rep;
  }

  private writeHistory(h: { week: string; net_gain: number }[]) {
    mkdirSync(this.cfg.dataDir, { recursive: true });
    writeFileSync(this.histPath, JSON.stringify(h.slice(-26)), 'utf8');
  }

  private async evaluateOne(c: Candidate, rep: CycleReport): Promise<void> {
    const reasons: string[] = [];
    if (c.origin === 'generated') reasons.push('origin_generated_forbidden');
    const text = [c.summary, c.payload.text ?? '', c.payload.answer ?? ''].join(' ');
    const res = checkCompliance(text, this.cfg.families, this.extraLiterals);
    if (!res.ok) reasons.push(...res.families.map((f) => `compliance:${f}`));
    if (scanInjection(text).length) reasons.push('injection_suspected');
    if (reasons.length) {
      this.store.transition(c.id, 'rejected', { reasons });
      rep.rejected.push([c.id, reasons]);
      return;
    }
    const out = await this.hooks.evaluate(c);
    const gate: GateResult = evaluateGates(out.baseline, out.candidate, this.cfg.thresholds, { standardErrors: out.standardErrors, noSkill: out.noSkill, primary: 'redteam_pass_rate' });
    this.store.transition(c.id, 'evaluated', { gates: { passed: gate.passed, reasons: gate.reasons, checked: gate.checked } });
    if (!gate.passed) {
      this.store.transition(c.id, 'rejected', { reasons: gate.reasons });
      rep.rejected.push([c.id, gate.reasons]);
      return;
    }
    if (c.user_visible || c.needs_expert || !this.cfg.autoPromoteInternal) {
      this.store.transition(c.id, 'pending_approval');
      rep.pending_approval.push(c.id);
      const to = Array.from(this.approval.reviewers).sort();
      if (!to.length) rep.warnings.push(`no_reviewers_configured:${c.id}`); // TODO(owner): 填写 POLICY_REVIEWERS
      else {
        try {
          await this.gateway.send(buildCard(c, true), to);
        } catch (e) {
          rep.warnings.push(`approval_send_failed:${c.id}:${(e as Error).message}`); // 发不出去也不能晋升
        }
      }
    } else {
      this.store.transition(c.id, 'auto_ready');
      await this.promote(c.id, rep);
    }
  }

  /** 企业微信回调调用。名单外（含名单为空）一律拒绝。 */
  recordDecision(id: string, reviewer: string, approve: boolean, now?: Date): Candidate {
    if (!canApprove(this.approval, reviewer)) throw new Error('reviewer_not_authorised');
    if (now) {
      const iso = new Date(now.getTime() + 8 * 3_600_000).toISOString().slice(0, 19) + '+08:00';
      this.store.setClock(() => iso);
    }
    const c = this.store.get(id);
    if (c.state !== 'pending_approval') throw new IllegalTransition(`${c.state}->decision`);
    return this.store.transition(id, approve ? 'approved' : 'rejected', { reviewer });
  }

  private expire(now: Date, rep: CycleReport) {
    for (const c of this.store.list('pending_approval')) {
      if (isTimedOut(c.updated_at, now, this.approval.timeoutHours)) {
        this.store.transition(c.id, 'expired', { reason: 'approval_timeout' });
        rep.expired.push(c.id);
      }
    }
  }

  private async promoteApproved(rep: CycleReport) {
    for (const c of this.store.list('approved')) {
      if (c.needs_expert && !c.payload.expert_attestation) {
        rep.blocked.push([c.id, 'expert_signoff_required']); // 永不代签
        continue;
      }
      await this.promote(c.id, rep);
    }
  }

  private async promote(id: string, rep: CycleReport) {
    const snap = await this.hooks.apply(this.store.get(id));
    this.store.transition(id, 'promoted', { snapshot: snap });
    rep.promoted.push(id);
  }

  /** 晋升后复核；跌破下限自动回滚。返回是否回滚。 */
  async monitor(id: string, live: Metrics, baseline: Metrics, se?: Metrics): Promise<boolean> {
    const c = this.store.get(id);
    if (c.state !== 'promoted') return false;
    const res = evaluateGates(baseline, live, this.cfg.thresholds, { standardErrors: se, noSkill: live, primary: 'redteam_pass_rate' });
    const regress = res.reasons.filter((r) => /^(regression:|redteam|citation|faithfulness)/.test(r));
    if (!regress.length) return false;
    await this.hooks.rollback(c);
    this.store.transition(id, 'rolled_back', { reasons: regress });
    return true;
  }

  async rollback(id: string, reason = 'manual'): Promise<Candidate> {
    await this.hooks.rollback(this.store.get(id));
    return this.store.transition(id, 'rolled_back', { reasons: [reason] });
  }

  /** 每月库清点：只返回要降级的名单，不删除任何东西。 */
  runMonthly(today: Date): Record<string, unknown> {
    if (!this.cfg.enabled || !this.hooks.entries) return { status: this.cfg.enabled ? 'no_entries_hook' : 'disabled' };
    const rep = retirementScan(this.hooks.entries(), today, this.hooks.hits90d?.());
    const out = { status: 'ok', retire: rep.retireIds, expiring_soon: rep.expiringSoon, expired: rep.expired, superseded: rep.superseded, idle: rep.idle };
    const d = join(this.cfg.dataDir, 'reports');
    mkdirSync(d, { recursive: true });
    writeFileSync(join(d, `monthly-${today.toISOString().slice(0, 10)}.json`), JSON.stringify(out, null, 2), 'utf8');
    this.store.ledger.append({ t: today.toISOString().slice(0, 10), monthly_retirement: rep.retireIds });
    return out;
  }
}
