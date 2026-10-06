/**
 * 国内版显示层的中文与身份问题（2026-10-05 真实截图）：
 *  - 内容状态 rejected 直接显示英文「rejected」（只映射了 5 个状态）；
 *  - 「Skills 能力中心」；隐式标识里的生成方写「ContentFlow (分发侠)」；
 *  - 封面占位图上是英文「ContentFlow」水印；
 *  - 设置页「姓名」为空：initializeAuth 从未被调用，store 里没有用户；
 *  - 已登录访问 / 仍显示「登录 / 免费注册」。
 *   node --experimental-strip-types scripts/test-chinese-display.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { contentStatusText, CONTENT_STATUS_LABELS, contentTypeText } from '../src/lib/status-labels.ts';
import { AI_GENERATOR_NAME } from '../src/lib/ai-content-label.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
let failures = 0;
function check(name, fn) {
  try { fn(); console.log(`  PASS ${name}`); } catch (e) { failures++; console.error(`  FAIL ${name}: ${e.message}`); }
}
const CJK = /[㐀-鿿]/;

console.log('Chinese display tests');

check('内容状态全部有中文名，rejected → 已驳回；未知状态不把英文原值上屏', () => {
  for (const [key, label] of Object.entries(CONTENT_STATUS_LABELS)) assert.ok(CJK.test(label), `${key} 没有中文名`);
  assert.equal(contentStatusText('rejected'), '已驳回');
  assert.equal(contentStatusText('pending_review'), '待审核');
  assert.equal(contentStatusText('approved'), '已通过');
  assert.equal(contentStatusText('draft'), '草稿');
  assert.equal(contentStatusText('some_new_status'), '未知状态');
  assert.equal(contentTypeText('carousel'), '其他');
});

check('内容库页面只经 contentStatusText 显示状态，不再 `|| status` 回落到英文', () => {
  const src = read('src/app/(main)/contents/page.tsx');
  assert.match(src, /contentStatusText\(status\)/);
  assert.doesNotMatch(src, /statusLabels\[status\] \|\| status/);
  assert.doesNotMatch(src, /typeLabels\[type\] \|\| type/);
});

check('「能力中心」不再带英文 Skills', () => {
  assert.doesNotMatch(read('src/app/(main)/skills/page.tsx'), />\s*Skills/);
});

check('隐式标识里的生成方是「分发侠」（Web 与 API 一致）', () => {
  assert.equal(AI_GENERATOR_NAME, '分发侠');
  assert.match(read('../api/src/common/ai-content-label.ts'), /export const AI_GENERATOR_NAME = '分发侠';/);
});

check('封面占位图上没有英文水印', () => {
  for (const f of ['public/placeholders/cover.svg', 'public/placeholders/content.svg']) {
    const texts = [...read(f).matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]);
    for (const t of texts) assert.ok(!/[A-Za-z]{2,}/.test(t), `${f} 里有英文文字：${t}`);
  }
});

check('进入工作台时加载登录身份（设置页姓名不再为空）', () => {
  const layout = read('src/components/layout/MainLayout.tsx');
  assert.match(layout, /initializeAuth\(\)/);
  const settings = read('src/app/(main)/settings/page.tsx');
  assert.match(settings, /name: user\.name/);
});

check('已登录访问首页显示「进入工作台」，不再只给登录 / 注册', () => {
  const home = read('src/app/page.tsx');
  assert.match(home, /cookies\(\)\)\.get\('ff_token'\)/);
  assert.match(home, /signedIn \? <Link href="\/studio"[^>]*>进入工作台/);
});

check('合规资料过期时，创作工作室显示「合规规则资料需要人工复核」（读后端时效状态，不在前端猜）', () => {
  const notice = read('src/components/compliance/ComplianceReviewNotice.tsx');
  assert.match(notice, /'\/ai\/compliance-sources\/status'/);
  assert.match(notice, /合规规则资料需要人工复核/);
  assert.match(notice, /needsReview/);
  assert.match(read('src/app/(main)/studio/page.tsx'), /<ComplianceReviewNotice \/>/);
});

if (failures) { console.error(`\n${failures} 项失败`); process.exit(1); }
console.log('All Chinese display tests passed');
