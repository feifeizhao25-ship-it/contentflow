/**
 * 规则库「自动更新 + 为你推荐」的前端部分：
 *  1. 离线兜底：连不上服务器时，已废止的不出现、没有「核对于」之类的假核对标记。
 *  2. 页面结构：推荐区有理由/标记/更新说明/设置（关注、不再推荐、总开关）；首页卡片；全中文；不用 dangerouslySetInnerHTML。
 *  3. 前端调用的接口都能在后端控制器里找到。
 *   node --import ./scripts/ts-extensionless.mjs --experimental-strip-types scripts/test-library-live.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { OFFLINE_NOTE, BADGE_TEXT, needsWarning, offlineEntries, topicStateText } from '../src/lib/library-live.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lib = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/rule-library.json'), 'utf8'));
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
let failures = 0;
async function check(name, fn) {
  try { await fn(); console.log(`  PASS ${name}`); } catch (e) { failures++; console.error(`  FAIL ${name}: ${e.message}`); }
}

await check('离线兜底：只留已审核（预览开关才含待审核）；已废止的一律去掉；不带任何核对标记', () => {
  const base = lib.entries[0];
  const approved = { ...base, id: 'a', review_status: '已审核' };
  const repealed = { ...base, id: 'r', review_status: '已审核', status: '已废止' };
  const pending = { ...base, id: 'p', review_status: '待审核' };
  const out = offlineEntries([approved, repealed, pending], false);
  assert.deepEqual(out.map((e) => e.id), ['a']);
  assert.deepEqual(offlineEntries([approved, repealed, pending], true).map((e) => e.id), ['a', 'p']);
  assert.ok(out.every((e) => e.display === undefined));
  assert.match(OFFLINE_NOTE, /可能不是最新/);
});

await check('提示判断：服务端说不是现行的，就要挂提示', () => {
  const e = { ...lib.entries[0] };
  assert.equal(needsWarning(e), false);
  assert.equal(needsWarning({ ...e, display: { current: true } }), false);
  assert.equal(needsWarning({ ...e, display: { current: false } }), true);
});

await check('文案：标记和主题状态都是中文', () => {
  assert.equal(BADGE_TEXT.new, '上次来访后新增');
  assert.equal(BADGE_TEXT.updated, '上次来访后有更新');
  assert.equal(topicStateText({ id: 'ad', name: '广告标识', followed: true, muted: false }), '已关注');
  assert.equal(topicStateText({ id: 'ad', name: '广告标识', followed: false, muted: true }), '已设为不再推荐');
  assert.equal(topicStateText({ id: 'ad', name: '广告标识', followed: false, muted: false }), '默认');
});

const files = {
  forYou: 'src/components/library/ForYouSection.tsx',
  card: 'src/components/library/LibraryHomeCard.tsx',
  list: 'src/app/(main)/rules/page.tsx',
  detail: 'src/app/(main)/rules/[id]/page.tsx',
  live: 'src/lib/library-live.ts',
};

await check('页面：推荐区写明理由、标记、更新说明；设置里有关注/不再推荐/总开关；关闭后有说明和重新打开', () => {
  const s = read(files.forYou);
  for (const t of ['为什么推荐：', '更新说明：', '推荐设置', '个性化推荐', '关注', '取消关注', '不再推荐', '恢复推荐', '重新打开', '个性化推荐已关闭', '暂时没有合适的推荐', '暂时不可用']) assert.ok(s.includes(t), `缺少文案：${t}`);
  for (const id of ['foryou', 'foryou-card', 'foryou-reason', 'foryou-badge', 'foryou-change-note', 'foryou-switch', 'foryou-off', 'foryou-settings', 'foryou-unavailable']) assert.ok(s.includes(`"${id}"`) || s.includes(`\`${id}\``), `缺少 data-testid ${id}`);
  assert.match(s, /opened\(item\.id\)/); // 点开会记「读过」
  assert.match(s, /visibilitychange/); assert.match(s, /pagehide/); // 来访时间在离开页面时才记
});

await check('页面：列表和详情接入实时结论；首页卡片只在有内容时出现', () => {
  const l = read(files.list);
  assert.match(l, /ForYouSection/); assert.match(l, /rules-offline/); assert.match(l, /rule-banner/); assert.match(l, /rule-change-note/);
  assert.match(l, /!loaded/); // 没拿到结论前不先闪出条目
  const d = read(files.detail);
  assert.match(d, /rule-banner/); assert.match(d, /repeal_hold/); assert.match(d, /rule-offline/); assert.match(d, /rule-inactive-tag/); assert.match(d, /rule-inactive-body/); assert.match(d, /e\.status !== '已废止'/);
  const c = read(files.card);
  assert.match(c, /if \(!card\) return null/);
  assert.match(read('src/app/(main)/studio/page.tsx'), /<LibraryHomeCard \/>/);
});

await check('全中文、没有 dangerouslySetInnerHTML、没有英文界面文字', () => {
  for (const f of Object.values(files)) {
    const s = read(f);
    assert.ok(!/dangerouslySetInnerHTML/.test(s), `${f} 用了 dangerouslySetInnerHTML`);
  }
  for (const f of [files.forYou, files.card]) {
    // 单独成行的界面文字（不含代码符号）里不能有英文单词
    const lines = read(f).split('\n').map((l) => l.trim()).filter((l) => l && !/[<>{}();=:,`'"\/\[\]]/.test(l));
    for (const t of lines) assert.ok(!/[A-Za-z]{4,}/.test(t), `${f} 有英文界面文字：${t}`);
  }
});

await check('接口：前端调用的 /library/* 路径在后端控制器里都有', () => {
  const ctl = fs.readFileSync(path.resolve(ROOT, '..', 'api', 'src', 'modules', 'library', 'library.controller.ts'), 'utf8');
  const routes = new Set([...ctl.matchAll(/@(?:Get|Post|Put)\('([^']+)'\)/g)].map((m) => m[1]));
  const used = [...read(files.live).matchAll(/'\/library\/([a-z-]+)/g), ...read(files.live).matchAll(/`\/library\/([a-z-]+)/g)].map((m) => m[1]);
  assert.ok(used.length >= 6);
  for (const u of used) assert.ok([...routes].some((r) => r === u || r.startsWith(`${u}/`)), `后端没有 /library/${u}`);
});

if (failures) { console.error(`${failures} 项失败`); process.exit(1); }
console.log('library live tests passed');
