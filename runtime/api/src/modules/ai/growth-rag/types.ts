export const ALLOWED_LICENSES = ['MIT', 'Apache-2.0', 'CC-BY-4.0', 'official-public', 'proprietary-licensed'] as const;
export type GrowthLicense = (typeof ALLOWED_LICENSES)[number];

export interface GrowthSource {
  source_id: string;
  url: string;
  tier: 'S' | 'A' | 'B' | 'G';
  license: string;
  fetched_at: string;
  expires_at: string;
  title: string;
  text: string;
  content_hash: string;
  tenant_id?: string | null;
  review_status?: 'validated' | 'needs_review';
}

export interface GrowthRegistry {
  sources_status: 'none' | 'validated' | 'review_required';
  sources: GrowthSource[];
  note?: string;
}

export interface Citation {
  source_id: string;
  url: string;
  title: string;
  excerpt: string;
  score: number;
}

export interface TextEmbedder {
  id: 'local-hash' | 'bge-m3';
  embed(text: string): Promise<number[]>;
}
