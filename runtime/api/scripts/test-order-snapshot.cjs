const assert = require('node:assert/strict');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  // A dedicated CI database only; never seed or clean a production tenant.
  if (!process.env.DATABASE_URL?.endsWith('/contentflow_ci')) throw new Error('Requires isolated contentflow_ci database');
  const tenant = await prisma.tenant.create({ data: { name: '迁移验收', slug: `migration-${Date.now()}` } });
  try {
    const base = { tenant_id: tenant.id, market: 'cn', plan_id: 'pro', billing_cycle: 'monthly', order_type: 'subscription', amount: 99, currency: 'CNY' };
    const snapshot = { id: 'pro', version: '2026-09-01', monthlyPostQuota: 200, priceMonthlyCny: 99 };
    const current = await prisma.paymentOrder.create({ data: { ...base, order_no: `${tenant.id}-new`, idempotency_key: 'current-order', plan_snapshot: snapshot, payment_url: 'weixin://wxpay/ci-fixture' } });
    const legacy = await prisma.paymentOrder.create({ data: { ...base, amount: 128, order_no: `${tenant.id}-old`, idempotency_key: 'legacy-order' } });
    assert.deepEqual((await prisma.paymentOrder.findUnique({ where: { id: current.id } })).plan_snapshot, snapshot);
    assert.equal((await prisma.paymentOrder.findUnique({ where: { id: current.id } })).payment_url, 'weixin://wxpay/ci-fixture');
    const storedLegacy = await prisma.paymentOrder.findUnique({ where: { id: legacy.id } });
    assert.equal(storedLegacy.plan_snapshot, null);
    assert.equal(storedLegacy.payment_url, null);
    assert.equal(Number(storedLegacy.amount), 128);
    console.log('PASS PostgreSQL migration: new snapshots and payment links round-trip; legacy amount and null fields preserved');
  } finally {
    await prisma.tenant.delete({ where: { id: tenant.id } });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
