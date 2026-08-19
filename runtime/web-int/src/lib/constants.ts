export function formatCurrency(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
export const PLATFORMS = [
  { id: "tiktok", name: "TikTok", icon: "🎵", color: "#000000" },
  { id: "instagram", name: "Instagram", icon: "📸", color: "#E4405F" },
  { id: "youtube", name: "YouTube", icon: "▶️", color: "#FF0000" },
  { id: "x", name: "X", icon: "𝕏", color: "#111827" },
  { id: "linkedin", name: "LinkedIn", icon: "💼", color: "#0A66C2" },
  { id: "reddit", name: "Reddit", icon: "👽", color: "#FF4500" },
] as const;

export type PlatformId = "tiktok" | "instagram" | "youtube" | "x" | "linkedin" | "reddit";
