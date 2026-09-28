/* Real PostgreSQL acceptance. Refuse databases other than isolated local CI. */
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const url = new URL(process.env.DATABASE_URL || 'http://unconfigured');
if (!['localhost', '127.0.0.1'].includes(url.hostname) || url.pathname !== '/contentflow_ci') {
  throw new Error('Billing race tests require the isolated local contentflow_ci database');
}
const { PrismaClient } = require('@prisma/client');
const { BillingService } = require('../dist/modules/billing/billing.service');
const { CN_PLANS } = require('../dist/modules/billing/plans.constant');
const prisma = new PrismaClient();
const service = new BillingService(prisma);
const tenants = [];
const orders = [];

async function scenario(kind) {
  const suffix = randomUUID();
  const tenant = await prisma.tenant.create({ data: { name: 'CI billing race', slug: `billing-race-${suffix}` } });
  tenants.push(tenant.id);
  const order = await prisma.paymentOrder.create({ data: {
    tenant_id: tenant.id, order_no: `race-${suffix}`, idempotency_key: suffix,
    plan_id: 'pro', plan_snapshot: CN_PLANS[1], billing_cycle: 'monthly',
    order_type: 'subscription', amount: 99, currency: 'CNY', payment_method: 'alipay',
  } });
  orders.push(order.order_no);
  const input = { orderNo: order.order_no, provider: 'alipay', providerEventId: `${suffix}-first`, providerOrderNo: suffix, paidAmount: 99, payloadHash: 'ci-fixture', signatureValid: true };
  const results = await Promise.allSettled([
    service.markPaid(input),
    kind === 'close' ? service.closePendingOrder(tenant.id, order.order_no)
      : service.markPaid({ ...input, providerEventId: `${suffix}-second` }),
  ]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  const loser = results.find(result => result.status === 'rejected');
  assert.equal(loser.reason.getStatus(), 409);
  const final = await prisma.paymentOrder.findUniqueOrThrow({ where: { order_no: order.order_no } });
  const subscription = await prisma.subscription.findUnique({ where: { tenant_id: tenant.id } });
  const events = await prisma.paymentWebhookEvent.count({ where: { order_no: order.order_no } });
  const finalTenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenant.id } });
  if (final.status === 'paid') {
    assert.equal(subscription.status, 'active');
    assert.equal(final.subscription_id, subscription.id);
    assert.equal(finalTenant.plan, 'pro');
    assert.equal(events, 1);
  } else {
    assert.equal(kind, 'close');
    assert.equal(final.status, 'closed');
    assert.equal(subscription, null);
    assert.equal(finalTenant.plan, 'free');
    assert.equal(events, 0);
  }
}

