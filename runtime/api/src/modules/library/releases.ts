/**
 * 规则库版本发布与回滚：每次人工审核动作（promote/approve/update/repeal/rollback）留一份完整快照，哈希串成链。
 *   releases/NNNN.json   {version, at, action, entry_id, reviewer, note, doc_sha256, prev_sha256, gate?, document}
 *   releases/index.jsonl 每行一条（不含 document），任何一行被改都能 verify 出来。
 * 回滚 = 把工作文档恢复成旧版本内容，并追加一条 rollback 发布（不删历史）；回滚同样要求审核人姓名和原因。
 */
import { createHash } from 'crypto';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

export class ReleaseError extends Error {}
export interface ReleaseRec {
  version: number;
  at: string;
  action: string;
  entry_id: string;
  reviewer: string;
  note: string;
  doc_sha256: string;
  prev_sha256: string;
  gate?: Record<string, unknown>;
  sha256: string;
}

const canon = (o: unknown): string => JSON.stringify(sortKeys(o));
const sortKeys = (o: unknown): unknown => (Array.isArray(o) ? o.map(sortKeys) : o && typeof o === 'object' ? Object.fromEntries(Object.keys(o as object).sort().map((k) => [k, sortKeys((o as Record<string, unknown>)[k])])) : o);
const sha = (o: unknown): string => createHash('sha256').update(canon(o)).digest('hex');
const dir = (base: string): string => {
  const d = join(base, 'releases');
  mkdirSync(d, { recursive: true });
  return d;
};

export function listReleases(base: string): ReleaseRec[] {
  const p = join(dir(base), 'index.jsonl');
  return existsSync(p) ? readFileSync(p, 'utf8').split('\n').filter((x) => x.trim()).map((x) => JSON.parse(x)) : [];
}

export function record(base: string, doc: unknown, a: { action: string; entry_id: string; reviewer: string; note?: string; gate?: { decision?: string; evidence?: number; safety?: number } }): ReleaseRec {
  if (!(a.reviewer ?? '').trim()) throw new ReleaseError('reviewer name is required');
  const idx = listReleases(base);
  const version = idx.length ? idx[idx.length - 1].version + 1 : 1;
  const rec: Omit<ReleaseRec, 'sha256'> = { version, at: new Date().toISOString(), action: a.action, entry_id: a.entry_id, reviewer: a.reviewer.trim(), note: a.note ?? '', doc_sha256: sha(doc), prev_sha256: idx.length ? idx[idx.length - 1].sha256 : '0'.repeat(64) };
  if (a.gate) (rec as ReleaseRec).gate = { decision: a.gate.decision, evidence: a.gate.evidence, safety: a.gate.safety };
  const full: ReleaseRec = { ...(rec as ReleaseRec), sha256: sha(rec) };
  const d = dir(base);
  writeFileSync(join(d, `${String(version).padStart(4, '0')}.json`), JSON.stringify({ ...full, document: doc }, null, 1), 'utf8');
  appendFileSync(join(d, 'index.jsonl'), `${JSON.stringify(full)}\n`, 'utf8');
  return full;
}

export function verify(base: string): { ok: boolean; problems: string[] } {
  const problems: string[] = [];
  let prev = '0'.repeat(64);
  for (const r of listReleases(base)) {
    const { sha256, ...body } = r;
    if (sha(body) !== sha256) problems.push(`v${r.version}: 记录被改动`);
    if (r.prev_sha256 !== prev) problems.push(`v${r.version}: 链断开`);
    prev = sha256;
    const f = join(dir(base), `${String(r.version).padStart(4, '0')}.json`);
    if (!existsSync(f)) problems.push(`v${r.version}: 快照缺失`);
    else if (sha(JSON.parse(readFileSync(f, 'utf8')).document) !== r.doc_sha256) problems.push(`v${r.version}: 快照内容与记录不一致`);
  }
  return { ok: problems.length === 0, problems };
}

export function loadDocument(base: string, version: number): { entries: unknown[]; [k: string]: unknown } {
  const f = join(dir(base), `${String(version).padStart(4, '0')}.json`);
  if (!existsSync(f)) throw new ReleaseError(`no such release: ${version}`);
  return JSON.parse(readFileSync(f, 'utf8')).document;
}

export function rollback(base: string, toVersion: number, reviewer: string, note: string) {
  if (!(note ?? '').trim()) throw new ReleaseError('note is required for rollback');
  const v = verify(base);
  if (!v.ok) throw new ReleaseError(`release chain broken: ${v.problems.join('; ')}`);
  const doc = loadDocument(base, toVersion);
  record(base, doc, { action: 'rollback', entry_id: `v${toVersion}`, reviewer, note });
  return doc;
}
