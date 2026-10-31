/**
 * 命令行（审核人和运维用）：
 *   npx ts-node src/modules/library/cli.ts check|discover                       （需要 LIBRARY_FRESHNESS_ENABLED=1）
 *   npx ts-node src/modules/library/cli.ts approve  <id> --reviewer 姓名
 *   npx ts-node src/modules/library/cli.ts update   <id> --reviewer 姓名 --note "变更说明"
 *   npx ts-node src/modules/library/cli.ts confirm  <id> --reviewer 姓名
 *   npx ts-node src/modules/library/cli.ts repeal   <id> --reviewer 姓名 [--note 原因]
 * 审核结果写进 LIBRARY_DATA_DIR（reference_entries.json、library_state.json、library_review_log.jsonl）。
 */
import { LibraryJobService } from './library-job.service';
import * as review from './live/review';
import { dayStr, shanghaiToday } from './live/util';
import { LibraryStore } from './store';

export async function main(argv: string[], store = new LibraryStore(), now = new Date()): Promise<number> {
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
  if (!['approve', 'update', 'confirm', 'repeal'].includes(cmd ?? '') || !id) {
    console.error('用法：check | discover | approve|update|confirm|repeal <id> --reviewer 姓名 [--note ...]');
    return 2;
  }
  const doc = store.loadDoc();
  const ctx: review.ReviewCtx = { doc, state: store.loadState(), snapshots: store.snapshots(), log: store.log, now: () => now };
  const today = dayStr(shanghaiToday(now));
  try {
    if (cmd === 'approve') review.approve(ctx, id, flag('reviewer'), today);
    else if (cmd === 'update') review.update(ctx, id, flag('reviewer'), today, flag('note'));
    else if (cmd === 'confirm') review.confirmUnchanged(ctx, id, flag('reviewer'), today);
    else review.repeal(ctx, id, flag('reviewer'), today, flag('note'));
  } catch (e) {
    console.error(`失败：${(e as Error).message}`);
    return 2;
  }
  store.saveDoc(doc);
  store.saveState(ctx.state);
  console.log(`${cmd} ${id} 完成`);
  return 0;
}

if (require.main === module) {
  main(process.argv.slice(2)).then((c) => process.exit(c));
}
