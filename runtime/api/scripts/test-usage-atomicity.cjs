// Run only against a disposable database, with DATABASE_URL explicitly provided.
require('ts-node/register');
require('reflect-metadata');
const assert = require('node:assert/strict');
const { PrismaClient } = require('@prisma/client');
const { UsageService, ResourceType } = require('../src/modules/system/usage.service');
if (!process.env.DATABASE_URL || !new URL(process.env.DATABASE_URL).pathname.includes('usage_atomicity_test')) {
  throw new Error('Requires a disposable usage_atomicity_test database');
}
const prisma = new PrismaClient();
(async () => {
  try {
    await prisma.$executeRawUnsafe('CREATE TABLE usage_meters (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, period TEXT NOT NULL, ai_tokens INTEGER NOT NULL DEFAULT 0, image_count INTEGER NOT NULL DEFAULT 0, video_count INTEGER NOT NULL DEFAULT 0, publish_count INTEGER NOT NULL DEFAULT 0, storage_mb INTEGER NOT NULL DEFAULT 0, created_at TIMESTAMP NOT NULL DEFAULT NOW(), updated_at TIMESTAMP NOT NULL, UNIQUE (tenant_id, period))');
    await prisma.$executeRawUnsafe('CREATE TABLE cost_ledger (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, source TEXT NOT NULL, tokens_used INTEGER NOT NULL DEFAULT 0, cost_est_usd DOUBLE PRECISION NOT NULL DEFAULT 0, ref_id TEXT, created_at TIMESTAMP NOT NULL DEFAULT NOW(), CHECK (ref_id IS DISTINCT FROM \'force-failure\'))');
    const service = new UsageService(prisma);
    await service.trackUsage('existing', ResourceType.TOKENS, 100);
    await assert.rejects(service.trackUsage('existing', ResourceType.TOKENS, 50, { refId: 'force-failure' }));
    assert.equal((await prisma.usageMeter.findFirst({where:{tenant_id:'existing'}})).ai_tokens, 100);
    assert.equal(await prisma.costLedger.count({where:{tenant_id:'existing'}}), 1);
    await assert.rejects(service.trackUsage('new-failure', ResourceType.TOKENS, 50, {refId:'force-failure'}));
    assert.equal(await prisma.usageMeter.count({where:{tenant_id:'new-failure'}}), 0);
    await Promise.all(Array.from({length:12}, () => service.trackUsage('concurrent', ResourceType.TOKENS, 10)));
    assert.equal(await prisma.usageMeter.count({where:{tenant_id:'concurrent'}}), 1);
    assert.equal((await prisma.usageMeter.findFirst({where:{tenant_id:'concurrent'}})).ai_tokens, 120);
    assert.equal(await prisma.costLedger.count({where:{tenant_id:'concurrent'}}), 12);
    await service.trackUsageBatch('image', { image_count: 1, ai_tokens: 2500 });
    await assert.rejects(service.trackUsageBatch('image', { image_count: 1, ai_tokens: 2500 }, { refId: 'force-failure' }));
    const imageMeter = await prisma.usageMeter.findFirst({where:{tenant_id:'image'}});
    assert.equal(imageMeter.image_count, 1);
    assert.equal(imageMeter.ai_tokens, 2500);
    assert.equal(await prisma.costLedger.count({where:{tenant_id:'image'}}), 1);
    await assert.rejects(service.trackUsageBatch('new-image', { image_count: 1, ai_tokens: 2500 }, { refId: 'force-failure' }));
    assert.equal(await prisma.usageMeter.count({where:{tenant_id:'new-image'}}), 0);
    await Promise.all(Array.from({length:12}, () => service.trackUsageBatch('image-parallel', { image_count: 1, ai_tokens: 2500 })));
    const parallelImage = await prisma.usageMeter.findFirst({where:{tenant_id:'image-parallel'}});
    assert.equal(parallelImage.image_count, 12);
    assert.equal(parallelImage.ai_tokens, 30000);
    assert.equal(await prisma.costLedger.count({where:{tenant_id:'image-parallel'}}), 12);
    console.log('PASS: image and token batch success, existing/new rollback, 12 concurrent image batches.');
    console.log('PASS: existing meter rollback, new meter rollback, 12 concurrent first writes (no lost usage). Not a quota reservation test.');
  } finally { await prisma.$disconnect(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
