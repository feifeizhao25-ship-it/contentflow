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

(async () => {
  try {
    for (let repeat = 0; repeat < 3; repeat++) {
      await scenario('close');
      await scenario('duplicate-payment');
    }
    console.log('PostgreSQL billing races: 6 scenarios passed; order, entitlement and event checked');
  } finally {
    await prisma.paymentWebhookEvent.deleteMany({ where: { order_no: { in: orders } } });
    await prisma.paymentOrder.deleteMany({ where: { order_no: { in: orders } } });
    await prisma.subscription.deleteMany({ where: { tenant_id: { in: tenants } } });
    await prisma.tenant.deleteMany({ where: { id: { in: tenants } } });
    await prisma.$disconnect();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
