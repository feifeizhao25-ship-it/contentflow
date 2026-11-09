'use client';

import { RecordPage } from '@/components/workspace/RecordPage';
import { voiceRows } from '@/lib/workspace-records';

export default function BrandVoicePage() {
  return (
    <RecordPage
      eyebrow="Brand voice"
      title="Voices saved for this workspace."
      lede="A voice is a name and description you can reuse when drafting. Shared templates are marked separately from voices created in the workspace."
      path="/api/v1/persona"
      present={voiceRows}
    />
  );
}
