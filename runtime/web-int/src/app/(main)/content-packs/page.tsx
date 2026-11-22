'use client';

import { RecordPage } from '@/components/workspace/RecordPage';
import { packRows } from '@/lib/workspace-records';

export default function ContentPacksPage() {
  return (
    <RecordPage
      eyebrow="Campaign library"
      title="Content packs."
      lede="A pack keeps titles, a script and channel variants together. This page shows only what this workspace stored."
      path="/api/v1/analytics/overview?lang=en"
      present={packRows}
    />
  );
}
