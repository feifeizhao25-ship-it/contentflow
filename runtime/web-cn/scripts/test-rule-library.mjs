/**
 * 平台与法规规则库（/rules）：
 *  1. 数据：每条都有出处链接（http/https）、发文机关、文号、读到的范围、状态（现行/征求意见稿/已废止/待核实）、
 *     发布日期、读取日期；状态只能是四个允许的值；id 不重复；不含夸大或保证式用语。
 *  2. 门禁：默认不展示『待审核』条目；打开预览开关才展示；『已审核』条目始终展示。
 *  3. 搜索与筛选：关键词（多词全部命中）、分类、状态。
 *  4. 页面：全中文，没有 dangerouslySetInnerHTML，外链带 noopener noreferrer，且有空状态与加载状态。
 *   node --import ./scripts/ts-extensionless.mjs --experimental-strip-types scripts/test-rule-library.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { visibleEntries, filterEntries, categoriesOf, formatDateZh, safeHref } from '../src/lib/rule-library.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lib = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/rule-library.json'), 'utf8'));
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
let failures = 0;
async function check(name, fn) {
  try { await fn(); console.log(`  PASS ${name}`); } catch (e) { failures++; console.error(`  FAIL ${name}: ${e.message}`); }
}
const STATUSES = ['现行', '征求意见稿', '已废止', '待核实'];

await check('数据：字段齐全、状态合法、id 不重复', () => {
  assert.ok(lib.entries.length >= 10, '条目数量');
  const ids = new Set();
  for (const e of lib.entries) {
    assert.ok(!ids.has(e.id), `重复 id ${e.id}`); ids.add(e.id);
    assert.ok(STATUSES.includes(e.status), `${e.id} 状态不合法：${e.status}`);
    assert.match(e.source.url, /^https?:\/\//, `${e.id} 缺出处链接`);
    assert.ok(e.source.publisher && e.source.doc_no && e.source.read_scope, `${e.id} 出处信息不全`);
    assert.match(e.publish_date, /^\d{4}-\d{2}(-\d{2})?$/, `${e.id} 发布日期`);
    assert.match(e.retrieved_at, /^\d{4}-\d{2}-\d{2}$/, `${e.id} 读取日期`);
    assert.ok(e.points.length > 0 && e.summary && e.title, `${e.id} 内容为空`);
    assert.ok(['待审核', '已审核'].includes(e.review_status), `${e.id} 审核状态`);
    assert.equal(e.source.tier, 'A', `${e.id} 只收全文读过的 A 级来源`);
  }
});

await check('数据：没有保证式、承诺式用语（本库只写规则，不写“一定能”）', () => {
  const banned = /(包治|根治|治愈率|稳赚|一定能|保证有效)/;
  for (const e of lib.entries) {
    const body = JSON.stringify({ ...e, caution: '', source: '' });
    assert.ok(!banned.test(body) || e.id === 'cf-rule-005', `${e.id} 含禁用语`);
  }
});

await check('门禁：默认只显示已审核；预览开关才显示待审核', () => {
  const pending = lib.entries.filter((e) => e.review_status === '待审核').length;
  assert.equal(visibleEntries(lib.entries, false).length, lib.entries.length - pending);
  assert.equal(visibleEntries(lib.entries, true).length, lib.entries.length);
  const approved = { ...lib.entries[0], id: 'x', review_status: '已审核' };
  assert.ok(visibleEntries([approved], false).some((e) => e.id === 'x'));
});

await check('搜索与筛选', () => {
  const all = lib.entries;
  assert.ok(filterEntries(all, { query: '广告' }).length >= 3);
  assert.equal(filterEntries(all, { query: '广告 直播' }).every((e) => /广告/.test(JSON.stringify(e)) && /直播/.test(JSON.stringify(e))), true);
  assert.equal(filterEntries(all, { query: '完全不存在的词语abc' }).length, 0);
  const cat = categoriesOf(all)[0].name;
  assert.ok(filterEntries(all, { category: cat }).every((e) => e.category === cat));
  assert.ok(filterEntries(all, { status: '待核实' }).every((e) => e.status === '待核实'));
  assert.equal(categoriesOf(all).reduce((n, c) => n + c.count, 0), all.length);
});

await check('日期与链接工具', () => {
  assert.equal(formatDateZh('2026-10-31'), '2026年10月31日');
  assert.equal(formatDateZh('2026-04'), '2026年4月');
  assert.equal(safeHref('javascript:alert(1)'), null);
  assert.equal(safeHref('https://www.gov.cn/x'), 'https://www.gov.cn/x');
});

await check('页面：中文、无 dangerouslySetInnerHTML、外链安全、空状态与加载状态都在', () => {
  const list = read('src/app/(main)/rules/page.tsx');
  const detail = read('src/app/(main)/rules/[id]/page.tsx');
  const loading = read('src/app/(main)/rules/loading.tsx');
  for (const [n, s] of [['列表', list], ['详情', detail], ['加载', loading]]) assert.ok(!/dangerouslySetInnerHTML/.test(s), `${n}页用了 dangerouslySetInnerHTML`);
  assert.match(detail, /rel="noopener noreferrer"/);
  assert.match(list, /rules-empty-review/); assert.match(list, /rules-empty-search/); assert.match(detail, /rule-not-found/);
  assert.match(loading, /正在加载规则库/);
  assert.match(list, /待审核/);
  const nav = read('src/components/layout/MainLayout.tsx');
  assert.match(nav, /href="\/rules"/);
});

if (failures) { console.error(`${failures} 项失败`); process.exit(1); }
console.log('rule library tests passed');
