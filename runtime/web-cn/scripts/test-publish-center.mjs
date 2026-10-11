/**
 * 发布中心的筛选、批量重试、导出日志：原来按钮都没有绑定事件，点了没反应。
 * 这里测筛选条件 → 查询串、批量重试结果摘要、导出文件名解析，以及「页面上不再有无效按钮」。
 *   node --import ./scripts/ts-extensionless.mjs --experimental-strip-types scripts/test-publish-center.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  EMPTY_PUBLISH_FILTER, publishFilterQuery, displayFailureReason, summarizeRetry, fileNameFromDisposition, isFilterActive, downloadPublishLog,
  PUBLISH_FILTER_STATUSES, PUBLISH_FILTER_PLATFORMS,
} from '../src/lib/publish-filter.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const API = path.resolve(ROOT, '../api/src');
const read = (rel) => fs.readFileSync(path.join(ROOT, 'src', rel), 'utf8');
let failures = 0;
async function check(name, fn) {
  try { await fn(); console.log(`  PASS ${name}`); } catch (e) { failures++; console.error(`  FAIL ${name}: ${e.message}`); }
}

console.log('Publish center tests');

await check('筛选条件 → 查询串：空条件不带参数；关键词去空格；多平台逗号分隔；日期含首尾', () => {
  assert.equal(publishFilterQuery(EMPTY_PUBLISH_FILTER), '');
  assert.equal(isFilterActive(EMPTY_PUBLISH_FILTER), false);
  const q = new URLSearchParams(publishFilterQuery({ keyword: '  寒露 ', platforms: ['xhs', 'douyin'], status: 'failed', from: '2026-10-05', to: '2026-10-11' }, { page: 2, pageSize: 20 }));
  assert.equal(q.get('keyword'), '寒露');
  assert.equal(q.get('platform'), 'xhs,douyin');
  assert.equal(q.get('status'), 'failed');
  assert.equal(q.get('from'), '2026-10-05');
  assert.equal(q.get('to'), '2026-10-11');
  assert.equal(q.get('page'), '2');
  // 导出不带分页
  assert.equal(new URLSearchParams(publishFilterQuery({ ...EMPTY_PUBLISH_FILTER, status: 'success' })).get('page'), null);
});

await check('前端的状态 / 平台选项都是后端认识的（否则后端 400）', () => {
  const backend = fs.readFileSync(path.join(API, 'modules/publish/publish-log.ts'), 'utf8');
  for (const s of PUBLISH_FILTER_STATUSES.map((o) => o.value).filter((v) => v !== 'all')) {
    assert.match(backend, new RegExp(`\\b${s}: \\[`), `后端没有状态分组 ${s}`);
  }
  for (const p of PUBLISH_FILTER_PLATFORMS.map((o) => o.value)) {
    assert.match(backend, new RegExp(`\\b${p}: '`), `后端没有平台 ${p}`);
  }
});

await check('批量重试结果：按原因归类，英文原因不上屏', () => {
  const s = summarizeRetry({ results: [
    { id: 'a', ok: true },
    { id: 'b', ok: false, reason: '抖音自动发布还没有开通（开放平台接入未完成），不能重试。' },
    { id: 'c', ok: false, reason: '抖音自动发布还没有开通（开放平台接入未完成），不能重试。' },
    { id: 'd', ok: false, reason: 'Internal error' },
  ] });
  assert.equal(s.retried, 1);
  assert.equal(s.text, '已重新排队 1 条，3 条没能重试');
  assert.deepEqual(s.failed, [
    { reason: '抖音自动发布还没有开通（开放平台接入未完成），不能重试。', count: 2 },
    { reason: '暂时无法重试', count: 1 },
  ]);
  assert.equal(summarizeRetry({ results: [{ ok: true }, { ok: true }] }).text, '已重新排队 2 条任务');
  assert.equal(summarizeRetry({ results: [{ ok: false, reason: '任务不存在' }] }).text, '1 条任务都没能重试');
});

await check('失败原因：旧记录里的英文平台代码换成中文；没有中文原因时给兜底；任务卡直接显示原因', () => {
  assert.equal(displayFailureReason('平台 douyin 尚未完成真实开放平台接入，不能重试'), '抖音尚未完成真实开放平台接入，不能重试');
  assert.equal(displayFailureReason('平台 xhs 尚无发布适配器'), '小红书尚无发布适配器');
  assert.equal(displayFailureReason('Request failed with status 500'), '平台没有返回可识别的原因');
  assert.equal(displayFailureReason(null), '平台没有返回可识别的原因');
  const list = read('components/publish/PublishTaskList.tsx');
  assert.match(list, /isFailed && \([\s\S]{0,120}失败原因：\{displayFailureReason\(task\.error\)\}/);
});

await check('导出文件名：优先 filename*=UTF-8 的中文名', () => {
  assert.equal(fileNameFromDisposition(`attachment; filename="publish-log-20261007.csv"; filename*=UTF-8''${encodeURIComponent('发布记录-20261007.csv')}`, 'x'), '发布记录-20261007.csv');
  assert.equal(fileNameFromDisposition('attachment; filename="a.csv"', 'x'), 'a.csv');
  assert.equal(fileNameFromDisposition(null, '发布记录.csv'), '发布记录.csv');
});

await check('导出失败时给后端的中文原因，网络失败给中文兜底，不把英文原文抛给界面', async () => {
  const realFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response(JSON.stringify({ success: false, error: { message: '不认识的平台筛选' } }), { status: 400, headers: { 'content-type': 'application/json' } });
    await assert.rejects(downloadPublishLog({ ...EMPTY_PUBLISH_FILTER, platforms: ['x'] }), /不认识的平台筛选/);
    globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); };
    await assert.rejects(downloadPublishLog(EMPTY_PUBLISH_FILTER), /网络连接失败/);
    let url = '';
    globalThis.fetch = async (u) => { url = String(u); return new Response('{}', { status: 500 }); };
    await assert.rejects(downloadPublishLog({ ...EMPTY_PUBLISH_FILTER, status: 'failed' }), /导出失败/);
    assert.equal(url, '/api/v1/publish/tasks/export?status=failed');
  } finally {
    globalThis.fetch = realFetch;
  }
});

await check('页面：筛选栏每个控件都绑定了事件，「批量重试」「导出日志」有处理函数；列表按筛选重新查询', () => {
  const bar = read('components/publish/TaskFilterBar.tsx');
  assert.match(bar, /onSearch=/);
  assert.equal((bar.match(/onChange=\{/g) || []).length >= 4, true, '搜索、平台、状态、日期都要有 onChange');
  assert.match(bar, /onClick=\{onBatchRetry\}[\s\S]*批量重试/);
  assert.match(bar, /onClick=\{onExport\}>导出日志/);
  // 任何按钮都必须有 onClick（或是 Tooltip 包裹的 disabled 状态说明）
  for (const m of bar.matchAll(/<Button\b[\s\S]*?<\/Button>/g)) assert.match(m[0], /onClick=/, `无效按钮：${m[0]}`);
  const page = read('app/(main)/publish/page.tsx');
  assert.match(page, /'\/publish\/tasks\/retry'/);
  assert.match(page, /downloadPublishLog\(filter\)/);
  const list = read('components/publish/PublishTaskList.tsx');
  assert.match(list, /publishFilterQuery\(filter, \{ page, pageSize: PAGE_SIZE \}\)/);
  assert.match(list, /<Pagination/);
});

await check('后端：导出、批量重试路由存在，导出只按本工作区（tenant_id 由服务端给定）', () => {
  const ctrl = fs.readFileSync(path.join(API, 'modules/publish/publish.controller.ts'), 'utf8');
  assert.match(ctrl, /@Get\('tasks\/export'\)/);
  assert.match(ctrl, /@Post\('tasks\/retry'\)/);
  assert.match(ctrl, /exportTasksCsv\(req\.user\.tenantId/);
  const log = fs.readFileSync(path.join(API, 'modules/publish/publish-log.ts'), 'utf8');
  assert.match(log, /'任务编号',\s*'内容标题',\s*'平台'/);
});

if (failures) { console.error(`${failures} failed`); process.exit(1); }
console.log('All publish center tests passed');
