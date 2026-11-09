'use client';

import { RecordPage } from '@/components/workspace/RecordPage';
import { contentRows } from '@/lib/workspace-records';

export default function LibraryPage() {
  return (
    <RecordPage
      eyebrow="Library"
      title="Drafts your workspace has actually saved."
      lede="Review status comes from the content records in this workspace. Generating a draft on the create page does not add a row until it is saved."
      path="/api/v1/contents?pageSize=50"
      present={contentRows}
    />
  );
}
