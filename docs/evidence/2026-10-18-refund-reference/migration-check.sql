BEGIN;
CREATE TABLE "PaymentOrder" (order_no TEXT PRIMARY KEY, status TEXT, payment_channel_order_no TEXT);
INSERT INTO "PaymentOrder" VALUES ('paid', 'paid', 'pay-original'), ('pending', 'refund_pending', 'pay-pending'), ('legacy', 'refunded', 'refund-legacy'), ('empty', 'refunded', NULL);
-- Keep payment and refund references separate for future refunds.
ALTER TABLE "PaymentOrder" ADD COLUMN "refund_channel_order_no" TEXT;
-- The old refund completion path stored its refund reference in the payment field.
-- Preserve that legacy value; the original payment reference cannot be reconstructed here.
UPDATE "PaymentOrder"
SET "refund_channel_order_no" = "payment_channel_order_no"
WHERE "status" = 'refunded';

DO $$ BEGIN
IF (SELECT refund_channel_order_no FROM "PaymentOrder" WHERE order_no='legacy') IS DISTINCT FROM 'refund-legacy' THEN RAISE EXCEPTION 'legacy refund missing'; END IF;
IF EXISTS (SELECT 1 FROM "PaymentOrder" WHERE status <> 'refunded' AND refund_channel_order_no IS NOT NULL) THEN RAISE EXCEPTION 'non-refund polluted'; END IF;
IF (SELECT payment_channel_order_no FROM "PaymentOrder" WHERE order_no='paid') IS DISTINCT FROM 'pay-original' THEN RAISE EXCEPTION 'payment changed'; END IF;
END $$;
UPDATE "PaymentOrder" SET status='refunded', refund_channel_order_no='new-refund' WHERE order_no='pending';
DO $$ BEGIN
IF (SELECT payment_channel_order_no FROM "PaymentOrder" WHERE order_no='pending') IS DISTINCT FROM 'pay-pending' THEN RAISE EXCEPTION 'original payment overwritten'; END IF;
IF (SELECT refund_channel_order_no FROM "PaymentOrder" WHERE order_no='pending') IS DISTINCT FROM 'new-refund' THEN RAISE EXCEPTION 'new refund not saved'; END IF;
END $$;
ROLLBACK;
