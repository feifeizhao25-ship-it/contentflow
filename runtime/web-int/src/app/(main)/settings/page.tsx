'use client';

import { PlanPanel } from '@/components/billing/PlanPanel';
import { RecordPage } from '@/components/workspace/RecordPage';
import { profileRows } from '@/lib/workspace-records';

export default function SettingsPage() {
  return (
    <>
      <RecordPage
        eyebrow="Account"
        title="The profile stored for the signed-in person."
        lede="Name, email, and role come from your account record. Plan, usage and renewal are in the plan section."
        path="/api/v1/users/me"
        present={profileRows}
      />
      <PlanPanel />
    </>
  );
}
