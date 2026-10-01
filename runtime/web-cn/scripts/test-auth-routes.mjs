/**
 * 登录 / 注册的 Next 路由：把后端签发的令牌写进 httpOnly cookie，失败原样透传（不写 cookie）。
 *   node --import ./scripts/ts-extensionless.mjs --experimental-transform-types scripts/test-auth-routes.mjs
 *
 * 另一个要紧的点：这些路由必须把客户端地址（X-Forwarded-For）转给后端。
 * 后端按地址限流（登录 / 注册 / 发短信每分钟个位数次），转不过去就等于全站所有人共用一个额度。
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
const req = (body, headers = {}) =>
  new NextRequest('http://w/api/auth/x', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
const ok = (data, status = 200) => new Response(JSON.stringify({ success: true, data }), { status, headers: { 'content-type': 'application/json' } });
const AUTH = { user: { id: 'u1', email: '', phone: '138****5678' }, token: 'access-token', refreshToken: 'refresh-token' };

const routes = {
  login: await import('../src/app/api/auth/login/route.ts'),
  register: await import('../src/app/api/auth/register/route.ts'),
  registerPhone: await import('../src/app/api/auth/register/phone/route.ts'),
  loginSms: await import('../src/app/api/auth/login/sms/route.ts'),
};
const upstreamOf = { login: '/api/v1/auth/login', register: '/api/v1/auth/register', registerPhone: '/api/v1/auth/register/phone', loginSms: '/api/v1/auth/login/sms' };

console.log('Auth route tests');

for (const [name, route] of Object.entries(routes)) {
  await check(`${name}: 成功时写 httpOnly 的登录 cookie，响应体里没有令牌`, async () => {
    respond = () => ok(AUTH, 201);
    const res = await route.POST(req({ a: 1 }));
    assert.ok(res.status === 200 || res.status === 201);
    const cookies = res.headers.getSetCookie().join('\n');
    assert.match(cookies, /ff_token=access-token/);
    assert.match(cookies, /ff_refresh_token=refresh-token/);
    for (const line of res.headers.getSetCookie()) assert.ok(/HttpOnly/i.test(line), `cookie 必须是 httpOnly：${line.split('=')[0]}`);
    const body = await res.json();
    assert.deepEqual(body.user, AUTH.user);
    assert.ok(!JSON.stringify(body).includes('access-token'));
    assert.equal(calls.at(-1).url, `http://api.test:4000${upstreamOf[name]}`);
  });

  await check(`${name}: 后端拒绝时原样透传状态码与中文错误，不写 cookie`, async () => {
    respond = () => new Response(JSON.stringify({ success: false, error: { code: 'BAD', message: '验证码不正确' } }), { status: 400 });
    const res = await route.POST(req({}));
    assert.equal(res.status, 400);
    assert.equal(res.headers.getSetCookie().length, 0);
    assert.equal((await res.json()).error.message, '验证码不正确');
  });

  await check(`${name}: 把客户端地址转给后端（否则全站共用一个限流额度）`, async () => {
    respond = () => ok(AUTH);
    await route.POST(req({}, { 'x-forwarded-for': '203.0.113.9' }));
    assert.equal(new Headers(calls.at(-1).init.headers).get('x-forwarded-for'), '203.0.113.9');
  });

  await check(`${name}: 后端不可达时给中文提示，不抛英文异常`, async () => {
    respond = () => { throw new TypeError('fetch failed'); };
    const res = await route.POST(req({}));
    assert.equal(res.status, 502);
    const text = JSON.stringify(await res.json());
    assert.match(text, /[一-龥]/);
    assert.ok(!/fetch failed/.test(text));
  });
}

if (failures) { console.error(`${failures} failed`); process.exit(1); }
console.log('All auth route tests passed');
