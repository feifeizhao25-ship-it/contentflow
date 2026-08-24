ALTER TABLE "PaymentOrder"
  ADD COLUMN "idempotency_key" TEXT,
  ADD COLUMN "market" TEXT NOT NULL DEFAULT 'cn',
  ADD COLUMN "plan_id" TEXT,
  ADD COLUMN "billing_cycle" TEXT;

UPDATE "PaymentOrder"
SET "idempotency_key" = "order_no",
    "plan_id" = COALESCE(NULLIF("product_name", ''), 'legacy'),
    "billing_cycle" = 'legacy'
WHERE "idempotency_key" IS NULL;

ALTER TABLE "PaymentOrder"
  ALTER COLUMN "idempotency_key" SET NOT NULL,
  ALTER COLUMN "plan_id" SET NOT NULL,
  ALTER COLUMN "billing_cycle" SET NOT NULL;

CREATE UNIQUE INDEX "PaymentOrder_tenant_id_idempotency_key_key"
  ON "PaymentOrder"("tenant_id", "idempotency_key");

CREATE TABLE "PaymentWebhookEvent" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "provider_event_id" TEXT NOT NULL,
  "order_no" TEXT,
  "signature_valid" BOOLEAN NOT NULL,
  "payload_hash" TEXT NOT NULL,
  "processed_at" TIMESTAMP(3),
  "processing_error" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaymentWebhookEvent_provider_provider_event_id_key"
  ON "PaymentWebhookEvent"("provider", "provider_event_id");
CREATE INDEX "PaymentWebhookEvent_order_no_idx" ON "PaymentWebhookEvent"("order_no");
CREATE INDEX "PaymentWebhookEvent_created_at_idx" ON "PaymentWebhookEvent"("created_at");
