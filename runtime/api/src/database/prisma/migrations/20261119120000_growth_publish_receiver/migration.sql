-- 模板页发布接收口：只存不发。两张表都只追加，UPDATE / DELETE 由触发器拒绝。
CREATE TABLE "GrowthTemplatePageSubmission" (
    "id" TEXT NOT NULL,
    "content_sha256" TEXT NOT NULL,
    "approval_id" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "url" TEXT,
    "content_json" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'received',
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GrowthTemplatePageSubmission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GrowthTemplatePageSubmission_content_sha256_key" ON "GrowthTemplatePageSubmission"("content_sha256");

CREATE TABLE "GrowthPublishReceiveAudit" (
    "id" SERIAL NOT NULL,
    "action" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "content_sha256" TEXT,
    "submission_id" TEXT,
    "detail" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GrowthPublishReceiveAudit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GrowthPublishReceiveAudit_created_at_idx" ON "GrowthPublishReceiveAudit"("created_at");

CREATE OR REPLACE FUNCTION growth_publish_append_only() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "GrowthTemplatePageSubmission_append_only"
    BEFORE UPDATE OR DELETE ON "GrowthTemplatePageSubmission"
    FOR EACH ROW EXECUTE FUNCTION growth_publish_append_only();

CREATE TRIGGER "GrowthTemplatePageSubmission_no_truncate"
    BEFORE TRUNCATE ON "GrowthTemplatePageSubmission"
    FOR EACH STATEMENT EXECUTE FUNCTION growth_publish_append_only();

CREATE TRIGGER "GrowthPublishReceiveAudit_append_only"
    BEFORE UPDATE OR DELETE ON "GrowthPublishReceiveAudit"
    FOR EACH ROW EXECUTE FUNCTION growth_publish_append_only();

CREATE TRIGGER "GrowthPublishReceiveAudit_no_truncate"
    BEFORE TRUNCATE ON "GrowthPublishReceiveAudit"
    FOR EACH STATEMENT EXECUTE FUNCTION growth_publish_append_only();
