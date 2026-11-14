/**
 * 装饰性图标不得把英文图标名（download、safety）带进可访问名称。
 * antd 图标默认 aria-label 等于图标名，必须标 aria-hidden。
 * 只有图标、没有可见文字的按钮必须自带中文 aria-label，否则隐藏图标后就没有名字。
 *   node scripts/test-a11y-icons.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
const problems = [];

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) return walk(f);
    return e.name.endsWith('.tsx') ? [f] : [];
  });
}

const iconRe = /<([A-Z][A-Za-z0-9]*(?:Outlined|Filled|TwoTone))\b([^>]*?)\/>/g;

function selfClosingButtons(src) {
  const found = [];
  let i = 0;
  while (i < src.length) {
    const start = src.indexOf('<Button', i);
    if (start < 0) break;
    const boundary = src[start + 7];
    if (boundary && /[A-Za-z0-9_]/.test(boundary)) { i = start + 7; continue; }
    let j = start + 7;
    let quote = null;
    let brace = 0;
    let selfClose = false;
    for (; j < src.length; j++) {
      const c = src[j];
      if (quote) {
        if (c === '\\') { j++; continue; }
        if (c === quote) quote = null;
        continue;
      }
      if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
      if (c === '{') { brace++; continue; }
      if (c === '}') { brace = Math.max(0, brace - 1); continue; }
      if (brace === 0 && c === '/' && src[j + 1] === '>') { selfClose = true; j += 2; break; }
      if (brace === 0 && c === '>') { j++; break; }
    }
    if (selfClose) found.push({ tag: src.slice(start, j), line: src.slice(0, start).split('\n').length });
    i = j;
  }
  return found;
}

for (const file of walk(SRC)) {
  const src = fs.readFileSync(file, 'utf8');
  const rel = path.relative(ROOT, file);
  for (const m of src.matchAll(iconRe)) {
    if (!/\baria-hidden\b/.test(m[2]) && !/\baria-label=/.test(m[2])) {
      const line = src.slice(0, m.index).split('\n').length;
      problems.push(`${rel}:${line} 图标 <${m[1]}> 缺少 aria-hidden，英文图标名会进可访问名称`);
    }
  }
  for (const btn of selfClosingButtons(src)) {
    if (!/\baria-label\b/.test(btn.tag)) {
      problems.push(`${rel}:${btn.line} 没有文字的按钮缺少 aria-label`);
    }
  }
}

const providers = fs.readFileSync(path.join(SRC, 'app/client-providers.tsx'), 'utf8');
if (!/button=\{\{\s*autoInsertSpace:\s*false\s*\}\}/.test(providers)) {
  problems.push('src/app/client-providers.tsx: 需要 button={{ autoInsertSpace: false }}，否则两个汉字的按钮会变成「登 录」');
}
const css = fs.readFileSync(path.join(SRC, 'app/globals.css'), 'utf8');
if (!/\.ant-btn\.cn-cjk-pair[\s\S]*letter-spacing:\s*0\.34em/.test(css)) {
  problems.push('src/app/globals.css: 两个汉字的按钮需要 0.34em 字距，保住原来的视觉空隙');
}

if (problems.length) {
  console.error('可访问名称检查失败：');
  for (const p of problems) console.error(`  ✗ ${p}`);
  process.exit(1);
}
console.log('可访问名称检查通过：装饰图标已隐藏，两个汉字的按钮不再插入空格');
