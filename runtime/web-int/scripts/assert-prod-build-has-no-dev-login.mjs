/**
 * 共2: the production build must not contain the test-login channel.
 * npm run build runs this after next build. Missing .next is a failure, not a skip.
 */
import fs from 'node:fs';
import path from 'node:path';

const marker = 'contentflow-dev-login-channel-v1';
const root = path.join(process.cwd(), '.next');
if (!fs.existsSync(root)) {
  console.error('No production .next directory, so the test-login absence check did not run');
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
  console.error('Production build contains the test-login channel:\n' + hits.map((item) => '  - ' + item).join('\n'));
  process.exit(1);
}
console.log('Production build does not contain the test-login channel');
