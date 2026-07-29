export type TargetPlatform = 
  | 'tiktok'
  | 'instagram'
  | 'youtube'
  | 'x'
  | 'linkedin'
  | 'reddit';
const DOMAIN_OPTIONS: DomainOption[] = [
  { id: 'beauty', name: 'Beauty & Skincare', icon: '💄', description: 'Skincare routines, product education, creator-led tutorials', color: '#EC4899' },
  { id: 'fashion', name: 'Fashion & Outfits', icon: '👗', description: 'Outfit ideas, seasonal edits, styling tips', color: '#8B5CF6' },
  { id: 'food', name: 'Food Discovery', icon: '🍜', description: 'Restaurant reviews, recipes, local food stories', color: '#F59E0B' },
  { id: 'tech', name: 'Consumer Tech', icon: '📱', description: 'Apps, devices, AI workflows, product reviews', color: '#3B82F6' },
  { id: 'gaming', name: 'Gaming', icon: '🎮', description: 'Game commentary, guides, esports highlights', color: '#10B981' },
  { id: 'movie', name: 'Film & Streaming', icon: '🎬', description: 'Reviews, explainers, fandom recaps, creator commentary', color: '#EF4444' },
  { id: 'career', name: 'Career Growth', icon: '💼', description: 'Work skills, hiring advice, founder and operator stories', color: '#6366F1' },
  { id: 'emotional', name: 'Personal Growth', icon: '💕', description: 'Self-reflection, resilience, motivation, community prompts', color: '#EC4899' },
  { id: 'knowledge', name: 'Education & Science', icon: '📚', description: 'Practical explainers, research summaries, learning series', color: '#0EA5E9' },
  { id: 'lifestyle', name: 'Lifestyle', icon: '🏠', description: 'Home, wellness, routines, family, everyday stories', color: '#22C55E' },
  { id: 'pets', name: 'Pets & Animals', icon: '🐾', description: 'Pet care, animal stories, rescue and training tips', color: '#F97316' },
  { id: 'travel', name: 'Travel', icon: '✈️', description: 'Itineraries, local guides, travel planning, culture notes', color: '#14B8A6' },
];

// Platform options config
const PLATFORM_OPTIONS: PlatformOption[] = [
  { id: 'tiktok', name: 'TikTok', icon: '🎵', description: 'Fast discovery, short-form hooks, creator-led testing', color: '#000000', recommended: true },
  { id: 'instagram', name: 'Instagram', icon: '📸', description: 'Visual storytelling, Reels, carousels, brand credibility', color: '#E4405F', recommended: true },
  { id: 'youtube', name: 'YouTube', icon: '▶️', description: 'Shorts plus long-form authority, evergreen search demand', color: '#FF0000', recommended: true },
  { id: 'x', name: 'X', icon: '𝕏', description: 'Sharp opinions, real-time commentary, founder-led distribution', color: '#111827', recommended: false },
  { id: 'linkedin', name: 'LinkedIn', icon: '💼', description: 'B2B thought leadership, case studies, lead generation', color: '#0A66C2', recommended: false },
  { id: 'reddit', name: 'Reddit', icon: '👽', description: 'Community research, authentic answers, niche demand sensing', color: '#FF4500', recommended: false },
];
// Domain ID to display name mapping.
// Platform ID to display name mapping.
export const PLATFORM_NAMES: Record<TargetPlatform, string> = {
  tiktok: 'TikTok',
  instagram: 'Instagram',
  youtube: 'YouTube',
  x: 'X',
  linkedin: 'LinkedIn',
  reddit: 'Reddit',
};
