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
import { parseContentList, mapPublishTasks, parseHotTopics, describePlan, parseAnalyticsOverview, describeAiAllowance, generatedCoverUrl, flattenViralAnalysis, planBadge, contentCoverUrl, parseAccountList } from '../src/lib/page-data.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = (rel) => fs.readFileSync(path.join(ROOT, 'src', rel), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
let failures = 0;
async function check(name, fn) {
  try { await fn(); console.log(`  PASS ${name}`); } catch (e) { failures++; console.error(`  FAIL ${name}: ${e.message}`); }
}

console.log('Page data tests');
await check('封面：空响应、空白地址及非图片网络地址协议不能报成功', () => {
  for (const response of [null, {}, {url:''}, {url:'  '}, {url:123}, {url:'javascript:alert(1)'}, {data:{url:null}}]) {
    assert.throws(() => generatedCoverUrl(response), /未收到有效的封面图片/);
  }
  assert.equal(generatedCoverUrl({ url: ' https://example.cn/a.png ' }), 'https://example.cn/a.png');
  assert.equal(generatedCoverUrl({ success:true, data:{ url:'https://example.cn/a.png' } }), 'https://example.cn/a.png');
});


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
  const stamped = parseHotTopics({ available: true, source: '示例数据服务', fetchedAt: '2026-10-23T01:02:03.000Z', topics: [{ id: '1', topic: '某话题', heat: 1, platform: 'douyin' }] });
  assert.equal(stamped.topics[0].fetchedAt, '2026-10-23T01:02:03.000Z');
  assert.equal(stamped.topics[0].source, '示例数据服务');
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
  assert.equal(plan.name, 'Solo');
  assert.match(plan.renewText, /2026年12月31日/);
  assert.deepEqual(plan.usage.map((u) => [u.title, u.current, u.limit]), [
    ['账号绑定', 2, 5], ['本月发布', 41, 300], ['存储空间', 0.5, 10], ['本月 AI 令牌', 1234, 2500000],
  ]);
  // 从未累加的 ai_calls_this_month 不再上屏
  assert.equal('aiCallsThisMonth' in plan, false);
});