async function crossOrderScenario(kind) {
  const suffix = randomUUID();
  const tenant = await prisma.tenant.create({ data: { name: 'CI cross-order race', slug: `cross-order-${suffix}` } });
  tenants.push(tenant.id);
  async function order(label) {
    const created = await prisma.paymentOrder.create({ data: {
      tenant_id: tenant.id, order_no: `${label}-${suffix}`, idempotency_key: `${label}-${suffix}`,
      plan_id: 'pro', plan_snapshot: CN_PLANS[1], billing_cycle: 'monthly',
      order_type: 'subscription', amount: 99, currency: 'CNY', payment_method: 'alipay',
    } });
    orders.push(created.order_no);
    return created;
  }
  const pay = row => service.markPaid({ orderNo: row.order_no, provider: 'alipay', providerEventId: row.order_no,
    providerOrderNo: row.order_no, paidAmount: 99, payloadHash: 'ci-fixture', signatureValid: true });
  const seed = await order('seed');
  await pay(seed);
  if (kind === 'renewals') {
    const baseline = new Date('2030-01-15T00:00:00Z');
    await prisma.subscription.update({ where: { tenant_id: tenant.id }, data: { current_period_end: baseline } });
    await prisma.tenant.update({ where: { id: tenant.id }, data: { plan_expires_at: baseline } });
    const first = await order('renewal-a');
    const second = await order('renewal-b');
    await Promise.all([pay(first), pay(second)]);
    const subscription = await prisma.subscription.findUniqueOrThrow({ where: { tenant_id: tenant.id } });
    const finalTenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenant.id } });
    assert.equal(subscription.current_period_end.toISOString(), '2030-03-15T00:00:00.000Z');
    assert.equal(finalTenant.plan_expires_at.toISOString(), subscription.current_period_end.toISOString());
    assert.equal(await prisma.paymentOrder.count({ where: { tenant_id: tenant.id, status: 'paid' } }), 3);
  } else {
    await service.requestRefund(tenant.id, seed.order_no);
    const next = await order('new-payment');
    const [refund, payment] = await Promise.allSettled([
      service.markRefunded(seed.order_no, `refund-${suffix}`), pay(next),
    ]);
    assert.equal(payment.status, 'fulfilled');
    if (refund.status === 'rejected') assert.equal(refund.reason.getStatus(), 409);
    const subscription = await prisma.subscription.findUniqueOrThrow({ where: { tenant_id: tenant.id } });
    const finalTenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenant.id } });
    assert.equal(subscription.status, 'active');
    assert.equal(finalTenant.plan, 'pro');
    assert.equal(finalTenant.plan_expires_at.toISOString(), subscription.current_period_end.toISOString());
    const refundedOrder = await prisma.paymentOrder.findUniqueOrThrow({ where: { order_no: seed.order_no } });
    assert.equal(refundedOrder.status, refund.status === 'fulfilled' ? 'refunded' : 'refund_pending');
    assert.equal((await prisma.paymentOrder.findUniqueOrThrow({ where: { order_no: next.order_no } })).status, 'paid');
  }
}

async function checkoutScenario() {
  const suffix = randomUUID();
  const tenant = await prisma.tenant.create({ data: { name: 'CI checkout race', slug: `checkout-${suffix}` } });
  tenants.push(tenant.id);
  const oldName = process.env.BANK_TRANSFER_ACCOUNT_NAME;
  const oldAccount = process.env.BANK_TRANSFER_ACCOUNT_NO;
  process.env.BANK_TRANSFER_ACCOUNT_NAME = 'CI isolated fixture';
  process.env.BANK_TRANSFER_ACCOUNT_NO = 'ci-not-a-real-account';
  try {
    const request = { planId: 'pro', billingCycle: 'monthly', paymentMethod: 'bank_transfer' };
    const results = await Promise.all(Array.from({ length: 5 }, () => service.createOrder(tenant.id, request, suffix)));
    orders.push(results[0].order_no);
    assert.equal(new Set(results.map(result => result.order_no)).size, 1);
    assert.equal(await prisma.paymentOrder.count({ where: { tenant_id: tenant.id } }), 1);
    assert.equal(results[0].status, 'pending');
    await assert.rejects(service.createOrder(tenant.id, { ...request, planId: 'team' }, suffix), error => error.getStatus() === 409);
  } finally {
    if (oldName === undefined) delete process.env.BANK_TRANSFER_ACCOUNT_NAME; else process.env.BANK_TRANSFER_ACCOUNT_NAME = oldName;
    if (oldAccount === undefined) delete process.env.BANK_TRANSFER_ACCOUNT_NO; else process.env.BANK_TRANSFER_ACCOUNT_NO = oldAccount;
  }
}

(async () => {
  try {
    for (let repeat = 0; repeat < 3; repeat++) {
      await scenario('close');
      await scenario('duplicate-payment');
      await crossOrderScenario('renewals');
      await crossOrderScenario('refund-payment');
      await checkoutScenario();
    }
    console.log('PostgreSQL billing races: 15 scenarios passed; order, entitlement and event checked');
  } finally {
    await prisma.paymentWebhookEvent.deleteMany({ where: { order_no: { in: orders } } });
    await prisma.paymentOrder.deleteMany({ where: { order_no: { in: orders } } });
    await prisma.subscription.deleteMany({ where: { tenant_id: { in: tenants } } });
    await prisma.tenant.deleteMany({ where: { id: { in: tenants } } });
    await prisma.$disconnect();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
