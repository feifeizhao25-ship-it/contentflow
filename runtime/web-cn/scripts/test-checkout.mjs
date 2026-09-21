/**
 * 会员页下单：原来「申请开通」无论是否登录一律跳登录页，登录回来还是这个按钮，
 * payment-service 整个是桩——没有任何路径能付款。
 *   node --import ./scripts/ts-extensionless.mjs --experimental-strip-types scripts/test-checkout.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PaymentError,
  checkoutAction,
  createCheckoutOrder,
  isActivated,
  isAlipayReturn,
  newIdempotencyKey,
  waitForActivation,
} from '../src/lib/payment-service.ts';
import { safeRedirectTarget } from '../src/lib/safe-redirect.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let failures = 0;
async function check(name, fn) {
  try { await fn(); console.log(`  PASS ${name}`); } catch (e) { failures++; console.error(`  FAIL ${name}: ${e.message}`); }
}
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

console.log('Checkout tests');

await check('order is created by the backend with an idempotency key and no client-side amount', async () => {
  const calls = [];
  const order = await createCheckoutOrder(
    { planId: 'pro', billingCycle: 'monthly', paymentMethod: 'wechat' },
    'cf-web-12345678',
    async (url, init) => {
      calls.push({ url, init });
      return json(201, { success: true, data: { order_no: 'CF1', amount: '99', paymentUrl: 'weixin://wxpay/bizpayurl?pr=abc' } });
    },
  );
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, '/api/v1/billing/orders');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.headers['idempotency-key'], 'cf-web-12345678');
  assert.deepEqual(JSON.parse(calls[0].init.body), { planId: 'pro', billingCycle: 'monthly', paymentMethod: 'wechat' });
  assert.deepEqual(order, { orderNo: 'CF1', amount: 99, paymentMethod: 'wechat', paymentUrl: 'weixin://wxpay/bizpayurl?pr=abc' });
});

await check('backend refusal (merchant not configured) is shown as-is, not as success', async () => {
  await assert.rejects(
    createCheckoutOrder({ planId: 'pro', billingCycle: 'monthly', paymentMethod: 'alipay' }, 'k-12345678',
      async () => json(503, { success: false, message: 'alipay 商户资料尚未配置，未创建订单' })),
    (e) => e instanceof PaymentError && e.status === 503 && e.message.includes('商户资料尚未配置'),
  );
});

await check('non-manager gets an understandable reason', async () => {
  await assert.rejects(
    createCheckoutOrder({ planId: 'pro', billingCycle: 'monthly', paymentMethod: 'alipay' }, 'k-12345678',
      async () => new Response('', { status: 403 })),
    (e) => e.status === 403 && e.message.includes('所有者或管理员'),
  );
});

await check('idempotency key fits backend limits (8–128)', () => {
  const key = newIdempotencyKey();
  assert.ok(key.length >= 8 && key.length <= 128);
  assert.notEqual(key, newIdempotencyKey());
});

await check('alipay redirects only to https cashier; wechat renders weixin:// as QR', () => {
  assert.deepEqual(checkoutAction({ orderNo: 'a', amount: 1, paymentMethod: 'alipay', paymentUrl: 'https://openapi.alipay.com/gateway.do?x=1' }),
    { kind: 'redirect', url: 'https://openapi.alipay.com/gateway.do?x=1' });
  assert.throws(() => checkoutAction({ orderNo: 'a', amount: 1, paymentMethod: 'alipay', paymentUrl: 'javascript:alert(1)' }));
  assert.throws(() => checkoutAction({ orderNo: 'a', amount: 1, paymentMethod: 'alipay', paymentUrl: 'http://openapi.alipay.com/' }));
  assert.deepEqual(checkoutAction({ orderNo: 'a', amount: 1, paymentMethod: 'wechat', paymentUrl: 'weixin://wxpay/bizpayurl?pr=x' }),
    { kind: 'qrcode', value: 'weixin://wxpay/bizpayurl?pr=x' });
  assert.throws(() => checkoutAction({ orderNo: 'a', amount: 1, paymentMethod: 'wechat', paymentUrl: 'https://evil.example/' }));
  assert.deepEqual(checkoutAction({ orderNo: 'a', amount: 1, paymentMethod: 'wechat', paymentUrl: null }), { kind: 'duplicate' });
});

await check('activation = plan becomes the purchased one, or renewal date moves forward', () => {
  assert.equal(isActivated({ plan: 'free', renewalDate: null }, { plan: 'pro', renewalDate: '2026-10-21' }, 'pro'), true);
  assert.equal(isActivated({ plan: 'free', renewalDate: null }, { plan: 'free', renewalDate: null }, 'pro'), false);
  assert.equal(isActivated({ plan: 'pro', renewalDate: '2026-10-01' }, { plan: 'pro', renewalDate: '2026-10-01' }, 'pro'), false);
  assert.equal(isActivated({ plan: 'pro', renewalDate: '2026-10-01' }, { plan: 'pro', renewalDate: '2026-11-01' }, 'pro'), true);
});

await check('polling stops when the backend reports the plan', async () => {
  let n = 0;
  const ok = await waitForActivation({ plan: 'free', renewalDate: null }, 'pro', {
    sleep: async () => {},
    fetchImpl: async () => { n++; return json(200, { data: { plan: n >= 3 ? 'pro' : 'free', renewalDate: null } }); },
  });
  assert.equal(ok, true);
  assert.equal(n, 3);
});

await check('polling times out instead of claiming success', async () => {
  let t = 0;
  const ok = await waitForActivation({ plan: 'free', renewalDate: null }, 'pro', {
    timeoutMs: 10, intervalMs: 5, now: () => t, sleep: async (ms) => { t += ms; },
    fetchImpl: async () => json(200, { data: { plan: 'free' } }),
  });
  assert.equal(ok, false);
});

await check('polling survives network errors but surfaces an expired login', async () => {
  let n = 0;
  const ok = await waitForActivation({ plan: 'free', renewalDate: null }, 'pro', {
    sleep: async () => {},
    fetchImpl: async () => { n++; if (n === 1) throw new TypeError('network'); return json(n === 2 ? 502 : 200, { data: { plan: 'pro' } }); },
  });
  assert.equal(ok, true);
  await assert.rejects(waitForActivation({ plan: 'free', renewalDate: null }, 'pro', {
    sleep: async () => {}, fetchImpl: async () => json(401, {}),
  }), (e) => e.status === 401);
});

await check('alipay synchronous return is recognised', () => {
  const p = new URLSearchParams('out_trade_no=CF1&method=alipay.trade.page.pay.return&sign=x');
  assert.equal(isAlipayReturn(p), true);
  assert.equal(isAlipayReturn(new URLSearchParams('plan=pro')), false);
});

await check('pricing page creates orders instead of always sending users to login', () => {
  const page = fs.readFileSync(path.join(ROOT, 'src/app/(main)/pricing/page.tsx'), 'utf8');
  assert.match(page, /createCheckoutOrder\(/);
  assert.match(page, /fetchCurrentUser\(\)/);
  assert.match(page, /<QRCode/);
  const handler = page.slice(page.indexOf('const handlePurchase'), page.indexOf('const confirmPayment'));
  assert.match(handler, /if \(!user\)/, 'login redirect must only happen for signed-out users');
  assert.doesNotMatch(page, /amount\s*:\s*(plan|checkoutPlan)/, 'client must not send an amount');
});

await check('ALIPAY_RETURN_URL example path exists and forwards to pricing', () => {
  const file = path.join(ROOT, 'src/app/payment/result/page.tsx');
  assert.ok(fs.existsSync(file));
  assert.match(fs.readFileSync(file, 'utf8'), /redirect\(query \? `\/pricing\?\$\{query\}`/);
});

await check('login returns to the page that sent the user there (pricing checkout resumes)', () => {
  assert.equal(safeRedirectTarget('/pricing?plan=pro'), '/pricing?plan=pro');
  assert.equal(safeRedirectTarget('/accounts'), '/accounts');
  assert.equal(safeRedirectTarget(null), '/overview');
  for (const bad of ['//evil.com/x', '/\\evil.com', 'https://evil.com', 'javascript:alert(1)', '/login?redirect=/x', '/\tfoo']) {
    assert.equal(safeRedirectTarget(bad), '/overview', bad);
  }
  const login = fs.readFileSync(path.join(ROOT, 'src/app/(auth)/login/page.tsx'), 'utf8');
  assert.match(login, /safeRedirectTarget\(new URLSearchParams\(window\.location\.search\)\.get\('redirect'\)\)/);
  assert.doesNotMatch(login, /router\.push\('\/overview'\)/);
});

if (failures) { console.error(`${failures} failed`); process.exit(1); }
console.log('All checkout tests passed');
