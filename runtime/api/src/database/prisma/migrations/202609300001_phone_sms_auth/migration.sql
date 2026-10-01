-- 手机号 + 短信验证码注册/登录
ALTER TABLE "User" ADD COLUMN "real_name_verified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "consent_version" TEXT;
ALTER TABLE "User" ADD COLUMN "consent_at" TIMESTAMP(3);

-- 同一个手机号在同一时刻只能属于一个在职账号（注销后手机号已清空，不占用）
-- Prisma 无法表达部分唯一索引，因此只写在迁移里。
CREATE UNIQUE INDEX "User_phone_active_key" ON "User"("phone") WHERE "phone" IS NOT NULL AND "status" = 'active';

CREATE TABLE "SmsVerificationCode" (
    "id" TEXT NOT NULL,
    "phone_hash" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "request_ip_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SmsVerificationCode_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SmsVerificationCode_phone_hash_purpose_created_at_idx" ON "SmsVerificationCode"("phone_hash", "purpose", "created_at");
CREATE INDEX "SmsVerificationCode_request_ip_hash_created_at_idx" ON "SmsVerificationCode"("request_ip_hash", "created_at");
CREATE INDEX "SmsVerificationCode_expires_at_idx" ON "SmsVerificationCode"("expires_at");
