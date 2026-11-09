/**
 * 工作台主导航只有：创作、内容、发布、数据、账号、设置。
 * 热点和社区没有可售数据，不得出现在主导航文案里。
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PRIMARY_NAV_LABELS } from '../src/components/layout/primary-nav.ts';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const layout = fs.readFileSync(path.join(root, 'src/components/layout/MainLayout.tsx'), 'utf8');

assert.deepEqual([...PRIMARY_NAV_LABELS], ['创作', '内容', '发布', '数据', '账号', '设置']);
assert.equal(layout.includes('PRIMARY_NAV'), true);
assert.equal(layout.includes('热点追踪'), false);
assert.equal(layout.includes('创作者社区'), false);
console.log('primary nav: 6 labels, hot and community omitted');
