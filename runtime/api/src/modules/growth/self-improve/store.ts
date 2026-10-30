import { createHash } from 'crypto';
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'fs';
import { join } from 'path';

export type CandidateState = 'quarantined' | 'evaluated' | 'pending_approval' | 'auto_ready' | 'approved' | 'promoted' | 'rejected' | 'expired' | 'rolled_back';

export const TRANSITIONS: Record<CandidateState, CandidateState[]> = {
  quarantined: ['evaluated', 'rejected'],
  evaluated: ['pending_approval', 'auto_ready', 'rejected'],
  pending_approval: ['approved', 'rejected', 'expired'],
  approved: ['promoted', 'rejected'],
  auto_ready: ['promoted', 'rejected'],
  promoted: ['rolled_back'],
  rejected: [],
  expired: [],
  rolled_back: [],
};

export class IllegalTransition extends Error {}

export interface Candidate {
  id: string;
  kind: 'kb_entry' | 'prompt' | 'skill' | 'rule' | 'index_param';
  target: string;
  summary: string;
  payload: Record<string, any>;
  evidence: { url?: string; retrieved_at?: string; hash?: string }[];
  /** 默认按用户可见处理 → 必须走企业微信审批 */
  user_visible: boolean;
  /** 需要真实专家签字；本系统永不代签 */
  needs_expert: boolean;
  origin: 'external' | 'internal' | 'generated';
  state: CandidateState;
  created_at: string;
  updated_at: string;
  history: Record<string, any>[];
  snapshot: Record<string, any> | null;
}

export function newCandidate(p: Pick<Candidate, 'id' | 'kind' | 'target' | 'summary'> & Partial<Candidate>): Candidate {
  return { payload: {}, evidence: [], user_visible: true, needs_expert: false, origin: 'external', state: 'quarantined', created_at: '', updated_at: '', history: [], snapshot: null, ...p };
}

const ZERO = '0'.repeat(64);
const sortKeys = (v: any): any => (Array.isArray(v) ? v.map(sortKeys) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])])) : v);
const canon = (v: unknown) => JSON.stringify(sortKeys(v));

/** 追加写 JSONL，每行带上一行的 hash；verify() 可发现篡改。 */
export class Ledger {
  constructor(private readonly path: string) {}

  entries(): { event: any; prev: string; hash: string }[] {
    if (!existsSync(this.path)) return [];
    return readFileSync(this.path, 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l));
  }

  append(event: Record<string, unknown>): void {
    mkdirSync(join(this.path, '..'), { recursive: true });
    const rows = this.entries();
    const prev = rows.length ? rows[rows.length - 1].hash : ZERO;
    const hash = createHash('sha256').update(canon({ event, prev })).digest('hex');
    appendFileSync(this.path, `${canon({ event, prev, hash })}\n`, 'utf8');
  }

  verify(): boolean {
    let prev = ZERO;
    for (const row of this.entries()) {
      const h = createHash('sha256').update(canon({ event: row.event, prev: row.prev })).digest('hex');
      if (row.prev !== prev || h !== row.hash) return false;
      prev = row.hash;
    }
    return true;
  }
}

export function shanghaiIso(d = new Date()): string {
  const t = new Date(d.getTime() + 8 * 3_600_000).toISOString().slice(0, 19);
  return `${t}+08:00`;
}

export class CandidateStore {
  readonly ledger: Ledger;
  private clock: () => string = () => shanghaiIso();

  constructor(private readonly root: string) {
    mkdirSync(join(root, 'candidates'), { recursive: true });
    this.ledger = new Ledger(join(root, 'changelog.jsonl'));
  }

  setClock(fn: () => string): void {
    this.clock = fn;
  }

  private file(id: string): string {
    if (!id || !/^[A-Za-z0-9._-]+$/.test(id)) throw new Error('bad_candidate_id');
    return join(this.root, 'candidates', `${id}.json`);
  }

  private write(c: Candidate): void {
    const f = this.file(c.id);
    writeFileSync(`${f}.tmp`, JSON.stringify(c, null, 2), 'utf8');
    renameSync(`${f}.tmp`, f);
  }

  get(id: string): Candidate {
    return JSON.parse(readFileSync(this.file(id), 'utf8'));
  }

  add(c: Candidate): Candidate {
    if (existsSync(this.file(c.id))) return this.get(c.id); // 幂等
    const now = this.clock();
    const row = { ...c, state: 'quarantined' as const, created_at: now, updated_at: now };
    this.write(row);
    this.ledger.append({ t: now, id: row.id, to: 'quarantined', target: row.target, kind: row.kind });
    return row;
  }

  list(state?: CandidateState): Candidate[] {
    const dir = join(this.root, 'candidates');
    return readdirSync(dir).filter((f) => f.endsWith('.json')).sort().map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')) as Candidate).filter((c) => !state || c.state === state);
  }

  transition(id: string, to: CandidateState, detail: Record<string, any> = {}): Candidate {
    const c = this.get(id);
    if (!TRANSITIONS[c.state].includes(to)) throw new IllegalTransition(`${c.state}->${to}`);
    const now = this.clock();
    c.history.push({ t: now, from: c.state, to, ...detail });
    c.state = to;
    c.updated_at = now;
    if ('snapshot' in detail) c.snapshot = detail.snapshot;
    this.write(c);
    const { snapshot: _s, ...rest } = detail;
    this.ledger.append({ t: now, id, to, ...rest });
    return c;
  }
}
