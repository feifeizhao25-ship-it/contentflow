/**
 * 命令行（审核人和运维用）：
 *   npx ts-node src/modules/library/cli.ts check|discover                       （需要 LIBRARY_FRESHNESS_ENABLED=1）
 *   npx ts-node src/modules/library/cli.ts approve  <id> --reviewer 姓名
 *   npx ts-node src/modules/library/cli.ts update   <id> --reviewer 姓名 --note "变更说明"
 *   npx ts-node src/modules/library/cli.ts confirm  <id> --reviewer 姓名
 *   npx ts-node src/modules/library/cli.ts repeal   <id> --reviewer 姓名 [--note 原因]
 *   npx ts-node src/modules/library/cli.ts promote  <id> --reviewer 姓名        把暂存区候选复制进工作文档（仍是“待审核”，用户看不到）
 *   npx ts-node src/modules/library/cli.ts gate     <id> --reviewer 姓名        “变好才上线”闸门：证据/安全/对照/不重复，只出报告
 *   npx ts-node src/modules/library/cli.ts releases - --reviewer 姓名           列出版本并校验哈希链
 *   npx ts-node src/modules/library/cli.ts rollback v3 --reviewer 姓名 --note 原因   回滚到第 3 版（追加回滚记录，不删历史）
 * 每次 promote/approve/update/repeal/rollback 都在 LIBRARY_DATA_DIR/releases/ 留一份完整快照（哈希链）；LIBRARY_PROMOTE_GATE=1 时 approve 必须先通过闸门（默认不强制）。
 * 审核结果写进 LIBRARY_DATA_DIR（reference_entries.json、library_state.json、library_review_log.jsonl）。
 */
import { LibraryJobService } from './library-job.service';
import { evaluate, gateEnforced } from './promote-gate';
import * as releases from './releases';
import * as review from './live/review';
import { dayStr, shanghaiToday } from './live/util';
import { LibraryStore, loadStagedRules, sources } from './store';
import { domainOk } from '../growth/self-improve/sources';

export async function main(argv: string[], store = new LibraryStore(), now = new Date(), env: NodeJS.ProcessEnv = process.env): Promise<number> {
  const [cmd, id, ...rest] = argv;
  const flag = (name: string): string => {
    const i = rest.indexOf(`--${name}`);
    return i >= 0 ? rest[i + 1] ?? '' : '';
  };
  if (cmd === 'check' || cmd === 'discover') {
    const job = new LibraryJobService(store);
    const r = cmd === 'check' ? await job.runCheck(now) : await job.runDiscover(now);
    if (r.status === 'disabled') {
      console.error('资料库自动更新没有打开（设置 LIBRARY_FRESHNESS_ENABLED=1）');
      return 3;
    }
    console.log(cmd === 'check' ? `已核对；需要人看的：${(r as any).attention.join(', ') || '无'}` : `新候选 ${(r as any).candidates} 条`);
    return 0;
  }
  if (!['approve', 'update', 'confirm', 'repeal', 'promote', 'gate', 'releases', 'rollback'].includes(cmd ?? '') || !id) {
    console.error('用法：check | discover | approve|update|confirm|repeal|promote|gate|releases|rollback <id> --reviewer 姓名 [--note ...]');
    return 2;
  }
  const domOk = (h: string) => domainOk(h, { allowedDomains: sources().allowed_domains });
  const doc = store.loadDoc();
  if (cmd === 'releases') {
    const v = releases.verify(store.dir);
    for (const r of releases.listReleases(store.dir)) console.log(`v${r.version} ${r.at} ${r.action} ${r.entry_id} by ${r.reviewer} ${r.note}`);
    console.log(`chain ${v.ok ? 'ok' : `BROKEN: ${v.problems.join('; ')}`}`);
    return v.ok ? 0 : 3;
  }
  if (cmd === 'gate') {
    const cand = loadStagedRules(store.dir).find((e) => e.id === id) ?? doc.entries.find((e) => e.id === id);
    if (!cand) {
      console.error('失败：unknown entry');
      return 2;
    }
    const r = evaluate(cand, doc.entries.filter((e) => e.id !== id), { today: now, domainOk: domOk });
    console.log(JSON.stringify(r, null, 1));
    return r.decision === 'keep' ? 0 : 4;
  }
  if (cmd === 'rollback') {
    try {
      if (!flag('reviewer').trim()) throw new review.ReviewError('reviewer name is required');
      const back = releases.rollback(store.dir, Number(id.replace(/^v/i, '')), flag('reviewer'), flag('note'));
      store.saveDoc(back);
      store.log({ at: now.toISOString(), action: 'rollback', to: id, reviewer: flag('reviewer'), note: flag('note') });
      console.log(`rollback to ${id} by ${flag('reviewer')}`);
      return 0;
    } catch (e) {
      console.error(`失败：${(e as Error).message}`);
      return 2;
    }
  }
  if (!releases.listReleases(store.dir).length && flag('reviewer').trim()) releases.record(store.dir, doc, { action: 'baseline', entry_id: '-', reviewer: flag('reviewer'), note: '第一次审核动作前的工作文档' });
  let gateResult: ReturnType<typeof evaluate> | undefined;
  const ctx: review.ReviewCtx = { doc, state: store.loadState(), snapshots: store.snapshots(), log: store.log, now: () => now };
  const today = dayStr(shanghaiToday(now));
  try {
    if (cmd === 'promote') {
      const cand = loadStagedRules(store.dir).find((e) => e.id === id);
      if (!cand) throw new review.ReviewError('not in staged area');
      if (doc.entries.some((e) => e.id === id)) throw new review.ReviewError('already in document');
      if (!flag('reviewer').trim()) throw new review.ReviewError('reviewer name is required');
      doc.entries.push({ ...cand, review_status: '待审核' });
      store.log({ at: now.toISOString(), action: 'promote', id, reviewer: flag('reviewer') });
    } else if (cmd === 'approve') {
      if (gateEnforced(env)) {
        const cand = doc.entries.find((e) => e.id === id);
        if (cand) {
          gateResult = evaluate(cand, doc.entries.filter((e) => e.id !== id), { today: now, domainOk: domOk });
          if (gateResult.decision !== 'keep') throw new review.ReviewError(`gate rejected: ${gateResult.reasons.join('; ')}`);
        }
      }
      review.approve(ctx, id, flag('reviewer'), today);
    }
    else if (cmd === 'update') review.update(ctx, id, flag('reviewer'), today, flag('note'));
    else if (cmd === 'confirm') review.confirmUnchanged(ctx, id, flag('reviewer'), today);
    else review.repeal(ctx, id, flag('reviewer'), today, flag('note'));
  } catch (e) {
    console.error(`失败：${(e as Error).message}`);
    return 2;
  }
  store.saveDoc(doc);
  store.saveState(ctx.state);
  releases.record(store.dir, doc, { action: cmd as string, entry_id: id, reviewer: flag('reviewer'), note: flag('note'), gate: gateResult });
  console.log(`${cmd} ${id} 完成`);
  return 0;
}

if (require.main === module) {
  main(process.argv.slice(2)).then((c) => process.exit(c));
}
