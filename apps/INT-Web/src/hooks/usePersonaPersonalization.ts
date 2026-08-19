const COMPLIANCE_LABELS: Record<string, string> = {
  gdpr: 'GDPR',
  dsa: 'DSA',
  ccpa: 'CCPA',
  ftc_disclosure: 'FTC',
  coppa: 'COPPA',
  green_claims: 'Green Claims',
  brand_safety: 'Brand Safety',
        label: COMPLIANCE_LABELS[flag] || flag,
