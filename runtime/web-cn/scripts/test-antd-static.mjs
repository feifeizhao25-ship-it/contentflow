/**
 * React 19 + antd 5：antd 的静态方法（message.xxx、Modal.confirm、notification.xxx）在生产构建里渲染不出来，
 * 「批量重试」「通过」「提交审核」点了没反应、成功 / 报错提示都看不到。
 * 现在统一走 <App> + App.useApp()（src/lib/antd-app.tsx）。本检查防止有人再直接用静态方法。
 *   node scripts/test-antd-static.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
const problems = [];
const strip = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full);
    else if (/\.(tsx?|jsx?)$/.test(e.name) && !full.endsWith(path.join('lib', 'antd-app.tsx'))) check(full);
  }
}

function check(file) {
  const src = strip(fs.readFileSync(file, 'utf8'));
  const rel = path.relative(ROOT, file);
  for (const m of src.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"]antd['"]/g)) {
    const names = m[1].split(',').map((n) => n.trim().split(/\s+as\s+/)[0]);
    for (const banned of ['message', 'notification']) {
      if (names.includes(banned)) problems.push(`${rel}: 从 'antd' 直接引入 ${banned}（静态方法在 React 19 下不显示），请改用 '@/lib/antd-app'`);
    }
  }
  if (/import\(\s*['"]antd['"]\s*\)\s*\.then\(\s*\(\s*\{[^}]*\b(message|notification)\b/.test(src)) {
    problems.push(`${rel}: 动态 import('antd') 取 message / notification，请改用 '@/lib/antd-app'`);
  }
  for (const m of src.matchAll(/\bModal\.(confirm|info|success|error|warning|warn)\(/g)) {
    problems.push(`${rel}: Modal.${m[1]}() 是静态方法，请改用 '@/lib/antd-app' 的 modal.${m[1]}()`);
  }
  if (/\b(message|notification)\.(config|useMessage|useNotification)\b/.test(src) && !/antd-app/.test(src)) {
    problems.push(`${rel}: 直接配置 antd 静态 message / notification`);
  }
}

walk(SRC);

const providers = strip(fs.readFileSync(path.join(SRC, 'app/client-providers.tsx'), 'utf8'));
if (!/<ConfigProvider[\s\S]*<App\b[\s\S]*<AntdAppBridge \/>[\s\S]*\{children\}[\s\S]*<\/App>[\s\S]*<\/ConfigProvider>/.test(providers)) {
  problems.push('src/app/client-providers.tsx: <AntdAppBridge /> 必须在 ConfigProvider 内的 <App> 里、页面之前');
}

if (problems.length) {
  console.error('antd 静态方法检查失败：');
  for (const p of problems) console.error(`  ✗ ${p}`);
  process.exit(1);
}
console.log('antd 静态方法检查通过：提示与对话框都走 App.useApp()');
