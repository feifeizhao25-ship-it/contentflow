'use client';

import { RecordPage } from '@/components/workspace/RecordPage';
import { profileRows } from '@/lib/workspace-records';

export default function SettingsPage() {
  return (
    <RecordPage
      eyebrow="Account"
      title="The profile stored for the signed-in person."
      lede="Name, email, and role come from your account record. This page does not edit another member."
      path="/api/v1/users/me"
      present={profileRows}
    />
  );
}
