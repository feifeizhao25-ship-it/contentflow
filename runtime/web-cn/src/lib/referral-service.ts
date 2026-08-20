import { apiClient } from '@/lib/api-client';

// 分享配置
export interface ShareConfig {
  title: string;
  description: string;
  url: string;
  hashtags?: string[];
  platforms: SharePlatform[];
}

// 分享平台
export type SharePlatform = 'wechat' | 'weibo' | 'qq' | 'copy_link' | 'qrcode';

// 邀请记录
export interface ReferralRecord {
  id: string;
  invitedUserId: string;
  invitedAt: Date;
  status: 'pending' | 'completed' | 'expired';
  rewardClaimed: boolean;
  reward: {
    points: number;
    vipDays: number;
  };
}

// 邀请统计
export interface ReferralStats {
  totalInvites: number;
  completedInvites: number;
  pendingInvites: number;
  totalRewards: {
    points: number;
    vipDays: number;
  };
  inviteCode: string;
  inviteLink: string;
}

// 分享奖励配置
export const SHARE_REWARDS = {
  // 分享奖励
  share: {
    points: 5,
    cooldown: 60 * 60 * 1000, // 1小时冷却
  },
  
  // 邀请奖励（邀请人）
  inviter: {
    points: 50,
    vipDays: 1,
  },
  
  // 被邀请人奖励
  invitee: {
    points: 30,
    vipDays: 3, // 3天VIP试用
  },
  
  // 阶梯奖励
  milestones: [
    { invites: 3, bonus: { points: 50, vipDays: 0 } },
    { invites: 10, bonus: { points: 200, vipDays: 3 } },
    { invites: 50, bonus: { points: 1000, vipDays: 10 } },
    { invites: 100, bonus: { points: 3000, vipDays: 30 } },
  ],
};

// 生成分享配置
export function generateShareConfig(
  type: 'app' | 'script' | 'video',
  content?: {
    title?: string;
    scriptId?: string;
    videoId?: string;
  }
): ShareConfig {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  
  const configs: Record<string, ShareConfig> = {
    app: {
      title: '分发光子AI - 智能内容创作平台',
      description: 'AI一键生成爆款脚本和视频，让创作更轻松！',
      url: baseUrl,
      hashtags: ['分发光子AI', 'AI创作', '短视频工具'],
      platforms: ['wechat', 'weibo', 'qq', 'copy_link', 'qrcode'],
    },
    script: {
      title: content?.title || '我用分发光子AI生成的爆款脚本',
      description: '一键生成脚本，AI真是太强了！',
      url: `${baseUrl}/script/${content?.scriptId || ''}`,
      hashtags: ['分发光子AI', 'AI脚本生成'],
      platforms: ['wechat', 'copy_link'],
    },
    video: {
      title: content?.title || '我用分发光子AI生成的视频',
      description: 'AI生成的视频效果太棒了！',
      url: `${baseUrl}/video/${content?.videoId || ''}`,
      hashtags: ['分发光子AI', 'AI视频生成'],
      platforms: ['wechat', 'weibo', 'qq', 'copy_link'],
    },
  };
  
  return configs[type] || configs.app;
}

// 执行分享
export async function shareContent(config: ShareConfig, platform: SharePlatform): Promise<{
  success: boolean;
  message?: string;
}> {
  if (typeof window === 'undefined') {
    return { success: false, message: '分享功能只能在浏览器中使用' };
  }

  if (platform === 'copy_link') {
    if (!navigator.clipboard?.writeText) {
      return { success: false, message: '当前浏览器不支持自动复制，请手动复制链接' };
    }
    await navigator.clipboard.writeText(config.url);
    return { success: true, message: '链接已复制' };
  }

  if (platform === 'qrcode') {
    return { success: false, message: '二维码分享尚未启用' };
  }

  if (!navigator.share) {
    return { success: false, message: '当前设备不支持直接分享，请复制链接后分享' };
  }

  try {
    await navigator.share({
      title: config.title,
      text: [config.description, ...(config.hashtags ?? []).map(tag => `#${tag}`)].join(' '),
      url: config.url,
    });
    return { success: true, message: '已交给系统分享面板' };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return { success: false, message: '已取消分享' };
    }
    return { success: false, message: '分享失败，请复制链接后重试' };
  }
}

// 生成分享链接
export function generateInviteLink(inviteCode: string): string {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  return `${baseUrl}?ref=${inviteCode}`;
}

// 获取用户邀请统计
export async function getReferralStats(userId: string): Promise<ReferralStats> {
  if (!userId) throw new Error('请先登录后查看邀请数据');
  const response = await apiClient.get<ReferralStats | { data?: ReferralStats }>('/referrals/me');
  return (response as { data?: ReferralStats }).data ?? response as ReferralStats;
}

// 处理邀请回调
export async function handleInviteCallback(
  inviteCode: string,
  invitedUserId: string
): Promise<{ success: boolean; reward?: { points: number; vipDays: number }; message?: string }> {
  if (!inviteCode || !invitedUserId) {
    return { success: false, message: '邀请信息不完整' };
  }
  const response = await apiClient.post<
    { success: boolean; reward?: { points: number; vipDays: number }; message?: string } |
    { data?: { success: boolean; reward?: { points: number; vipDays: number }; message?: string } }
  >('/referrals/accept', { inviteCode, invitedUserId });
  return (response as { data?: any }).data ?? response as any;
}

// 获取邀请阶梯奖励
export function getMilestoneBonus(totalInvites: number): {
  points: number;
  vipDays: number;
  nextMilestone: number;
  progress: number;
} {
  let bonusPoints = 0;
  let bonusVipDays = 0;
  let nextMilestone = 0;
  
  for (const milestone of SHARE_REWARDS.milestones) {
    if (totalInvites >= milestone.invites) {
      bonusPoints += milestone.bonus.points;
      bonusVipDays += milestone.bonus.vipDays;
    } else {
      nextMilestone = milestone.invites;
      break;
    }
  }
  
  return { points: bonusPoints, vipDays: bonusVipDays, nextMilestone, progress: Math.min(100, (totalInvites / 10) * 100) };
}

// 分享文案模板
export const SHARE_TEMPLATES = {
  wechat: { title: '分发光子AI - 智能内容创作平台', description: '我发现了一个超好用的AI创作工具，一键生成爆款脚本和视频，你也来试试吧！' },
  weibo: { title: '#分发光子AI# 智能内容创作', description: '发现了这个超棒的AI创作工具！一键生成爆款内容，创作效率提升10倍！点击链接体验：' },
  qq: { title: '分发光子AI - AI创作神器', description: '分享一个我常用的AI创作工具，帮你轻松生成爆款内容！' },
  general: { title: '我用分发光子AI生成的爆款内容', description: 'AI创作真的太强了，一键生成脚本和视频，推荐你也试试！' },
};
