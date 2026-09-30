/**
 * AI 生成文本 / 封面的显式标识在界面里的覆盖。
 *
 * 改之前：API 的 generate/script 会返回 aiLabel，但前端从来没显示过它——新手引导里生成的脚本、
 * 复制出去的文本都没有「AI 生成」；内容工作室生成的正文与 AI 封面同样没有；保存到内容库时
 * 不带 source，AI 生成的内容被记成人工创作，后面发布时分发器也就不知道要带标识。
 *   node --import ./scripts/ts-extensionless.mjs --experimental-strip-types scripts/test-ai-text-label.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AI_TEXT_LABEL, isAiGeneratedText, labelAiGeneratedText } from '../src/lib/ai-content-label.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = (rel) => fs.readFileSync(path.join(ROOT, 'src', rel), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
let failures = 0;
async function check(name, fn) {
  try { await fn(); console.log(`  PASS ${name}`); } catch (e) { failures++; console.error(`  FAIL ${name}: ${e.message}`); }
}

console.log('AI text label tests');

await check('labelAiGeneratedText：加在最前面、幂等、空内容只有标识', () => {
  assert.equal(labelAiGeneratedText('正文'), `${AI_TEXT_LABEL}\n正文`);
  assert.equal(labelAiGeneratedText(labelAiGeneratedText('正文')), `${AI_TEXT_LABEL}\n正文`);
  assert.equal(labelAiGeneratedText('  '), AI_TEXT_LABEL);
});

await check('isAiGeneratedText：带标识或流程里做过标记都算 AI 生成', () => {
  assert.equal(isAiGeneratedText(`${AI_TEXT_LABEL}\nx`), true);
  assert.equal(isAiGeneratedText('人写的', true), true);
  assert.equal(isAiGeneratedText('人写的'), false);
});

await check('新手引导：生成的脚本正文与复制出去的文本都带「AI 生成」', () => {
  const guide = src('components/onboarding/FirstScriptGuide.tsx');
  assert.match(guide, /labelAiGeneratedText\(/);
  assert.match(guide, /const content = labelAiGeneratedText\(/);
});

await check('内容工作室：AI 封面显示「AI 生成」角标；保存到内容库时标记 source=ai', () => {
  const studio = src('app/(main)/studio/page.tsx');
  assert.match(studio, /AI 生成/);
  assert.match(studio, /coverIsAi/);
  assert.match(studio, /source:\s*isAiGeneratedText\(script, scriptIsAi \|\| coverIsAi\) \? 'ai' : 'manual'/);
});

await check('内容库：来源为 AI 的行显示「AI 生成」标签（后端存的是 source=\'ai\'，原来页面比较的是 \'ai_generated\'，标签永远不出现）', () => {
  assert.match(src('app/(main)/contents/page.tsx'), /source === 'ai'\s*\?\s*<Tag color="purple">AI 生成<\/Tag>/);
});

if (failures) { console.error(`${failures} failed`); process.exit(1); }
console.log('All AI text label tests passed');
