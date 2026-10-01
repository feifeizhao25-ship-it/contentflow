/**
 * 手机号 + 短信验证码的前端库：请求路径、字段白名单、中文错误、手机号校验。
 *   node --import ./scripts/ts-extensionless.mjs --experimental-transform-types scripts/test-auth-service.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let failures = 0;
async function check(name, fn) {
  try { await fn(); console.log(`  PASS ${name}`); } catch (e) { failures++; console.error(`  FAIL ${name}: ${e.message}`); }
}
const svc = await import('../src/lib/auth-service.ts');

const seen = [];
const reply = (status, body) => async (url, init) => {
  seen.push({ url, body: init?.body ? JSON.parse(init.body) : undefined, method: init?.method });
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
};
const last = () => seen[seen.length - 1];

console.log('Auth service tests');

await check('registerWithEmail 必带 agreedToTerms，字段白名单不多不少', async () => {
  await svc.registerWithEmail({ email: 'a@b.cn', password: '123456', name: '甲', tenantName: '乙', agreedToTerms: true }, reply(200, { user: { id: 'u' } }));
  assert.equal(last().url, '/api/auth/register');
  assert.deepEqual(Object.keys(last().body).sort(), ['agreedToTerms', 'email', 'name', 'password', 'tenantName']);
  assert.equal(last().body.agreedToTerms, true);
});

await check('sendSmsCode：走后端代理，只带 phone 与 purpose，返回重发等待秒数', async () => {
  const r = await svc.sendSmsCode({ phone: '138 1234 5678', purpose: 'register' }, reply(200, { success: true, data: { expiresInSeconds: 300, resendAfterSeconds: 60 } }));
  assert.equal(last().url, '/api/v1/auth/sms/send');
  assert.deepEqual(last().body, { phone: '138 1234 5678', purpose: 'register' });
  assert.equal(r.resendAfterSeconds, 60);
});

await check('sendSmsCode：短信服务未配置（503）时把后端的中文原因抛给界面', async () => {
  const f = reply(503, { success: false, error: { code: 'SERVICE_UNAVAILABLE', message: '短信服务未配置，暂时无法发送验证码' } });
  await assert.rejects(() => svc.sendSmsCode({ phone: '13812345678', purpose: 'login' }, f), (e) => e.name === 'AuthError' && e.status === 503 && /短信服务未配置/.test(e.message));
});

await check('sendSmsCode：429 带后端的等待提示；网络断开是中文', async () => {
  await assert.rejects(() => svc.sendSmsCode({ phone: '13812345678', purpose: 'login' }, reply(429, { success: false, error: { message: '获取验证码太频繁，请 42 秒后再试' } })), /42 秒/);
  await assert.rejects(() => svc.sendSmsCode({ phone: '13812345678', purpose: 'login' }, async () => { throw new TypeError('Failed to fetch'); }), (e) => /网络连接失败/.test(e.message) && !/Failed to fetch/.test(e.message));
});

await check('后端返回校验数组 / 英文时，不把英文渲染出来，用中文兜底', async () => {
  await assert.rejects(() => svc.loginWithSms({ phone: '13812345678', code: '123456' }, reply(500, { message: 'Internal server error' })), (e) => !/Internal/.test(e.message) && /[一-龥]/.test(e.message));
});

await check('registerWithPhone：字段白名单（含 agreedToTerms），走 /api/auth/register/phone', async () => {
  const user = await svc.registerWithPhone({ phone: '13812345678', code: '123456', name: '甲', tenantName: '乙', agreedToTerms: true }, reply(201, { user: { id: 'u1', phone: '138****5678' } }));
  assert.equal(last().url, '/api/auth/register/phone');
  assert.deepEqual(Object.keys(last().body).sort(), ['agreedToTerms', 'code', 'name', 'phone', 'tenantName']);
  assert.equal(user.id, 'u1');
});

await check('registerWithPhone：响应里没有 user 时报错而不是当成功', async () => {
  await assert.rejects(() => svc.registerWithPhone({ phone: '13812345678', code: '123456', agreedToTerms: true }, reply(200, {})), /注册响应无效/);
});

await check('loginWithSms：只带 phone 与 code', async () => {
  const user = await svc.loginWithSms({ phone: '13812345678', code: '123456' }, reply(200, { user: { id: 'u2' } }));
  assert.equal(last().url, '/api/auth/login/sms');
  assert.deepEqual(Object.keys(last().body).sort(), ['code', 'phone']);
  assert.equal(user.id, 'u2');
});

await check('绑定手机号：发送与提交走后端代理', async () => {
  await svc.sendBindCode({ phone: '13812345678' }, reply(200, { success: true, data: { resendAfterSeconds: 60 } }));
  assert.equal(last().url, '/api/v1/auth/phone/bind/send');
  const r = await svc.bindPhone({ phone: '13812345678', code: '123456' }, reply(200, { success: true, data: { phone: '138****5678', phone_verified: true } }));
  assert.equal(last().url, '/api/v1/auth/phone/bind');
  assert.deepEqual(last().body, { phone: '13812345678', code: '123456' });
  assert.equal(r.phone, '138****5678');
});

await check('isValidChinaMobile：与后端同一规则', () => {
  for (const ok of ['13812345678', '19999999999', '+8613812345678', '86 138-1234-5678']) assert.equal(svc.isValidChinaMobile(ok), true, ok);
  for (const bad of ['', '12345678901', '1381234567', '138123456789', 'abc', '10086', '23812345678']) assert.equal(svc.isValidChinaMobile(bad), false, bad);
});

await check('登录页与注册页都用这个库，不再各自直接 fetch', () => {
  for (const p of ['src/app/(auth)/login/page.tsx', 'src/app/(auth)/register/page.tsx']) {
    const text = fs.readFileSync(path.join(ROOT, p), 'utf8');
    assert.match(text, /auth-service/);
    assert.ok(!/\bfetch\(/.test(text), p);
  }
});

if (failures) { console.error(`${failures} failed`); process.exit(1); }
console.log('All auth service tests passed');
