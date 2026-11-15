/**
 * 国内版 AI 端点：
 *  - requireAuth 向后端校验令牌，而不是只看 cookie 在不在；
 *  - 语音合成、字幕、视频生成返回 501 NOT_AVAILABLE_IN_CN，不向境外发请求；
 *  - 分镜脚本转给后端并保持 { title, scenes } 形状。
 *   node --import ./scripts/ts-extensionless.mjs --experimental-transform-types scripts/test-ai-routes.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
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

const quotaMessage = (fs.readFileSync(new URL('../../api/src/modules/system/usage.service.ts', import.meta.url), 'utf8').match(/AI_MONTHLY_QUOTA_MESSAGE = '([^']+)'/) || [])[1];
const providerSrc = fs.readFileSync(new URL('../src/app/api/_lib/provider.ts', import.meta.url), 'utf8');
await check('web export quota message matches the backend contract', async () => {
  assert.ok(quotaMessage);
  assert.ok(providerSrc.includes(quotaMessage));
});

await check('generate-script forwards the quota envelope and code', async () => {
  respond = () => new Response(JSON.stringify({
    success: false,
    error: { code: 'AI_MONTHLY_QUOTA', message: quotaMessage, timestamp: '2026-11-15T00:00:00.000Z', path: '/api/v1/ai/generate/script' },
  }), { status: 429 });
  const res = await script.POST(req('http://w/api/ai/generate-script', { cookie: 'ff_token=good', body: JSON.stringify({ topic: '咖啡' }) }));
  assert.equal(res.status, 429);
  const body = await res.json();
  assert.equal(body.success, false);
  assert.equal(body.error.code, 'AI_MONTHLY_QUOTA');
  assert.equal(body.error.message, quotaMessage);
});

function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  typeBuf.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(zlib.crc32(Buffer.concat([typeBuf, data])) >>> 0, 8 + data.length);
  return chunk;
}
function makeMinimalPng() {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(1, 0);
  ihdr.writeUInt32BE(1, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(Buffer.alloc(4))),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}
const imageUrl = 'https://dashscope-result-bj.oss-cn-beijing.aliyuncs.com/a.png';
const exportImage = await import('../src/app/api/ai/export-image/route.ts');

function subscription(remaining, unlimited = false) {
  return new Response(JSON.stringify({ success: true, data: { aiTokens: { remaining, unlimited } } }), { status: 200, headers: { 'content-type': 'application/json' } });
}
function routeExport(remaining, unlimited = false) {
  calls.length = 0;
  respond = (url) => {
    const href = String(url);
    if (href.includes('/auth/profile')) return new Response('{"success":true}', { status: 200 });
    if (href.includes('/billing/subscription')) return subscription(remaining, unlimited);
    return new Response(makeMinimalPng(), { status: 200, headers: { 'content-type': 'image/png' } });
  };
  return exportImage.GET(req(`http://w/api/ai/export-image?url=${encodeURIComponent(imageUrl)}`, { cookie: 'ff_token=good', method: 'GET' }));
}

await check('export-image free under quota is allowed and does not post anywhere', async () => {
  const res = await routeExport(100);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'image/png');
  assert.ok(calls.some((call) => String(call.url).includes('aliyuncs.com')));
  assert.ok(calls.every((call) => !call.init.method || call.init.method === 'GET'));
});

await check('export-image free over quota uses the uniform error and does not fetch the image', async () => {
  const res = await routeExport(0);
  assert.equal(res.status, 429);
  const body = await res.json();
  assert.equal(body.success, false);
  assert.equal(body.error.code, 'AI_MONTHLY_QUOTA');
  assert.equal(body.error.message, quotaMessage);
  assert.equal(calls.some((call) => String(call.url).includes('aliyuncs.com')), false);
});

await check('export-image paid above the free remainder is allowed', async () => {
  const res = await routeExport(2_500_000);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'image/png');
});

if (failures) { console.error(`${failures} failure(s)`); process.exit(1); }
