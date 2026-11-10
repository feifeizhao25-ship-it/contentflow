'use client';

import { RecordPage } from '@/components/workspace/RecordPage';
import { TeamInvites } from '@/components/team/TeamInvites';
import { teamRows } from '@/lib/workspace-records';

export default function TeamPage() {
  return (
    <>
      <RecordPage
        eyebrow="Team"
        title="People who belong to this workspace."
        lede="Roles are the ones saved on each account. An invite does not add a member until they accept."
        path="/api/v1/team/members"
        present={teamRows}
      />
      <TeamInvites />
    </>
  );
}
