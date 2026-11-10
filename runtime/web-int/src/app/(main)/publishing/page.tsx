'use client';

import { RecordPage } from '@/components/workspace/RecordPage';
import { publishRows } from '@/lib/workspace-records';

export default function PublishingPage() {
  return (
    <RecordPage
      eyebrow="Publishing"
      title="Tasks waiting on a person, not an autopilot."
      lede="Each row is a publish task stored for this workspace. Approving a task still happens outside this list."
      path="/api/v1/publish/tasks?pageSize=50"
      present={publishRows}
    />
  );
}
