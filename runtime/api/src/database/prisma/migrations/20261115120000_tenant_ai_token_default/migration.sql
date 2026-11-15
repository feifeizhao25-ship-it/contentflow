-- UsageService / 额度闸读的是 max_ai_tokens_monthly（schema 与免费档都是 50000）。
-- 初始化迁移的列默认值仍是 max_ai_calls_monthly: 20，新行若走数据库默认值就对不上。
-- 不改已有行，也不改额度数字。其余语句是 prisma migrate diff 相对 schema.prisma 的剩余差异：
-- @updatedAt 没有数据库默认值；Webhook 外键补上 Prisma 默认的 ON UPDATE CASCADE。
ALTER TABLE "Tenant" ALTER COLUMN "limits" SET DEFAULT '{"max_accounts": 2, "max_members": 1, "max_publishes_monthly": 30, "max_ai_tokens_monthly": 50000, "max_storage_gb": 1}';

ALTER TABLE "WebhookSubscription" DROP CONSTRAINT "WebhookSubscription_tenant_id_fkey";

ALTER TABLE "WebhookSubscription" ALTER COLUMN "updated_at" DROP DEFAULT;

ALTER TABLE "compliance_rules" ALTER COLUMN "updated_at" DROP DEFAULT;

ALTER TABLE "WebhookSubscription" ADD CONSTRAINT "WebhookSubscription_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
