import { createHash } from 'crypto';

/**
 * 平台规则变更监控：条款级差异 + 「只提议」。
 *
 * 流程（沿用 knowledge-improvement/weekly.ts 的原则）：
 *   新抓取的规则文本 → diffRuleSnapshots（条款级）→ buildChangeProposal（状态固定为 pending_review）
 *   → 人工在企业微信里批准 → decideAdoption 看到批准记录才返回 adopt。
 * 本模块只做纯计算：不联网、不读写文件、不发消息，也不把任何内容写进规则库。
 * 没有批准记录、批准人为空、或批准人是自动化账号时，一律不采纳。
 */

export interface RuleClause {
  /** 条款标识：优先用「第X条」「X.Y」之类的编号，没有编号时用正文哈希前 12 位。 */
  id: string;
  text: string;
  hash: string;
}

export interface RuleSnapshot {
  source_id: string;
  source_url: string;
  fetched_at: string;
  /** 全文哈希；任何一个字符变化都会变。 */
  content_hash: string;
  clauses: RuleClause[];
}

export interface ClauseChange {
  id: string;
  before: string;
  after: string;
}

export interface RuleDiff {
  source_id: string;
  changed: boolean;
  added: RuleClause[];
  removed: RuleClause[];
  modified: ClauseChange[];
  unchangedCount: number;
}

export type ProposalStatus = 'pending_review';

export interface ChangeProposal {
  source_id: string;
  source_url: string;
  status: ProposalStatus;
  /** 采纳前依赖这条规则的合规结论要暂停（README：正文哈希变化时标为 needs_review）。 */
  pause_dependents: boolean;
  from_hash: string;
  to_hash: string;
  summary: string;
  diff: RuleDiff;
}

export interface Approval {
  status: 'approved' | 'rejected';
  reviewer: string;
  approved_at: string;
  /** 批准的是哪一版：必须等于提议里的 to_hash，防止批准旧版后被换成新版。 */
  to_hash: string;
  channel: 'wecom';
}

export type Adoption = { decision: 'adopt'; to_hash: string } | { decision: 'hold'; reason: string };

const sha256 = (text: string): string => createHash('sha256').update(text, 'utf8').digest('hex');
const normalize = (text: string): string => text.replace(/\r\n?/g, '\n').replace(/[ \t\u3000]+/g, ' ').trim();

/** 条款编号：第十二条 / 第12条 / 1.2 / 1.2.3 / (3) / 3、 等，行首出现才算。 */
const CLAUSE_HEAD = /^(第[零〇一二三四五六七八九十百千0-9]+[条章节款]|\d+(?:\.\d+)+|[（(]\d+[)）]|\d+[、.．])/;

export function splitClauses(raw: string): RuleClause[] {
  const lines = normalize(raw).split('\n').map((line) => line.trim()).filter(Boolean);
  const clauses: { head: string | null; parts: string[] }[] = [];
  for (const line of lines) {
    const match = line.match(CLAUSE_HEAD);
    if (match) clauses.push({ head: match[1], parts: [line] });
    else if (clauses.length) clauses[clauses.length - 1].parts.push(line);
    else clauses.push({ head: null, parts: [line] });
  }
  const seen = new Map<string, number>();
  return clauses.map((clause) => {
    const text = clause.parts.join('\n');
    const hash = sha256(text);
    const base = clause.head ?? `h-${hash.slice(0, 12)}`;
    const count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);
    return { id: count === 1 ? base : `${base}#${count}`, text, hash };
  });
}

export function snapshotFromText(meta: { source_id: string; source_url: string; fetched_at: string }, rawText: string): RuleSnapshot {
  return { ...meta, content_hash: sha256(normalize(rawText)), clauses: splitClauses(rawText) };
}

export function diffRuleSnapshots(previous: RuleSnapshot | null, next: RuleSnapshot): RuleDiff {
  const before = new Map((previous?.clauses ?? []).map((clause) => [clause.id, clause]));
  const after = new Map(next.clauses.map((clause) => [clause.id, clause]));
  const added: RuleClause[] = [];
  const removed: RuleClause[] = [];
  const modified: ClauseChange[] = [];
  let unchangedCount = 0;
  for (const [id, clause] of after) {
    const old = before.get(id);
    if (!old) added.push(clause);
    else if (old.hash !== clause.hash) modified.push({ id, before: old.text, after: clause.text });
    else unchangedCount += 1;
  }
  for (const [id, clause] of before) if (!after.has(id)) removed.push(clause);
  return {
    source_id: next.source_id,
    changed: added.length + removed.length + modified.length > 0,
    added,
    removed,
    modified,
    unchangedCount,
  };
}

/** 没有变化返回 null（不打扰审批人）；有变化只生成 pending_review 的提议。 */
export function buildChangeProposal(previous: RuleSnapshot | null, next: RuleSnapshot): ChangeProposal | null {
  if (previous && previous.content_hash === next.content_hash) return null;
  const diff = diffRuleSnapshots(previous, next);
  if (previous && !diff.changed) return null;
  return {
    source_id: next.source_id,
    source_url: next.source_url,
    status: 'pending_review',
    pause_dependents: previous !== null,
    from_hash: previous?.content_hash ?? '',
    to_hash: next.content_hash,
    summary: `新增 ${diff.added.length} 条，删除 ${diff.removed.length} 条，修改 ${diff.modified.length} 条`,
    diff,
  };
}

const AUTOMATION_REVIEWER = /^(bot|system|auto|cron|ci|github-actions|openclaw)\b/i;

/** 只有来自企业微信、批准人是真人标识、且批准的正是这一版哈希时才采纳。 */
export function decideAdoption(proposal: ChangeProposal, approval: Approval | null | undefined): Adoption {
  if (!approval) return { decision: 'hold', reason: '没有批准记录' };
  if (approval.status !== 'approved') return { decision: 'hold', reason: '审批未通过' };
  if (approval.channel !== 'wecom') return { decision: 'hold', reason: '审批不是来自企业微信' };
  if (!approval.reviewer.trim() || AUTOMATION_REVIEWER.test(approval.reviewer.trim())) return { decision: 'hold', reason: '批准人为空或是自动化账号' };
  if (!approval.approved_at.trim() || Number.isNaN(Date.parse(approval.approved_at))) return { decision: 'hold', reason: '批准时间无效' };
  if (approval.to_hash !== proposal.to_hash) return { decision: 'hold', reason: '批准的版本与当前提议不一致' };
  return { decision: 'adopt', to_hash: proposal.to_hash };
}