await check('Business 未确认额度：页面不展示令牌或平台账号数字', () => {
  const plan = describePlan({
    plan: 'enterprise',
    plan_expires_at: '2026-12-31T00:00:00.000Z',
    limits: { max_accounts: 100, max_publishes_monthly: 5000, max_storage_gb: 50 },
    usage_stats: { accounts_count: 2, publishes_this_month: 3, storage_used_mb: 100 },
  }, { quotaStatus: 'unconfirmed', monthlyQuota: 40000000, usedQuota: 10 });
  assert.equal(plan.name, 'Business');
  assert.match(plan.renewText, /待确认/);
  assert.equal(plan.usage.some((u) => u.title === '本月 AI 令牌' || u.title === '账号绑定'), false);
  assert.doesNotMatch(JSON.stringify(plan), /40000000|100/);
  const allowance = describeAiAllowance({ aiTokens: { quotaStatus: 'unconfirmed', limit: 40000000, used: 10, remaining: 39999990 } });
  assert.match(allowance.summary, /待确认/);
  assert.equal(allowance.exhausted, false);
  assert.doesNotMatch(allowance.summary, /4000|40000000/);
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

await check('数据分析：只解析自有数据；互动数据不可用时只给「接通平台授权后显示」', () => {
  const o = parseAnalyticsOverview({
    week: { start: '2026-10-04T16:00:00.000Z', publish: { total: 4, published: 1, failed: 1, inProgress: 0, manualPending: 1, manualDone: 1, cancelled: 0 }, ai: { generations: 5, byType: [{ type: 'titles', label: '标题', count: 5 }], savedAsContent: 2, approvedOrPublished: 1 } },
    month: { start: '2026-09-30T16:00:00.000Z', publish: { total: 9 }, ai: { generations: 7, byType: [{ type: 'x', label: 'Other', count: 1 }] } },
    failureReasons: [{ reason: '抖音开放平台尚未接入', count: 2 }, { reason: 'ECONNREFUSED', count: 1 }],
    engagement: { available: false, message: '接通平台授权后显示', detail: '说明' },
  });
  assert.equal(o.week.publish.manualDone, 1);
  assert.equal(o.month.publish.failed, 0);
  assert.equal(o.month.ai.byType[0].label, '其他', '英文类型名不上屏');
  assert.deepEqual(o.failureReasons, [{ reason: '抖音开放平台尚未接入', count: 2 }], '英文失败原因不上屏');
  assert.equal(o.engagement.available, false);
  assert.equal(o.engagement.message, '接通平台授权后显示');
  assert.equal(parseAnalyticsOverview(null), null);
  assert.equal(parseAnalyticsOverview({ engagement: { available: true, message: 'x' } }), null);
});

await check('数据分析页：读 /analytics/overview，不再引用写死的三个组件', () => {
  const page = src('app/(main)/analytics/page.tsx');
  assert.match(page, /'\/analytics\/overview'/);
  assert.doesNotMatch(page, /ConclusionHero|ContentRankList|ReplayPanel/);
  for (const gone of ['ConclusionHero', 'ContentRankList', 'ReplayPanel', 'ConversionFunnelCard']) {
    assert.ok(!fs.existsSync(path.join(ROOT, 'src/components/analytics', `${gone}.tsx`)), `${gone}.tsx 仍在`);
  }
  assert.match(src('components/analytics/OwnDataOverview.tsx'), /engagement\.message/);
});

await check('创作工作室：AI 额度来自 /billing/subscription 的 aiTokens（与接口额度闸同一来源）', () => {
  const a = describeAiAllowance({ aiTokens: { limit: 50000, used: 12000, remaining: 38000, unlimited: false, imageTokenEquivalent: 2500 } });
  assert.equal(a.available, true);
  assert.equal(a.exhausted, false);
  assert.match(a.summary, /已用 1\.2万 \/ 5万 令牌，剩余 3\.8万/);
  assert.match(a.rule, /封面每张计 2,500 令牌/);
  const done = describeAiAllowance({ aiTokens: { limit: 50000, used: 50000, remaining: 0, unlimited: false } });
  assert.equal(done.exhausted, true);
  assert.equal(describeAiAllowance({ aiTokens: { limit: -1, used: 5, remaining: -1, unlimited: true } }).unlimited, true);
  // 读不到时不编数字
  const none = describeAiAllowance(null);
  assert.equal(none.available, false);
  assert.doesNotMatch(none.summary, /\d/);
  assert.equal(describeAiAllowance({ monthlyQuota: 5 }).available, false);
});

await check('创作工作室：不再显示签到积分与写死的「单次消耗 N 积分」；视频生成不以「测试版」露出、不可点', () => {
  const studio = src('app/(main)/studio/page.tsx');
  assert.doesNotMatch(studio, /\/points\/balance|单次消耗|可用余额|积分/);
  assert.match(studio, /'\/billing\/subscription'/);
  assert.match(studio, /describeAiAllowance/);
  assert.doesNotMatch(studio, /测试版|智能视频生成|\/ai\/generate\/video|handleGenerateVideo/);
  assert.match(studio, /视频生成[\s\S]{0,80}暂未开放/);
  // 页面上不能有没有 onClick 的「重新生成」
  assert.doesNotMatch(studio, /<Button(?![^>]*onClick)[^>]*>重新生成<\/Button>/);
});

await check('热点页：爆款拆解结果真的显示出来（原来只有标题「深度解构报告」），英文键名不上屏', () => {
  const sections = flattenViralAnalysis({ '标题吸引力': { '评分': 8, '技巧': ['数字', '反问'] }, hook_analysis: '开头抛出反常识结论' });
  assert.deepEqual(sections[0], { heading: '标题吸引力', lines: ['评分：8', '技巧：', '· 数字', '· 反问'] });
  assert.deepEqual(sections[1], { heading: '', lines: ['开头抛出反常识结论'] });
  assert.doesNotMatch(JSON.stringify(sections), /hook_analysis/);
  assert.deepEqual(flattenViralAnalysis({ raw_analysis: '纯文本分析' }), [{ heading: '', lines: ['纯文本分析'] }]);
  assert.deepEqual(flattenViralAnalysis(null), []);
  const page = src('app/(main)/hot/page.tsx');
  assert.match(page, /flattenViralAnalysis\(analysisResult\)/);
  assert.match(page, /AI_TEXT_LABEL/, 'AI 拆解结果必须带「AI 生成」标识');
  assert.doesNotMatch(page, /BETA|爆款预测 V2|捕捉风口|成为爆款的潜力|按此模板创作|source_analysis/);
  // 热点卡片跳到工作室并预填主题（/create 只是重定向，会丢掉参数）
  assert.match(page, /\/studio\?topic=/);
  assert.match(src('app/(main)/studio/page.tsx'), /searchParams\.get\('topic'\)/);
});

await check('内容库：不再有点了必失败的「资产 / 生成复盘 / 复用 / 版本对比 / 回滚」；预览看正文；搜索接到后端', () => {
  const page = src('app/(main)/contents/page.tsx');
  assert.doesNotMatch(page, /\/assets|\/versions|\/compare|\/clone|\/rollback|\/review\/generate|>资产<|生成复盘/);
  assert.doesNotMatch(page, /window\.open\(record\.media_urls/);
  assert.match(page, /onClick=\{\(\) => setPreviewFor\(record\)\}>预览/);
  assert.match(page, /onSearch=\{\(value\) => fetchContents\(value\)\}/);
  assert.match(page, /keyword=\$\{encodeURIComponent/);
});

await check('侧栏套餐卡读真实套餐（原来写死「免费版」）；顶栏不再显示积分', () => {
  assert.deepEqual(planBadge({ plan: 'pro', renewalDate: '2026-12-31T00:00:00.000Z' }), { name: 'Solo', detail: '有效期至 2026年12月31日' });
  assert.equal(planBadge({ plan: 'free' }).name, '免费版');
  assert.equal(planBadge({ success: true, data: { plan: 'team' } }).name, 'Team');
  // 读不到时不猜档位
  assert.equal(planBadge(null).name, '我的套餐');
  assert.equal(planBadge({ plan: 'hacker' }).name, '我的套餐');
  const layout = src('components/layout/MainLayout.tsx');
  assert.match(layout, /'\/billing\/subscription'/);
  assert.match(layout, /\{plan\.name\}/);
  assert.doesNotMatch(layout, />免费版</);
  assert.doesNotMatch(layout, /usePointsStore|\{points\}|积分中心|ThunderboltOutlined/);
});

await check('内容库桌面表格：「操作」列固定在右侧不会被挤出可视区；封面列只用真实封面，没有就不显示图', () => {
  assert.equal(contentCoverUrl({ cover_url: 'https://cdn.example.cn/a.png', media_urls: ['https://x/b.png'] }), 'https://cdn.example.cn/a.png');
  assert.equal(contentCoverUrl({ media_urls: ['https://x/v.mp4', 'https://x/b.png'] }), 'https://x/b.png');
  assert.equal(contentCoverUrl({ media_urls: [] }), '');
  assert.equal(contentCoverUrl(null), '');
  const page = src('app/(main)/contents/page.tsx');
  assert.match(page, /key: 'action',[\s\S]{0,60}fixed: 'right'/);
  assert.doesNotMatch(page, /PLACEHOLDER_IMAGES/);
  assert.match(page, /contentCoverUrl\(record\)/);
  // 列宽总和（不含勾选列）控制在 910px 以内
  const widths = [...page.slice(page.indexOf('const columns'), page.indexOf('const rowSelection')).matchAll(/^ {12}width: (\d+),/gm)].map((m) => Number(m[1]));
  assert.ok(widths.reduce((a, b) => a + b, 0) <= 910, `列宽合计 ${widths.reduce((a, b) => a + b, 0)}`);
});

await check('工作室「已绑定账号」：GET /accounts 拆掉外层后就是数组，不再按带 success 的外层读成 0 个', () => {
  const accounts = [{ id: 'a1', platform: 'douyin' }, { id: 'a2', platform: 'bilibili' }];
  assert.equal(parseAccountList(accounts).length, 2);
  assert.equal(parseAccountList({ success: true, data: accounts }).length, 2);
  assert.equal(parseAccountList({ accounts }).length, 2);
  assert.deepEqual(parseAccountList(null), []);
  const studio = src('app/(main)/studio/page.tsx');
  assert.doesNotMatch(studio, /res\?\.success|accountRes\?\.data/);
  assert.equal((studio.match(/parseAccountList\(/g) || []).length, 2);
});

await check('全仓：apiClient 的结果不能只按带 success 的外层读（apiClient 已拆掉外层）', () => {
  const offenders = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { if (e.name !== 'api') walk(full); continue; }
      if (!/\.tsx?$/.test(e.name) || full.endsWith('api-client.ts')) continue;
      const text = fs.readFileSync(full, 'utf8');
      if (!/apiClient\./.test(text)) continue;
      // 同一文件里用 apiClient 取到的结果再判断 .success 才算可疑（原始 fetch 的 envelope 不算）
      for (const m of text.matchAll(/const (\w+)[^=]*= await apiClient\.\w+[^;]*;[\s\S]{0,300}?\b\1\??\.success\b/g)) offenders.push(`${path.relative(ROOT, full)}: ${m[1]}.success`);
    }
  };
  walk(path.join(ROOT, 'src'));
  // CheckInModal：/points/checkin 的业务结果本身带 success 字段（不是外层），允许
  assert.deepEqual(offenders.filter((o) => !o.includes('CheckInModal')), []);
});

await check('爆款拆解失败：弹窗里常驻显示原因（后端的中文 503「AI 服务暂不可用，请稍后再试」），不只是一闪而过的提示', () => {
  const page = src('app/(main)/hot/page.tsx');
  assert.match(page, /setAnalysisError\(reason\)/);
  assert.match(page, /\{analysisError && <Alert type="error"/);
  assert.match(page, /safeErrorText\(e, 'AI 服务暂不可用，请稍后再试'\)/);
  const api = fs.readFileSync(path.join(ROOT, '../api/src/modules/ai/ai.service.ts'), 'utf8');
  assert.match(api, /AI_UNAVAILABLE_MESSAGE = 'AI 服务暂不可用，请稍后再试'/);
});

if (failures) { console.error(`${failures} failed`); process.exit(1); }
console.log('All page data tests passed');
