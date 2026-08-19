export const PLATFORM_LABELS: Record<string, { zh: string; en: string }> = {
  tiktok: { zh: 'TikTok', en: 'TikTok' },
  instagram: { zh: 'Instagram', en: 'Instagram' },
  youtube: { zh: 'YouTube', en: 'YouTube' },
  x: { zh: 'X', en: 'X' },
  twitter: { zh: 'X', en: 'X' },
  linkedin: { zh: 'LinkedIn', en: 'LinkedIn' },
  reddit: { zh: 'Reddit', en: 'Reddit' },
  facebook: { zh: 'Facebook', en: 'Facebook' },
  threads: { zh: 'Threads', en: 'Threads' },
  pinterest: { zh: 'Pinterest', en: 'Pinterest' },
};

const INT_ORDER = [
  'tiktok',
  'instagram',
  'youtube',
  'x',
  'twitter',
  'linkedin',
  'reddit',
  'facebook',
  'threads',
  'pinterest',
];

export function getPlatformLabel(platformId: string, _locale: string): string {
  const label = PLATFORM_LABELS[platformId];
  return label?.en || platformId;
}

export function sortPlatforms(platformIds: string[], _locale: string): string[] {
  const orderIndex = (id: string) => {
    const idx = INT_ORDER.indexOf(id);
    return idx >= 0 ? idx : INT_ORDER.length;
  };
  return [...platformIds].sort((a, b) => orderIndex(a) - orderIndex(b));
}