const PLATFORM_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  tiktok:      { label: 'TikTok',  bg: 'bg-white/10',               text: 'text-white',        dot: 'bg-white' },
  youtube:     { label: 'YouTube', bg: 'bg-[#FF0000]/15',           text: 'text-[#FF0000]',    dot: 'bg-[#FF0000]' },
  instagram:   { label: 'Instagram', bg: 'bg-[#E4405F]/15',         text: 'text-[#E4405F]',    dot: 'bg-[#E4405F]' },
  x:           { label: 'X',       bg: 'bg-[#111827]/15',           text: 'text-[#111827]',    dot: 'bg-[#111827]' },
  twitter:     { label: 'X',       bg: 'bg-[#111827]/15',           text: 'text-[#111827]',    dot: 'bg-[#111827]' },
  linkedin:    { label: 'LinkedIn',bg: 'bg-[#0A66C2]/15',           text: 'text-[#0A66C2]',    dot: 'bg-[#0A66C2]' },
  reddit:      { label: 'Reddit',  bg: 'bg-[#FF4500]/15',           text: 'text-[#FF4500]',    dot: 'bg-[#FF4500]' },
};
export default function PlatformBadge({ platform, showDot = true, size = 'sm' }: PlatformBadgeProps) {
  const config = PLATFORM_CONFIG[platform] || PLATFORM_CONFIG.tiktok;
