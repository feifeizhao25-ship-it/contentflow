-- AI 额度预占：调用模型前在月表上占住令牌，多实例靠同一行的条件更新互斥。
ALTER TABLE "usage_meters" ADD COLUMN "ai_tokens_reserved" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "ai_quota_reservations" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "hold_tokens" INTEGER NOT NULL,
    "committed_tokens" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "generation_id" TEXT,
    "settlement" JSONB,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_quota_reservations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ai_quota_reservations_tenant_id_idempotency_key_key" ON "ai_quota_reservations"("tenant_id", "idempotency_key");
CREATE INDEX "ai_quota_reservations_status_expires_at_idx" ON "ai_quota_reservations"("status", "expires_at");
