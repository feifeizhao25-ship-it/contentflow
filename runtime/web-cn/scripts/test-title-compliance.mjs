/**
 * 创作页标题：按主题里的 N 个标题返回，去掉「N个…爆款标题」，每个标题都标合规状态。
 *   node --import ./scripts/ts-extensionless.mjs --experimental-strip-types scripts/test-title-compliance.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  cleanDisplayedTitles,
  isTitlePackagingLine,
  requestedTitleCount,
  titleStatusLabel,
} from '../src/lib/title-compliance.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, 'src', rel), 'utf8');
let failures = 0;
function check(name, fn) {
  try { fn(); console.log(`  PASS ${name}`); } catch (e) { failures++; console.error(`  FAIL ${name}: ${e.message}`); }
}

console.log('Title compliance tests');

check('主题写了 5 个标题就按 5 个，没写时沿用默认 6 个', () => {
  assert.equal(requestedTitleCount('请给我5个标题', 6), 5);
  assert.equal(requestedTitleCount('写 5 个小红书标题', 6), 5);
  assert.equal(requestedTitleCount('五个标题', 6), 5);
  assert.equal(requestedTitleCount('5个小红书爆款标题', 6), 5);
  assert.equal(requestedTitleCount('秋天的读书笔记', 6), 6);
  assert.equal(requestedTitleCount('10个技巧', 6), 6);
  assert.equal(requestedTitleCount('请给15个标题', 6), 6);
});

check('清理「6个小红书爆款标题」，并按 N 截断', () => {
  const raw = ['6个小红书爆款标题', '鼻炎根治？', '秋季护理笔记', '温差大怎么护肤', '出门记得围巾', '睡前热牛奶', '多喝水'];
  assert.equal(isTitlePackagingLine('6个小红书爆款标题'), true);
  assert.equal(isTitlePackagingLine('10个技巧'), false);
  assert.deepEqual(cleanDisplayedTitles(raw, '请给我5个标题', 6), ['鼻炎根治？', '秋季护理笔记', '温差大怎么护肤', '出门记得围巾', '睡前热牛奶']);
  assert.equal(cleanDisplayedTitles(raw, '秋天的读书笔记', 6).includes('6个小红书爆款标题'), false);
  assert.equal(cleanDisplayedTitles(raw, '秋天的读书笔记', 6).length, 6);
});

check('合规结果标成违规 / 需复核 / 未发现；没有结果时不假装未发现', () => {
  assert.equal(titleStatusLabel({ passed: false, level: 'violation', disclaimer: '这不是法律意见。', hits: [{ ruleId: 'CN-INDUSTRY-001', severity: 'block', reason: '根治' }] }), '违规');
  assert.equal(titleStatusLabel({ passed: true, level: 'risk', disclaimer: '这不是法律意见。', hits: [{ ruleId: 'CN-CAND-FOOD-DISEASE', severity: 'review', reason: '预防', label: '需复核' }] }), '需复核');
  assert.equal(titleStatusLabel({ passed: true, level: 'clear', disclaimer: '这不是法律意见。', hits: [] }), '未发现');
  assert.equal(titleStatusLabel(null), '未能检查');
});

check('创作页对每个标题调用合规检查，并在标题旁标出中文状态', () => {
  const page = read('app/(main)/studio/page.tsx');
  assert.match(page, /requestedTitleCount\(topic,\s*6\)/);
  assert.match(page, /cleanDisplayedTitles\(/);
  assert.match(page, /apiClient\.post\('\/ai\/compliance\/check',\s*\{\s*text:\s*title\s*\}\)/);
  assert.match(page, /titleStatusLabel\(/);
  assert.match(page, /data-testid="title-compliance-status"/);
  assert.match(page, /违规/);
  assert.match(page, /需复核/);
  assert.doesNotMatch(page, /count:\s*6,/);
});

if (failures) {
  console.error(`${failures} failed`);
  process.exit(1);
}
console.log('Title compliance tests passed');
