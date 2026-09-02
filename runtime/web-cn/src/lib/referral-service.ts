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
  verified: boolean;
  message: string;
}> {
  const shareText = [config.title, config.description, ...(config.hashtags || [])].join('\n');
  try {
    if (platform === 'copy_link') {
      await navigator.clipboard.writeText(config.url);
      return { success: true, verified: false, message: '链接已复制，请在目标平台完成分享' };
    }

    if (platform === 'weibo') {
      const target = `https://service.weibo.com/share/share.php?url=${encodeURIComponent(config.url)}&title=${encodeURIComponent(shareText)}`;
      const opened = window.open(target, '_blank', 'noopener,noreferrer');
      if (!opened) throw new Error('浏览器拦截了分享窗口，请允许弹窗后重试');
      return { success: true, verified: false, message: '已打开微博分享页，请确认后发布' };
    }

    if (navigator.share) {
      await navigator.share({ title: config.title, text: config.description, url: config.url });
      return { success: true, verified: false, message: '系统分享面板已完成操作' };
    }

    await navigator.clipboard.writeText(`${shareText}\n${config.url}`);
    return { success: true, verified: false, message: '当前浏览器无法直接分享，分享内容已复制' };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return { success: false, verified: false, message: '已取消分享' };
    }
    throw error;
  }
}

// 生成分享链接
export function generateInviteLink(inviteCode: string): string {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://fenfa.ai';
  return `${baseUrl}?ref=${inviteCode}`;
}

// 生成邀请码
export function generateInviteCode(): string {
  throw new Error('邀请码必须由服务端登记后签发');
}

// 获取用户邀请统计
export async function getReferralStats(userId: string): Promise<ReferralStats> {
  void userId;
  throw new Error('邀请统计服务尚未接入，不能生成未经服务端登记的邀请码');
}

// 处理邀请回调
export async function handleInviteCallback(
  inviteCode: string,
  invitedUserId: string
): Promise<{ success: boolean; reward?: { points: number; vipDays: number }; message?: string }> {
  void inviteCode;
  void invitedUserId;
  throw new Error('邀请回调服务尚未接入，未发放任何奖励');
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
