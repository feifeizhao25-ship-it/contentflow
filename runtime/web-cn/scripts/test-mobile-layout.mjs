/**
 * 手机（390 宽）排版的静态回归检查。
 *
 * 2026-10-05 的真实截图里：/contents 标题「内容库管理」一字一行竖排、表格横向溢出、内容标题一字一行；
 * /schedule 标题竖排、日历被右侧栏挤压溢出；/analytics 卡片右侧被截断。
 * 真正的验收是截图脚本里的 390 宽断言（document.documentElement.scrollWidth <= 390 且主区域没有被裁掉的越界元素），
 * 这里守住修好的结构，防止回退：
 *   node scripts/test-mobile-layout.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, 'src', rel), 'utf8');
let failures = 0;
function check(name, fn) {
  try { fn(); console.log(`  PASS ${name}`); } catch (e) { failures++; console.error(`  FAIL ${name}: ${e.message}`); }
}

console.log('Mobile layout tests');

check('内容库：窄屏用卡片列表（md:hidden），表格只在 md 以上显示且可横向滚动', () => {
  const src = read('app/(main)/contents/page.tsx');
  assert.match(src, /className="space-y-3 md:hidden"/);
  assert.match(src, /className="hidden md:block"/);
  assert.match(src, /scroll=\{\{ x: 'max-content' \}\}/);
  assert.match(src, /whitespace-nowrap[^"]*">内容库管理</, '标题必须不换行');
  assert.match(src, /flex-col gap-3 sm:flex-row/, '标题区窄屏必须单列');
  assert.doesNotMatch(src, /style=\{\{ width: 320 \}\}/, '搜索框不能写死 320px');
});

check('排期日历：窄屏单列（日历在上、本日任务在下），格子在手机上只显示任务数', () => {
  const src = read('app/(main)/schedule/page.tsx');
  assert.match(src, /grid grid-cols-1 gap-6 lg:grid-cols-12/);
  assert.doesNotMatch(src, /className="col-span-9"|className="col-span-3/, '不能无断点地固定 9/3 栏');
  assert.match(src, /whitespace-nowrap text-2xl font-bold">排期日历/);
  assert.match(src, /sm:hidden/);
  assert.match(src, /min-h-\[56px\] sm:min-h-\[120px\]/);
});

check('数据分析：统计卡手机两列、卡片可收缩（min-w-0），不再用固定高度裁切', () => {
  const page = read('app/(main)/analytics/page.tsx');
  const cards = read('components/analytics/OwnDataOverview.tsx');
  assert.match(cards, /grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6/);
  assert.match(cards, /min-w-0/);
  assert.doesNotMatch(page, /h-\[calc\(100vh-64px\)\]|md:overflow-hidden/);
});

check('主布局：手机内容区 16px 边距', () => {
  assert.match(read('components/layout/MainLayout.tsx'), /"flex-1 p-4 sm:p-6 overflow-x-hidden min-w-0"/);
});

check('团队成员表在窄屏可横向滚动，而不是被裁掉', () => {
  assert.match(read('app/(main)/team/page.tsx'), /scroll=\{\{ x: 'max-content' \}\}/);
});

check('发布中心筛选栏：手机上分行（搜索、日期整行，平台 / 状态两列，按钮两列），不再挤在一行互相压住', () => {
  const bar = read('components/publish/TaskFilterBar.tsx');
  assert.match(bar, /flex flex-col gap-3 lg:flex-row/);
  assert.match(bar, /grid grid-cols-2 gap-3 min-w-0 sm:flex/);
  assert.match(bar, /className="col-span-2 w-full sm:w-64"/, '搜索框手机上整行');
  assert.match(bar, /className="col-span-2 w-full rounded-xl sm:w-auto"/, '日期框手机上整行');
  assert.doesNotMatch(bar, /className="min-w-\[160px\]"/, '平台筛选不能无断点地固定最小宽度');
  assert.equal((bar.match(/className="w-full sm:w-auto"/g) || []).length, 2, '两个操作按钮手机上各占一半');
});

if (failures) { console.error(`\n${failures} 项失败`); process.exit(1); }
console.log('All mobile layout tests passed');
