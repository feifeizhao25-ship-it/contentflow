-- 合规规则补上版本、人工签署人、正例和反例。
-- reviewer 不设默认值，保持 NULL。本迁移不插入任何签署人，也不把规则标成已发布。
CREATE TABLE "compliance_rules" (
    "id" TEXT NOT NULL,
    "rule_id" TEXT NOT NULL,
    "market" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "reviewer" TEXT,
    "example" TEXT,
    "counter_example" TEXT,
    "body" TEXT NOT NULL DEFAULT '',
    "published" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compliance_rules_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "compliance_rules_market_rule_id_key" ON "compliance_rules"("market", "rule_id");
