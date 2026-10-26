-- 流量漏斗、自改进审计、GEO 观测。外部集成默认不写入这些表。
CREATE TABLE "GrowthEvent" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "user_id" TEXT,
    "visitor_id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "utm_source" TEXT,
    "utm_medium" TEXT,
    "utm_campaign" TEXT,
    "utm_content" TEXT,
    "utm_term" TEXT,
    "page_type" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GrowthEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GrowthEvent_tenant_id_event_idx" ON "GrowthEvent"("tenant_id", "event");
CREATE INDEX "GrowthEvent_visitor_id_idx" ON "GrowthEvent"("visitor_id");

CREATE TABLE "GrowthAuditEntry" (
    "id" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "detail" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GrowthAuditEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GrowthAuditEntry_sequence_key" ON "GrowthAuditEntry"("sequence");

CREATE TABLE "GeoCitationObservation" (
    "id" TEXT NOT NULL,
    "week" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "surface" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "cited" BOOLEAN NOT NULL,
    "url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeoCitationObservation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GeoCitationObservation_week_platform_surface_idx" ON "GeoCitationObservation"("week", "platform", "surface");
