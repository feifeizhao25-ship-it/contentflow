/**
 * 语音控件测试说明
 *
 * 国内网页先请求已有的 /api/ai/tts/openai、azure、elevenlabs。
 * 这些路由现在返回 501，测试确认不会把 501 当成音频，而是改用浏览器朗读。
 * 麦克风只走浏览器语音识别。日历和排期表不是 AI 正文，不放语音按钮。
 * 窄屏用卡片（max-md / md:hidden），宽屏编辑器把卡片边框收掉（md:border-0）。
 *
 *   node --import ./scripts/ts-extensionless.mjs --experimental-strip-types scripts/test-voice.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const { joinVoiceText, resolveSpeechSource, CN_TTS_ROUTES, prepareSpeechText, stripExplicitAiLabel, hasChineseVoice, micRestrictionMessage, voiceLabelsZh } = await import('../src/lib/voice-speech.ts');

let failures = 0;
async function check(name, fn) {
  try { await fn(); console.log(`  PASS ${name}`); }
  catch (error) { failures++; console.error(`  FAIL ${name}: ${error.message}`); }
}

function fakeFetch(routes) {
  const calls = [];
  return {
    calls,
    fetchImpl: async (url) => {
      calls.push(url);
      const hit = routes[url];
      if (!hit) throw new Error('network');
      return hit;
    },
  };
}

const audioHit = {
  ok: true,
  status: 200,
  headers: { get: (name) => (name === 'content-type' ? 'audio/mpeg' : null) },
  arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
};
const unavailable = {
  ok: false,
  status: 501,
  headers: { get: () => 'application/json' },
  arrayBuffer: async () => new ArrayBuffer(0),
};

console.log('Voice speech tests');

await check('国内朗读按顺序使用三条已有 TTS 路由', async () => {
  assert.deepEqual([...CN_TTS_ROUTES], ['/api/ai/tts/openai', '/api/ai/tts/azure', '/api/ai/tts/elevenlabs']);
});

await check('空文本不请求路由', async () => {
  const client = fakeFetch({});
  const plan = await resolveSpeechSource({ text: '  ', language: 'zh-CN', routes: CN_TTS_ROUTES, fetchImpl: client.fetchImpl, browserAvailable: true });
  assert.equal(plan.source, 'unavailable');
  assert.equal(client.calls.length, 0);
});

await check('501 继续下一条，拿到音频就用那条路由', async () => {
  const client = fakeFetch({
    '/api/ai/tts/openai': unavailable,
    '/api/ai/tts/azure': audioHit,
    '/api/ai/tts/elevenlabs': audioHit,
  });
  const plan = await resolveSpeechSource({ text: '台灯教程', language: 'zh-CN', routes: CN_TTS_ROUTES, fetchImpl: client.fetchImpl, browserAvailable: true });
  assert.equal(plan.source, 'tts-route');
  assert.equal(plan.route, '/api/ai/tts/azure');
  assert.deepEqual(client.calls, ['/api/ai/tts/openai', '/api/ai/tts/azure']);
});

await check('三条都不可用时改用浏览器，而不是假装有音频', async () => {
  const client = fakeFetch({
    '/api/ai/tts/openai': unavailable,
    '/api/ai/tts/azure': unavailable,
    '/api/ai/tts/elevenlabs': unavailable,
  });
  const plan = await resolveSpeechSource({ text: '台灯教程', language: 'zh-CN', routes: CN_TTS_ROUTES, fetchImpl: client.fetchImpl, browserAvailable: true });
  assert.equal(plan.source, 'browser');
  const blocked = await resolveSpeechSource({ text: '台灯教程', language: 'zh-CN', routes: CN_TTS_ROUTES, fetchImpl: client.fetchImpl, browserAvailable: false });
  assert.equal(blocked.source, 'unavailable');
});

await check('语音输入接在已有文字后面', () => {
  assert.equal(joinVoiceText('', ' 台灯教程 '), '台灯教程');
  assert.equal(joinVoiceText('主题', '教程'), '主题 教程');
  assert.equal(joinVoiceText('主题 ', '教程'), '主题 教程');
});

await check('创作工作室：宽屏收起卡片，窄屏保留卡片，麦克风在输入旁', () => {
  const studio = read('src/app/(main)/studio/page.tsx');
  const voice = read('src/components/voice/VoiceControls.tsx');
  assert.match(studio, /VoiceField/);
  assert.match(studio, /VoiceMicButton/);
  assert.match(studio, /SpeakButton/);
  assert.match(studio, /VoiceReadout/);
  assert.match(studio, /max-md:rounded-2xl/);
  assert.match(voice, /md:border-0/);
  assert.match(voice, /h-14 w-14 md:h-10 md:w-10/);
  assert.match(voice, /h-12 w-12 md:h-8 md:w-8/);
});

await check('内容库：桌面仍是表格，窄屏卡片上才朗读正文', () => {
  const page = read('src/app/(main)/contents/page.tsx');
  assert.match(page, /className="space-y-3 md:hidden"/);
  assert.match(page, /className="hidden md:block"/);
  assert.match(page, /SpeakButton text=\{String\(record\.body\)\}/);
  assert.match(page, /VoiceMicButton/);
  assert.doesNotMatch(page, /columns=\{columns\}[\s\S]{0,200}SpeakButton/);
});

await check('排期和日历不是 AI 正文，不放语音按钮', () => {
  assert.doesNotMatch(read('src/app/(main)/schedule/page.tsx'), /VoiceMicButton|SpeakButton|voice-speech/);
  assert.doesNotMatch(read('src/app/(main)/calendar/page.tsx'), /VoiceMicButton|SpeakButton|voice-speech/);
});

await check('朗读前去掉显式标识和 Markdown，不改调用方原文', () => {
  const original = '【本内容由 AI 生成】\n# 标题\n**加粗** 和 [链接文字](https://example.com/a) `代码`';
  assert.equal(prepareSpeechText(original), '标题\n加粗 和 链接文字 代码');
  assert.equal(original.startsWith('【本内容由 AI 生成】'), true);
  assert.equal(prepareSpeechText('正文\n【本内容由 AI 生成】'), '正文');
  assert.equal(stripExplicitAiLabel('请保留【本内容由 AI 生成】这几个字'), '请保留【本内容由 AI 生成】这几个字');
  assert.equal(prepareSpeechText('【本内容由 AI 生成】'), '');
  const studio = read('src/app/(main)/studio/page.tsx');
  const contents = read('src/app/(main)/contents/page.tsx');
  assert.match(studio, /SpeakButton text=\{script\}/);
  assert.match(contents, /SpeakButton text=\{String\(record\.body\)\}/);
  assert.doesNotMatch(studio, /prepareSpeechText|stripExplicitAiLabel/);
  assert.match(read('src/components/voice/VoiceControls.tsx'), /prepareSpeechText\(text\)/);
});

await check('没有中文语音时给出中文说明', () => {
  assert.equal(hasChineseVoice([]), false);
  assert.equal(hasChineseVoice([{ lang: 'en-US', name: 'Samantha' }]), false);
  assert.equal(hasChineseVoice([{ lang: 'zh-CN', name: 'Tingting' }]), true);
  assert.equal(hasChineseVoice([{ lang: 'zh_CN' }]), true);
  assert.equal(hasChineseVoice([{ lang: 'cmn-Hans-CN' }]), true);
  assert.match(voiceLabelsZh.noChineseVoice, /中文语音/);
  assert.match(read('src/components/voice/VoiceControls.tsx'), /noChineseVoice/);
});

await check('麦克风在不支持或国内网络错误时停用并说明', () => {
  assert.match(micRestrictionMessage('unsupported'), /麦克风已停用/);
  assert.match(micRestrictionMessage('network'), /没有改用其他付费语音服务/);
  assert.match(micRestrictionMessage('service-not-allowed'), /麦克风已停用/);
  assert.match(micRestrictionMessage('not-allowed'), /麦克风/);
  assert.equal(micRestrictionMessage('no-speech'), null);
  assert.match(read('src/components/voice/VoiceControls.tsx'), /micRestrictionMessage/);
  assert.match(read('src/components/voice/VoiceControls.tsx'), /disabled=\{Boolean\(blocked\)\}/);
});

await check('热点拆解和流量三明治的 AI 产出可以朗读', () => {
  const hot = read('src/app/(main)/hot/page.tsx');
  const sandwich = read('src/app/(main)/traffic-sandwich/page.tsx');
  assert.match(hot, /SpeakButton/);
  assert.match(hot, /VoiceMicButton/);
  assert.match(hot, /AI_TEXT_LABEL/);
  assert.match(hot, /拆解结果已复制（含「AI 生成」标识）/);
  assert.match(sandwich, /SpeakButton/);
  assert.match(sandwich, /VoiceMicButton/);
});

if (failures) {
  console.error(`\n${failures} 项失败`);
  process.exit(1);
}
console.log('All voice tests passed');
