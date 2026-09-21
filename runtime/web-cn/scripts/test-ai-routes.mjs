/**
 * 国内版 AI 端点：
 *  - requireAuth 向后端校验令牌，而不是只看 cookie 在不在；
 *  - 语音合成、字幕、视频生成返回 501 NOT_AVAILABLE_IN_CN，不向境外发请求；
 *  - 分镜脚本转给后端并保持 { title, scenes } 形状。
 *   node --import ./scripts/ts-extensionless.mjs --experimental-transform-types scripts/test-ai-routes.mjs
 */
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server.js';

process.env.API_INTERNAL_URL = 'http://api.test:4000';
let failures = 0;
async function check(name, fn) {
  try { await fn(); console.log(`  PASS ${name}`); } catch (e) { failures++; console.error(`  FAIL ${name}: ${e.message}`); }
}

const calls = [];
let respond = () => new Response('{}', { status: 200 });
globalThis.fetch = async (url, init = {}) => {
  calls.push({ url: String(url), init });
  return respond(String(url), init);
};
const req = (url, { cookie, body, method = 'POST' } = {}) =>
  new NextRequest(url, { method, headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body });

const provider = await import('../src/app/api/_lib/provider.ts');

console.log('AI route tests');

await check('requireAuth rejects a missing cookie without calling the backend', async () => {
  calls.length = 0;
  await assert.rejects(() => provider.requireAuth(req('http://w/api/ai/export-image')), /未登录/);
  assert.equal(calls.length, 0);
});

await check('requireAuth rejects a forged cookie the backend does not accept', async () => {
  respond = () => new Response('{"message":"Unauthorized"}', { status: 401 });
  await assert.rejects(() => provider.requireAuth(req('http://w/x', { cookie: 'ff_token=forged' })), /未登录/);
  assert.equal(calls.at(-1).url, 'http://api.test:4000/api/v1/auth/profile');
  assert.equal(calls.at(-1).init.headers.authorization, 'Bearer forged');
});

await check('requireAuth accepts a token the backend accepts', async () => {
  respond = () => new Response('{"success":true}', { status: 200 });
  assert.equal(await provider.requireAuth(req('http://w/x', { cookie: 'ff_token=good' })), 'good');
});

for (const route of ['ai/tts/openai', 'ai/tts/azure', 'ai/tts/elevenlabs', 'ai/subtitle/generate', 'ai/generate-video', 'video/generate']) {
  await check(`${route} answers 501 without leaving the country`, async () => {
    calls.length = 0;
    const mod = await import(`../src/app/api/${route}/route.ts`);
    const res = await mod.POST(req(`http://w/api/${route}`, { cookie: 'ff_token=good', body: '{}' }));
    assert.equal(res.status, 501);
    assert.equal((await res.json()).code, 'NOT_AVAILABLE_IN_CN');
    assert.equal(calls.length, 0);
  });
}

const script = await import('../src/app/api/ai/generate-script/route.ts');

await check('generate-script forwards to the backend with the bearer token', async () => {
  calls.length = 0;
  respond = () => new Response(JSON.stringify({ success: true, data: { title: '标题', scenes: [{ visual: 'v', subtitle: 's', time: 5 }], aiLabel: '【本内容由 AI 生成】' } }), { status: 200 });
  const res = await script.POST(req('http://w/api/ai/generate-script', { cookie: 'ff_token=good', body: JSON.stringify({ topic: '咖啡' }) }));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.title, '标题');
  assert.equal(body.scenes.length, 1);
  assert.equal(calls[0].url, 'http://api.test:4000/api/v1/ai/generate/script');
  assert.equal(calls[0].init.headers.get('authorization'), 'Bearer good');
});

await check('generate-script passes the backend reason through', async () => {
  respond = () => new Response(JSON.stringify({ success: false, message: 'Tenant daily budget exceeded' }), { status: 429 });
  const res = await script.POST(req('http://w/api/ai/generate-script', { cookie: 'ff_token=good', body: '{}' }));
  assert.equal(res.status, 429);
});

await check('generate-script requires login', async () => {
  const res = await script.POST(req('http://w/api/ai/generate-script', { body: '{}' }));
  assert.equal(res.status, 401);
});

if (failures) { console.error(`${failures} failure(s)`); process.exit(1); }
