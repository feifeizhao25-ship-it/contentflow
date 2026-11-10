'use client';

import { RecordPage } from '@/components/workspace/RecordPage';
import { analyticsRows } from '@/lib/workspace-records';

export default function AnalyticsPage() {
  return (
    <RecordPage
      eyebrow="Analytics"
      title="What this workspace stored this week."
      lede="Counts are publish tasks and AI generations already saved. Reach and follower movement stay hidden until a platform connection can supply them."
      path="/api/v1/analytics/overview?lang=en"
      present={analyticsRows}
    />
  );
}
