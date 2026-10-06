/**
 * 分发如实降级（审计 P0-1）：
 *  - 导航写「分发中心——一键多平台发布」，实际一条也发不出去；
 *  - 小红书、视频号、公众号没有可用的自动发布接口，也没有兜底流程。
 * 现在：导航与发布页如实说明；三个平台走「人工确认发布」（复制文案、下载带 AI 标识的封面、我已手动发布 + 回填链接）。
 *   node --import ./scripts/ts-extensionless.mjs --experimental-strip-types scripts/test-manual-publish.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCopyText, copyTextHasAiLabel, MANUAL_PLATFORMS, PUBLISH_CHANNEL_NOTICE, isManualPlatform } from '../src/lib/manual-publish.ts';
import { AI_TEXT_LABEL } from '../src/lib/ai-content-label.ts';
import { mapPublishTasks } from '../src/lib/page-data.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, 'src', rel), 'utf8');
let failures = 0;
function check(name, fn) {
  try { fn(); console.log(`  PASS ${name}`); } catch (e) { failures++; console.error(`  FAIL ${name}: ${e.message}`); }
}

console.log('Manual publish tests');

check('导航不再写「一键多平台发布」，发布页顶部常驻如实说明', () => {
  const layout = read('components/layout/MainLayout.tsx');
  assert.doesNotMatch(layout, /一键多平台发布/);
  assert.doesNotMatch(layout, />分发中心</);
  assert.equal(PUBLISH_CHANNEL_NOTICE, '抖音、B 站需完成开放平台授权后自动发布；小红书、视频号、公众号暂不支持自动发布，可一键复制文案并下载带 AI 标识的封面后手动发布');
  const page = read('app/(main)/publish/page.tsx');
  assert.match(page, /PUBLISH_CHANNEL_NOTICE/);
  assert.doesNotMatch(read('app/(main)/studio/page.tsx'), /多平台一键搞定|一键多平台发布|见证 AI 电影工厂/);
});

check('人工确认发布只覆盖小红书、视频号、公众号', () => {
  assert.deepEqual(MANUAL_PLATFORMS.map((p) => p.id), ['xhs', 'weixin', 'wechat_mp']);
  assert.ok(isManualPlatform('xhs') && !isManualPlatform('douyin') && !isManualPlatform('bilibili'));
});

check('复制文案：AI 生成的内容一定带「AI 生成」显式标识（原文缺标识也补上），人工内容不加', () => {
  const ai = buildCopyText({ title: '秋天的书单', body: '正文', aiGenerated: true });
  assert.ok(copyTextHasAiLabel(ai));
  assert.ok(ai.startsWith('秋天的书单'));
  assert.equal(buildCopyText({ title: '', body: `${AI_TEXT_LABEL}\n正文`, aiGenerated: true }).split(AI_TEXT_LABEL).length, 2, '不重复加标识');
  assert.ok(!copyTextHasAiLabel(buildCopyText({ title: 'T', body: '我自己写的', aiGenerated: false })));
});

check('下载封面：画上显式「AI 生成」并写入隐式标识，经本站 export-image 同源取图', () => {
  const lib = read('lib/manual-publish.ts');
  assert.match(lib, /\/api\/ai\/export-image\?/);
  assert.match(lib, /url=\$\{encodeURIComponent\(coverUrl\)\}/);
  assert.match(lib, /contentId: meta\.contentId, providerCode: meta\.providerCode/, '隐式标识要带内容编号与服务提供者编码');
  assert.match(lib, /fillText\(COVER_LABEL_TEXT/);
  assert.match(lib, /labelImageDataUrl\(/);
});

check('发布中心：待人工发布任务有「复制文案」「下载封面」「我已手动发布」，可回填链接；不再显示「未命名账号」', () => {
  const list = read('components/publish/PublishTaskList.tsx');
  for (const text of ['复制文案', '下载封面', '我已手动发布', '待人工发布', '已人工发布', '/manual-kit', '/manual-done', '只保存链接']) {
    assert.ok(list.includes(text), `缺少「${text}」`);
  }
  assert.doesNotMatch(list, /'未命名账号'/);
  assert.doesNotMatch(list, /ERROR_CODE|UNKNOWN/);
});

check('内容库对已通过的内容开放「发布」（创建人工发布任务）；创作工作室分开处理自动与人工平台', () => {
  const contents = read('app/(main)/contents/page.tsx');
  assert.match(contents, /'\/publish\/manual-tasks'/);
  assert.match(contents, /record\.status === 'approved' \|\| record\.status === 'published'/);
  const studio = read('app/(main)/studio/page.tsx');
  assert.match(studio, /'\/publish\/manual-tasks'/);
  assert.match(studio, /platformAccountIds:/, '自动发布要按后端 DTO 传 platformAccountIds');
});

check('日历：人工发布任务按平台与状态显示', () => {
  const [task] = mapPublishTasks({ tasks: [{ id: 't1', status: 'manual_pending', scheduled_at: '2026-10-08T02:00:00Z', content: { title: 'A' }, platform_content: { platform: 'xhs' } }] });
  assert.equal(task.status, 'manual_pending');
  assert.deepEqual(task.platforms, ['xhs']);
});

if (failures) { console.error(`\n${failures} 项失败`); process.exit(1); }
console.log('All manual publish tests passed');
