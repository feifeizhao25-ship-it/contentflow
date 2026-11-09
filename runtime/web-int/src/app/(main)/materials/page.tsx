'use client';

import { RecordPage } from '@/components/workspace/RecordPage';
import { materialRows } from '@/lib/workspace-records';

export default function MaterialsPage() {
  return (
    <RecordPage
      eyebrow="Files"
      title="Files already stored for this workspace."
      lede="This page lists saved files only. It does not upload a placeholder file when storage is not connected."
      path="/api/v1/materials"
      present={materialRows}
    />
  );
}
