const PLATFORM_RULES: Record<TargetPlatform, { length: string; style: string; hashtagCount: number }> = {
  tiktok: {
    length: 'Short',
    style: 'Fast-paced, hook-first short video',
    hashtagCount: 3,
  },
  instagram: {
    length: 'Medium',
    style: 'Visual, practical, and save-worthy',
    hashtagCount: 5,
  },
  youtube: {
    length: 'Long',
    style: 'Searchable, structured, and educational',
    hashtagCount: 2,
  },
  x: {
    length: 'Short',
    style: 'Concise, opinionated, and conversation-led',
    hashtagCount: 2,
  },
  linkedin: {
    length: 'Medium',
    style: 'Professional, evidence-aware, and useful',
    hashtagCount: 4,
  },
  reddit: {
    length: 'Medium',
    style: 'Community-first, transparent, and non-promotional',
    hashtagCount: 3,
  },
};
  if (platform === 'tiktok') score += 5;
  if (platform === 'instagram') score += 3;
