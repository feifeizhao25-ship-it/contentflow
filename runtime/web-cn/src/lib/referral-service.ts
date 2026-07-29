import type { ContentDomain, TargetPlatform } from '@/store/onboardingStore';

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
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://fenfa.ai';
  
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
  console.log(`[Share] Sharing to ${platform}:`, config);
  return { success: true, message: '分享成功' };
}

// 生成分享链接
export function generateInviteLink(inviteCode: string): string {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://fenfa.ai';
  return `${baseUrl}?ref=${inviteCode}`;
}

// 生成邀请码
export function generateInviteCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// 获取用户邀请统计
export async function getReferralStats(userId: string): Promise<ReferralStats> {
  return {
    totalInvites: 0,
    completedInvites: 0,
    pendingInvites: 0,
    totalRewards: { points: 0, vipDays: 0 },
    inviteCode: generateInviteCode(),
    inviteLink: generateInviteLink(generateInviteCode()),
  };
}

// 处理邀请回调
export async function handleInviteCallback(
  inviteCode: string,
  invitedUserId: string
): Promise<{ success: boolean; reward?: { points: number; vipDays: number }; message?: string }> {
  console.log(`[Referral] User ${invitedUserId} registered with code ${inviteCode}`);
  return {
    success: true,
    reward: { points: SHARE_REWARDS.invitee.points, vipDays: SHARE_REWARDS.invitee.vipDays },
    message: '邀请验证成功',
  };
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
