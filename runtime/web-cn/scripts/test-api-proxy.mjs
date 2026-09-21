/**
 * 浏览器 → NestJS 代理回归测试。
 *   node --experimental-strip-types scripts/test-api-proxy.mjs
 *
 * 1. next.config.mjs 不得再有 `/api/v1/:path*` 的 rewrite —— 它先于
 *    src/app/api/v1/[...path]/route.ts 生效，请求不带 Authorization 直达后端，
 *    所有需要登录的接口一律 401。
 * 2. 代理：有 cookie 补 Bearer；没有 cookie 也转发（支付通知、公开套餐）；
 *    支付签名头、幂等键、X-Forwarded-For 原样转发；不转发 cookie 与伪造的内部头。
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildUpstreamHeaders } from '../src/lib/api-proxy.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let failures = 0;
function check(name, fn) {
  try { fn(); console.log(`  PASS ${name}`); } catch (e) { failures++; console.error(`  FAIL ${name}: ${e.message}`); }
}

function fakeRequest(headers, cookies = {}) {
  const h = new Headers(headers);
  return { headers: h, cookies: { get: (n) => (n in cookies ? { value: cookies[n] } : undefined) } };
}

console.log('API proxy tests');

check('next.config.mjs has no /api/v1 rewrite shadowing the proxy route', () => {
  const src = fs.readFileSync(path.join(ROOT, 'next.config.mjs'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.ok(!/source:\s*['"`]\/api\/v1/.test(src), 'found a rewrite for /api/v1');
});

check('the proxy route exists and uses the shared header builder', () => {
  const route = fs.readFileSync(path.join(ROOT, 'src/app/api/v1/[...path]/route.ts'), 'utf8');
  assert.match(route, /buildUpstreamHeaders\(request\)/);
  assert.ok(!/status:\s*401/.test(route), 'proxy must not reject requests without a cookie');
});

check('cookie becomes a Bearer token', () => {
  const h = buildUpstreamHeaders(fakeRequest({ 'content-type': 'application/json' }, { ff_token: 'jwt-abc' }));
  assert.equal(h.get('authorization'), 'Bearer jwt-abc');
  assert.equal(h.get('content-type'), 'application/json');
});

check('requests without a cookie are forwarded without Authorization', () => {
  const h = buildUpstreamHeaders(fakeRequest({ 'content-type': 'application/x-www-form-urlencoded' }));
  assert.equal(h.get('authorization'), null);
});

check('payment signature headers, idempotency key and client address are forwarded', () => {
  const h = buildUpstreamHeaders(fakeRequest({
    'wechatpay-timestamp': '1', 'wechatpay-nonce': 'n', 'wechatpay-signature': 's', 'wechatpay-serial': 'x',
    'x-payment-timestamp': '2', 'x-payment-signature': 'ab', 'idempotency-key': 'order-12345678',
    'x-forwarded-for': '203.0.113.7',
  }));
  for (const name of ['wechatpay-timestamp', 'wechatpay-nonce', 'wechatpay-signature', 'wechatpay-serial',
    'x-payment-timestamp', 'x-payment-signature', 'idempotency-key', 'x-forwarded-for']) {
    assert.ok(h.get(name), `${name} missing`);
  }
});

check('raw cookies and client-supplied Authorization are not forwarded', () => {
  const h = buildUpstreamHeaders(fakeRequest({ cookie: 'ff_token=a; other=b', authorization: 'Bearer forged', 'x-internal-secret': 'x' }));
  assert.equal(h.get('cookie'), null);
  assert.equal(h.get('authorization'), null);
  assert.equal(h.get('x-internal-secret'), null);
});

if (failures) { console.error(`${failures} failure(s)`); process.exit(1); }
