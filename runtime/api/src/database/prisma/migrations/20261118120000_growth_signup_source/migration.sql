-- 注册来源题「从哪知道我们」：只存枚举代码，挂在 signup 漏斗事件上，随事件级联删除。不含任何身份列。
CREATE TABLE "GrowthSignupSource" (
    "event_id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GrowthSignupSource_pkey" PRIMARY KEY ("event_id")
);

CREATE INDEX "GrowthSignupSource_source_idx" ON "GrowthSignupSource"("source");

ALTER TABLE "GrowthSignupSource" ADD CONSTRAINT "GrowthSignupSource_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "GrowthEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
