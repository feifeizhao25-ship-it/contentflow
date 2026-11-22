'use client';

import { RecordPage } from '@/components/workspace/RecordPage';
import { signalRows } from '@/lib/workspace-records';

export default function DataNetworkPage() {
  return (
    <RecordPage
      eyebrow="Evidence network"
      title="Signals from your stored records."
      lede="Counts of what this workspace generated and published. Engagement numbers appear only once a platform connection can supply them."
      path="/api/v1/analytics/overview?lang=en"
      present={signalRows}
    />
  );
}
