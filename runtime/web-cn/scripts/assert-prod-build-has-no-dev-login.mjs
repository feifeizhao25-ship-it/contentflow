/**
 * 共2：正式构建产物里不得出现测试登录通道。
 * 由 npm run build 在 next build 成功后执行。没有 .next 时直接失败，避免漏检。
 */
import fs from 'node:fs';
import path from 'node:path';

const marker = 'contentflow-dev-login-channel-v1';
const root = path.join(process.cwd(), '.next');
if (!fs.existsSync(root)) {
  console.error('没有生产构建目录 .next，无法证明测试登录通道不在正式构建里');
  process.exit(1);
}

const hits = [];
function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    if (name === 'cache' || name === 'node_modules') continue;
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      walk(full);
      continue;
    }
    if (stat.size > 8_000_000) continue;
    if (!/\.(js|mjs|cjs|json|html|rsc|css|map)$/.test(name)) continue;
    const text = fs.readFileSync(full, 'utf8');
    if (text.includes(marker)) hits.push(path.relative(root, full));
  }
}
walk(root);
if (hits.length) {
  console.error('正式构建里出现了测试登录通道：\n' + hits.map((item) => '  - ' + item).join('\n'));
  process.exit(1);
}
console.log('正式构建不含测试登录通道');
