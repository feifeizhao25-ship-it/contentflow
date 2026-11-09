'use client';

import { RecordPage } from '@/components/workspace/RecordPage';
import { developerRows } from '@/lib/workspace-records';

export default function DevelopersPage() {
  return (
    <RecordPage
      eyebrow="Developers"
      title="API keys stored for this workspace."
      lede="The secret is shown only at the moment a key is created. This list never displays it."
      path="/api/v1/developer/keys"
      present={developerRows}
    />
  );
}
