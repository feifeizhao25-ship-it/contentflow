'use client';

import { RecordPage } from '@/components/workspace/RecordPage';
import { accountRows } from '@/lib/workspace-records';

export default function AccountsPage() {
  return (
    <RecordPage
      eyebrow="Accounts"
      title="Platforms connected to this workspace."
      lede="The platform id is the value stored on the account. Connecting a new platform still requires that platform's own authorization."
      path="/api/v1/accounts"
      present={accountRows}
    />
  );
}
