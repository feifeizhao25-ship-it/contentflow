import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs';
import { join } from 'path';

/**
 * 技能 / 知识条目的效用账本与「退役名单」。思路来自 Selm（arXiv 2610.24630）：
 * 按效用重排检索、验证门（本仓 gates.ts 已有）、名字级退役名单。
 * 论文里的数值（容量 30、EMA α=0.4）只是起点，必须用本产品自己的评测集离线校准，这里全部可配置。
 * 只记录、排序、给出建议；不会自动删除或改动任何线上内容。
 */
export const DEFAULT_ALPHA = 0.4;
export const DEFAULT_UTILITY = 0.5;

/** 名字级匹配：NFKC、小写、去掉空白与标点，避免靠改标点/全半角让同名复活。 */
export function normalizeName(name: string): string {
  return String(name ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

export interface UtilityRecord {
  ema: number;
  n: number;
  last_seen: string;
}
interface LedgerFile {
  records: Record<string, UtilityRecord>;
  graveyard: Record<string, { name: string; reason: string; date: string }>;
}

export class UtilityLedger {
  private readonly path: string;
  constructor(
    private readonly root: string,
    private readonly opts: { alpha?: number; capacity?: number; clock?: () => string } = {},
  ) {
    const a = opts.alpha ?? DEFAULT_ALPHA;
    if (!(a > 0 && a <= 1)) throw new Error('alpha_out_of_range');
    this.path = join(root, 'utility_ledger.json');
  }
  private get alpha() {
    return this.opts.alpha ?? DEFAULT_ALPHA;
  }
  private today(): string {
    return this.opts.clock ? this.opts.clock() : new Date().toISOString().slice(0, 10);
  }
  private load(): LedgerFile {
    if (!existsSync(this.path)) return { records: {}, graveyard: {} };
    const d = JSON.parse(readFileSync(this.path, 'utf8'));
    return { records: d.records ?? {}, graveyard: d.graveyard ?? {} };
  }
  private save(d: LedgerFile) {
    mkdirSync(this.root, { recursive: true });
    const tmp = `${this.path}.tmp-${process.pid}`;
    writeFileSync(tmp, JSON.stringify(d, null, 2), 'utf8');
    renameSync(tmp, this.path);
  }

  /** 记一次观测（0..1，1=有用/通过）。EMA：新值 = α·观测 + (1-α)·旧值；首次观测直接取观测值。 */
  record(name: string, outcome: number): UtilityRecord {
    if (!(outcome >= 0 && outcome <= 1)) throw new Error('outcome_out_of_range');
    const key = normalizeName(name);
    if (!key) throw new Error('empty_name');
    const d = this.load();
    const rec = d.records[key] ?? { ema: DEFAULT_UTILITY, n: 0, last_seen: '' };
    rec.ema = rec.n === 0 ? outcome : this.alpha * outcome + (1 - this.alpha) * rec.ema;
    rec.n += 1;
    rec.last_seen = this.today();
    d.records[key] = rec;
    this.save(d);
    return rec;
  }
  get(name: string): UtilityRecord {
    return this.load().records[normalizeName(name)] ?? { ema: DEFAULT_UTILITY, n: 0, last_seen: '' };
  }
  utility(name: string, dflt = DEFAULT_UTILITY): number {
    const r = this.load().records[normalizeName(name)];
    return !r || r.n === 0 ? dflt : r.ema;
  }
  /** 效用感知重排：score = (1-w)·相关度 + w·效用。weight=0 即纯相关度。稳定排序。 */
  rank(items: [string, number][], weight = 0.3): [string, number][] {
    if (!(weight >= 0 && weight <= 1)) throw new Error('weight_out_of_range');
    const recs = this.load().records;
    const u = (n: string) => {
      const r = recs[normalizeName(n)];
      return !r || r.n === 0 ? DEFAULT_UTILITY : r.ema;
    };
    return items
      .map(([n, rel], i) => ({ n, s: (1 - weight) * rel + weight * u(n), i }))
      .sort((a, b) => b.s - a.s || a.i - b.i)
      .map((x) => [x.n, x.s] as [string, number]);
  }

  bury(name: string, reason: string, today?: string): void {
    const key = normalizeName(name);
    if (!key || !reason) throw new Error('name_and_reason_required');
    const d = this.load();
    d.graveyard[key] = { name: String(name), reason, date: today ?? this.today() };
    this.save(d);
  }
  isBuried(name: string): boolean {
    return normalizeName(name) in this.load().graveyard;
  }
  graveyard(): LedgerFile['graveyard'] {
    return { ...this.load().graveyard };
  }
  /** 只有有权批准的人才能把名字放回；名单为空时无人可放（沿用 POLICY_REVIEWERS 语义）。 */
  unbury(name: string, reviewer: string, canApprove: (r: string) => boolean): boolean {
    if (!canApprove(reviewer)) throw new Error('reviewer_not_authorised');
    const d = this.load();
    const key = normalizeName(name);
    if (!(key in d.graveyard)) return false;
    delete d.graveyard[key];
    this.save(d);
    return true;
  }
  /** 观测够多且效用仍低 → 建议退役（只给名单，由调用方走审批）。 */
  retireCandidates(minObs = 5, below = 0.3): string[] {
    return Object.entries(this.load().records)
      .filter(([, r]) => r.n >= minObs && r.ema < below)
      .map(([k]) => k)
      .sort();
  }
  /** 超过容量时，建议合并/删除的名字（效用最低的优先）。不超容量返回空。 */
  prunePlan(names: string[]): string[] {
    const cap = this.opts.capacity;
    if (!cap || names.length <= cap) return [];
    return [...names].sort((a, b) => this.utility(a) - this.utility(b) || a.localeCompare(b)).slice(0, names.length - cap);
  }
}
