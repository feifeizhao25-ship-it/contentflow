'use client';

import { cn } from '@/lib/utils/cn';
import type { LucideIcon } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
const iconMap: Record<string, LucideIcon> = {
  account_balance_wallet: LucideIcons.WalletCards,
  add: LucideIcons.Plus,
  add_circle: LucideIcons.BadgePlus,
  add_link: LucideIcons.Link,
  analytics: LucideIcons.BarChart3,
  arrow_back: LucideIcons.ArrowLeft,
  arrow_forward: LucideIcons.ArrowRight,
  attach_file: LucideIcons.Paperclip,
  auto_awesome: LucideIcons.Sparkles,
  bar_chart: LucideIcons.BarChart3,
  bolt: LucideIcons.Bolt,
  bookmark: LucideIcons.Bookmark,
  calendar_today: LucideIcons.CalendarDays,
  campaign: LucideIcons.Megaphone,
  celebration: LucideIcons.PartyPopper,
  check: LucideIcons.Check,
  check_circle: LucideIcons.CheckCircle2,
  chevron_right: LucideIcons.ChevronRight,
  cleaning_services: LucideIcons.WandSparkles,
  close: LucideIcons.X,
  cloud_download: LucideIcons.CloudDownload,
  content_copy: LucideIcons.Copy,
  database: LucideIcons.Database,
  description: LucideIcons.FileText,
  diversity_3: LucideIcons.Users,
  dns: LucideIcons.Server,
  download: LucideIcons.Download,
  download_for_offline: LucideIcons.FileDown,
  error: LucideIcons.CircleAlert,
  expand_more: LucideIcons.ChevronDown,
  favorite: LucideIcons.Heart,
  filter_list: LucideIcons.Filter,
  forum: LucideIcons.MessagesSquare,
  groups: LucideIcons.Users,
  health_and_safety: LucideIcons.ShieldCheck,
  help: LucideIcons.CircleHelp,
  hub: LucideIcons.Network,
  image: LucideIcons.Image,
  insights: LucideIcons.LineChart,
  keyboard_double_arrow_left: LucideIcons.ChevronsLeft,
  keyboard_double_arrow_right: LucideIcons.ChevronsRight,
  keyboard_return: LucideIcons.CornerDownLeft,
  lightbulb: LucideIcons.Lightbulb,
  link: LucideIcons.Link,
  link_off: LucideIcons.Unlink,
  local_fire_department: LucideIcons.Flame,
  lock: LucideIcons.Lock,
  lock_open: LucideIcons.Unlock,
  lock_reset: LucideIcons.KeyRound,
  magic_button: LucideIcons.Sparkles,
  mail: LucideIcons.Mail,
  manage_search: LucideIcons.ScanSearch,
  more_horiz: LucideIcons.MoreHorizontal,
  more_vert: LucideIcons.MoreVertical,
  new_releases: LucideIcons.BadgeAlert,
  north: LucideIcons.ArrowUp,
  notifications: LucideIcons.Bell,
  offline_bolt: LucideIcons.Zap,
  online_prediction: LucideIcons.RadioTower,
  payments: LucideIcons.CreditCard,
  perm_media: LucideIcons.Images,
  person: LucideIcons.User,
  picture_as_pdf: LucideIcons.FileText,
  play_circle: LucideIcons.PlayCircle,
  priority_high: LucideIcons.BadgeAlert,
  psychology: LucideIcons.Brain,
  psychology_alt: LucideIcons.Brain,
  query_stats: LucideIcons.LineChart,
  refresh: LucideIcons.RefreshCw,
  rocket_launch: LucideIcons.Rocket,
  schedule: LucideIcons.Clock,
  school: LucideIcons.GraduationCap,
  search: LucideIcons.Search,
  send: LucideIcons.Send,
  sentiment_satisfied: LucideIcons.Smile,
  settings: LucideIcons.Settings,
  share: LucideIcons.Share2,
  shopping_cart: LucideIcons.ShoppingCart,
  show_chart: LucideIcons.LineChart,
  smart_toy: LucideIcons.Bot,
  south: LucideIcons.ArrowDown,
  sync: LucideIcons.RefreshCw,
  table: LucideIcons.Table,
  tactic: LucideIcons.Goal,
  task_alt: LucideIcons.ClipboardCheck,
  temp_preferences_custom: LucideIcons.SlidersHorizontal,
  timeline: LucideIcons.LineChart,
  tips_and_updates: LucideIcons.Lightbulb,
  trending_up: LucideIcons.TrendingUp,
  upload_file: LucideIcons.FileUp,
  verified: LucideIcons.BadgeCheck,
  verified_user: LucideIcons.ShieldCheck,
  videocam: LucideIcons.Video,
  vpn_key: LucideIcons.KeyRound,
  waving_hand: LucideIcons.Hand,
  whatshot: LucideIcons.Flame,
  workspace_premium: LucideIcons.Crown,
};

/**
 * Icon wrapper with a local SVG fallback.
 *
 * Material Symbols can expose ligature text when the font is blocked, which is
 * unacceptable in production screenshots. Lucide SVGs keep the UI readable.
 */
export function Icon({ name, className, label }: IconProps) {
  const Component = iconMap[name] ?? LucideIcons.Circle;

  return (
    <>
      <Component
        className={cn('inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]', className)}
        aria-hidden="true"
        strokeWidth={2.2}
      />
      {label ? <span className="sr-only">{label}</span> : null}
    </>
  );
}
