'use client';

import { RecordPage } from '@/components/workspace/RecordPage';
import { calendarRows } from '@/lib/workspace-records';

export default function CalendarPage() {
  return (
    <RecordPage
      eyebrow="Calendar"
      title="Only tasks that already have a scheduled time."
      lede="Unscheduled work stays on the publishing list. This page does not suggest a posting time."
      path="/api/v1/publish/tasks?pageSize=100"
      present={calendarRows}
    />
  );
}
