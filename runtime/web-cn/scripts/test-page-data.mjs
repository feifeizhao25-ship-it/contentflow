/**
 * 页面读数据的三处错位，以及两处编造的数据：
 *
 *  1. 内容库：apiClient 已把 { success, data } 信封解开，页面却还判断 result?.success —— 永远是
 *     undefined，列表永远不渲染；删除成功也判成失败（内容其实已删）。
 *  2. 发布日历：后端返回 { tasks, pagination }，页面读 res.data —— 永远是空；平台取 t.platform
 *     （后端在 platform_account.platform）；还把平台筛选当成 status 传给后端。
 *  3. 热点页：/ai/hot-topics 后端没有，失败后展示四条写死的「热点」（DeepSeek-V3 拆解 9.8 万热度……）；
 *     爆款拆解调的 /ai/analyze-viral 也不存在（真实路由 /ai/analyze/viral）。
 *  4. 设置页「套餐与用量」：下次账单日写死 2024 年 1 月 31 日，用量写死 2/5、450/1000、0.2/1GB。
 *   node --import ./scripts/ts-extensionless.mjs --experimental-strip-types scripts/test-page-data.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseContentList, mapPublishTasks, parseHotTopics, describePlan } from '../src/lib/page-data.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = (rel) => fs.readFileSync(path.join(ROOT, 'src', rel), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
let failures = 0;
async function check(name, fn) {
  try { await fn(); console.log(`  PASS ${name}`); } catch (e) { failures++; console.error(`  FAIL ${name}: ${e.message}`); }
}

console.log('Page data tests');

await check('内容库：解开信封后的 { contents, pagination } 直接得到行', () => {
  const rows = parseContentList({ contents: [{ id: 'c1', content_type: 'article', created_at: '2026-09-01T00:00:00Z', status: 'draft', title: 'T' }], pagination: { total: 1 } });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].key, 'c1');
  assert.equal(rows[0].type, 'article');
  assert.match(rows[0].created_at, /2026/);
});

await check('内容库：仍带信封的也认；空、异常形状得到空数组而不是抛错', () => {
  assert.equal(parseContentList({ success: true, data: { contents: [{ id: 'c1', created_at: '2026-09-01T00:00:00Z' }] } }).length, 1);
  assert.deepEqual(parseContentList(null), []);
  assert.deepEqual(parseContentList({}), []);
});

await check('发布日历：读 tasks，平台取 platform_account.platform，状态映射', () => {
  const rows = mapPublishTasks({
    tasks: [
      { id: 't1', status: 'queued', scheduled_at: '2026-10-01T10:30:00Z', content: { title: '标题' }, platform_account: { platform: 'douyin', account_name: '号' } },
      { id: 't2', status: 'published', scheduled_at: '2026-10-02T10:30:00Z', content: null, platform_account: { platform: 'xhs' } },
      { id: 't3', status: 'failed', scheduled_at: '2026-10-03T10:30:00Z', content: { title: 'F' }, platform_account: null },
      { id: 't4', status: 'cancelled', scheduled_at: '2026-10-04T10:30:00Z', content: { title: 'C' }, platform_account: { platform: 'xhs' } },
    ],
  });
  assert.equal(rows.length, 4);
  assert.deepEqual(rows[0].platforms, ['douyin']);
  assert.equal(rows[0].status, 'scheduled');
  assert.equal(rows[0].title, '标题');
  assert.equal(rows[1].title, '未命名内容');
  assert.equal(rows[1].status, 'published');
  assert.equal(rows[2].status, 'failed');
  assert.deepEqual(rows[2].platforms, []);
  assert.equal(rows[3].status, 'cancelled');
});

await check('热点：后端说「未接入」就展示原因，不补任何热点', () => {
  const r = parseHotTopics({ available: false, topics: [], message: '热点数据源尚未接入：需要接入合规授权的数据服务后才能提供真实热点' });
  assert.deepEqual(r.topics, []);
  assert.match(r.notice, /尚未接入/);
});

await check('热点：有数据时按后端给的展示（topic 字段作标题）', () => {
  const r = parseHotTopics({ available: true, topics: [{ id: '1', topic: '某话题', heat: 5000, platform: 'xhs' }] });
  assert.equal(r.topics[0].title, '某话题');
  assert.equal(r.notice, '');
});

await check('热点：异常形状得到空列表与中文说明，不抛错', () => {
  const r = parseHotTopics(undefined);
  assert.deepEqual(r.topics, []);
  assert.match(r.notice, /[一-鿿]/);
});

await check('热点页：没有写死的热点兜底，走 /hot/list 与 /ai/analyze/viral', () => {
  const page = src('app/(main)/hot/page.tsx');
  assert.doesNotMatch(page, /heat:\s*\d{4,}/);
  assert.doesNotMatch(page, /DeepSeek|春节旅游|极简年夜饭/);
  assert.match(page, /['"`]\/hot\/list/);
  assert.match(page, /'\/ai\/analyze\/viral'/);
  assert.doesNotMatch(page, /50\+ 社交媒体趋势/);
});

await check('套餐与用量：用真实的工作区限额与用量，日期来自套餐到期时间', () => {
  const plan = describePlan({
    plan: 'pro', plan_expires_at: '2026-12-31T00:00:00.000Z',
    limits: { max_accounts: 5, max_publishes_monthly: 300, max_storage_gb: 10 },
    usage_stats: { accounts_count: 2, publishes_this_month: 41, storage_used_mb: 512, ai_calls_this_month: 17 },
  }, { monthlyQuota: 2500000, usedQuota: 1234 });
  assert.equal(plan.name, '专业版');
  assert.match(plan.renewText, /2026年12月31日/);
  assert.deepEqual(plan.usage.map((u) => [u.title, u.current, u.limit]), [
    ['账号绑定', 2, 5], ['本月发布', 41, 300], ['存储空间', 0.5, 10], ['本月 AI 令牌', 1234, 2500000],
  ]);
  // 从未累加的 ai_calls_this_month 不再上屏
  assert.equal('aiCallsThisMonth' in plan, false);
});

await check('套餐与用量：免费版没有到期日，如实写「无账单」；缺数据时不编数字', () => {
  const plan = describePlan({ plan: 'free', plan_expires_at: null, limits: null, usage_stats: null });
  assert.equal(plan.name, '免费版');
  assert.match(plan.renewText, /无|不会/);
  assert.deepEqual(plan.usage, []);
});

await check('设置页：不再写死账单日期与用量，不再有点了没反应的按钮', () => {
  const page = src('app/(main)/settings/page.tsx');
  assert.doesNotMatch(page, /2024年1月31日/);
  assert.doesNotMatch(page, /current:\s*450|current:\s*0\.2/);
  assert.doesNotMatch(page, /更新团队信息/);
});

await check('内容库页面：不再对已解包的结果判断 .success', () => {
  const page = src('app/(main)/contents/page.tsx');
  assert.doesNotMatch(page, /result\?\.success/);
  assert.match(page, /parseContentList\(/);
});

await check('日历页：用 mapPublishTasks，不再把平台筛选当 status 传给后端', () => {
  const page = src('app/(main)/schedule/page.tsx');
  assert.match(page, /mapPublishTasks\(/);
  assert.doesNotMatch(page, /status=\$\{filterPlatform/);
});

if (failures) { console.error(`${failures} failed`); process.exit(1); }
console.log('All page data tests passed');
