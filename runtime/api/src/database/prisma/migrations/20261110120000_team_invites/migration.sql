-- 团队邀请。不插入成员。token 只存哈希。过期时间由应用写入。
CREATE TABLE "TeamInvite" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "email" TEXT,
    "role" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "invited_by" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "accepted_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "TeamInvite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TeamInvite_token_hash_key" ON "TeamInvite"("token_hash");
CREATE INDEX "TeamInvite_tenant_id_status_idx" ON "TeamInvite"("tenant_id", "status");

ALTER TABLE "TeamInvite" ADD CONSTRAINT "TeamInvite_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
