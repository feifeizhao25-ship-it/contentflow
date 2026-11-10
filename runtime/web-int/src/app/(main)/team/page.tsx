'use client';

import { RecordPage } from '@/components/workspace/RecordPage';
import { teamRows } from '@/lib/workspace-records';

export default function TeamPage() {
  return (
    <RecordPage
      eyebrow="Team"
      title="People who belong to this workspace."
      lede="Roles are the ones saved on each account. Inviting someone is a separate action and is not implied by an empty list."
      path="/api/v1/team/members"
      present={teamRows}
    />
  );
}
