/**
 * 国内版显示格式：北京时间、热度不用 k、平台名和图标、活动日志不因缺字段整页崩溃。
 *   node --experimental-strip-types scripts/test-cn-display.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatCnDate, formatHeat, platformDisplay } from '../src/lib/cn-display.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
let failures = 0;
function check(name, fn) {
  try { fn(); console.log(`  PASS ${name}`); } catch (e) { failures++; console.error(`  FAIL ${name}: ${e.message}`); }
}

console.log('CN display tests');

check('日期按北京时间写成 YYYY-MM-DD HH:mm', () => {
  assert.equal(formatCnDate('2026-10-23T08:00:00.000Z', true), '2026-10-23 16:00');
  assert.equal(formatCnDate('2026-09-01T00:00:00Z'), '2026-09-01');
  assert.equal(formatCnDate('not-a-date'), '');
  assert.equal(formatCnDate(''), '');
});

check('热度用万，不出现英文 k', () => {
  assert.equal(formatHeat(128000), '12.8万');
  assert.equal(formatHeat(10000), '1万');
  assert.equal(formatHeat(860), '860');
  assert.equal(formatHeat(0), '暂无');
});

check('平台别名映射到中文名和图标，未知平台不把英文原值上屏', () => {
  assert.equal(platformDisplay('xiaohongshu').name, '小红书');
  assert.equal(platformDisplay('xhs').icon, '📕');
  assert.equal(platformDisplay('weibo').name, '微博');
  assert.notEqual(platformDisplay('weibo').icon, '👁️');
  assert.equal(platformDisplay('bilibili').icon, '📺');
  assert.equal(platformDisplay('douyin').name, '抖音');
  assert.equal(platformDisplay('tiktok').name, '抖音');
  assert.equal(platformDisplay('some_new_platform').name, '其他平台');
});

check('热点页使用统一格式，不再写 k 指数或只认 xhs', () => {
  const src = read('src/app/(main)/hot/page.tsx');
  assert.match(src, /formatHeat\(/);
  assert.match(src, /platformDisplay\(/);
  assert.doesNotMatch(src, /k 指数/);
  assert.doesNotMatch(src, /topic\.platform === 'xhs'/);
});

check('团队活动日志不读取不存在的 user.name，窄屏有卡片', () => {
  const src = read('src/app/(main)/team/page.tsx');
  assert.doesNotMatch(src, /item\.user\.name/);
  assert.match(src, /className="space-y-3 md:hidden"/);
  assert.match(src, /scroll=\{\{ x: 'max-content' \}\}/);
});

check('Safari：viewport-fit、安全区和 dvh，日期不用系统日期框', () => {
  const layout = read('src/app/layout.tsx');
  const css = read('src/app/globals.css');
  assert.match(layout, /viewportFit:\s*'cover'/);
  assert.match(css, /safe-area-inset-top/);
  assert.match(css, /100dvh/);
  assert.match(css, /PingFang SC/);
  assert.match(read('src/components/publish/TaskFilterBar.tsx'), /inputReadOnly/);
  assert.match(read('src/components/publish/TaskFilterBar.tsx'), /YYYY-MM-DD/);
  assert.doesNotMatch(read('src/app/(auth)/login/page.tsx'), /100vh/);
  const plist = read('../../ios-cn/ios/Runner/Info.plist');
  assert.match(plist, /<string>分发侠<\/string>/);
  assert.match(plist, /NSPhotoLibraryUsageDescription/);
  assert.doesNotMatch(plist, /Contentflow Cn/);
  assert.match(read('../../android-cn/android/app/src/main/AndroidManifest.xml'), /android:label="分发侠"/);
});

check('弹窗不能宽过屏幕，微博不再用眼睛图标', () => {
  assert.match(read('src/app/globals.css'), /\.ant-modal \{[^}]*max-width: calc\(100vw - 16px\)/s);
  assert.doesNotMatch(read('src/app/(main)/accounts/page.tsx'), /👁️/);
  assert.doesNotMatch(read('src/app/(main)/traffic-sandwich/page.tsx'), /流量收割机|Meta-Planning|全自动流量/);
  assert.doesNotMatch(read('src/app/(main)/settings/page.tsx'), /Meta-Planning/);
  assert.doesNotMatch(read('src/components/ai-create/GrowthSidebar.tsx'), /TikTok|RedBook/);
  assert.doesNotMatch(read('src/components/calendar/StrategyPanel.tsx'), /Douyin|RedBook/);
});

if (failures) { console.error(`\n${failures} 项失败`); process.exit(1); }
console.log('All CN display tests passed');
