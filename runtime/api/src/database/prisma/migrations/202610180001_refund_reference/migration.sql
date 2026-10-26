-- Keep payment and refund references separate for future refunds.
ALTER TABLE "PaymentOrder" ADD COLUMN "refund_channel_order_no" TEXT;
-- The old refund completion path stored its refund reference in the payment field.
-- Preserve that legacy value; the original payment reference cannot be reconstructed here.
UPDATE "PaymentOrder"
SET "refund_channel_order_no" = "payment_channel_order_no"
WHERE "status" = 'refunded';
