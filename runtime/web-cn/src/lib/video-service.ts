import type { ContentDomain, TargetPlatform } from '@/store/onboardingStore';

// 视频生成参数
export interface VideoGenerationParams {
  scriptId: string;
  scriptContent: string;
  domain: ContentDomain;
  platform: TargetPlatform;
  style?: VideoStyle;
  duration?: 'short' | 'medium' | 'long';
  resolution?: '720p' | '1080p' | '4k';
  aspectRatio?: '9:16' | '16:9' | '1:1';
}

// 视频风格
export interface VideoStyle {
  id: string;
  name: string;
  description: string;
  visualEffects: string[];
  transitionSpeed: 'fast' | 'medium' | 'slow';
  colorScheme: string[];
}

// 视频生成状态
export type VideoGenerationStatus = 'pending' | 'processing' | 'completed' | 'failed';

// 视频生成结果
export interface GeneratedVideo {
  id: string;
  scriptId: string;
  status: VideoGenerationStatus;
  progress: number;
  thumbnailUrl?: string;
  videoUrl?: string;
  duration: number;
  resolution: string;
  aspectRatio: string;
  style: VideoStyle;
  createdAt: Date;
  completedAt?: Date;
  error?: string;
}

// 视频风格预设
const VIDEO_STYLES: VideoStyle[] = [
  {
    id: 'vibrant',
    name: '活力潮流',
    description: '高饱和度、快速切换、适合抖音',
    visualEffects: ['光晕', '速度线', '动态文字'],
    transitionSpeed: 'fast',
    colorScheme: ['#FF6B6B', '#4ECDC4', '#FFE66D', '#95E1D3'],
  },
  {
    id: 'elegant',
    name: '优雅简约',
    description: '柔和色调、慢节奏、适合小红书',
    visualEffects: ['淡入淡出', '柔和模糊', '文字动画'],
    transitionSpeed: 'slow',
    colorScheme: ['#F5F5DC', '#E8D5B7', '#B8A99A', '#C4A484'],
  },
  {
    id: 'professional',
    name: '专业商务',
    description: '商务蓝调、清晰明了、适合B站',
    visualEffects: ['图表动画', '数据展示', '进度条'],
    transitionSpeed: 'medium',
    colorScheme: ['#2C3E50', '#3498DB', '#ECF0F1', '#95A5A6'],
  },
  {
    id: 'warm',
    name: '温暖治愈',
    description: '暖色调、柔和氛围、适合情感类',
    visualEffects: ['光斑', '粒子效果', '柔焦'],
    transitionSpeed: 'slow',
    colorScheme: ['#FF9F43', '#FDCB6E', '#FFEAA7', '#E17055'],
  },
  {
    id: 'tech',
    name: '科技未来',
    description: '赛博朋克、霓虹灯光、适合数码',
    visualEffects: ['霓虹', '故障效果', '全息投影'],
    transitionSpeed: 'fast',
    colorScheme: ['#00D2D3', '#5F27CD', '#FF6B6B', '#C4E538'],
  },
  {
    id: 'playful',
    name: '活泼可爱',
    description: '卡通元素、活泼跳跃、适合萌宠',
    visualEffects: ['弹跳', '旋转', '星星闪烁'],
    transitionSpeed: 'fast',
    colorScheme: ['#FF9FF3', '#FECA57', '#54A0FF', '#5F27CD'],
  },
];

// 平台适配的视频风格
const PLATFORM_STYLES: Record<TargetPlatform, string[]> = {
  douyin: ['vibrant', 'tech', 'playful'],
  xiaohongshu: ['elegant', 'warm', 'professional'],
  bilibili: ['professional', 'tech', 'elegant'],
  kuaishou: ['vibrant', 'warm', 'playful'],
  video号: ['professional', 'elegant', 'warm'],
};

// 默认风格
const DEFAULT_STYLE: VideoStyle = VIDEO_STYLES[0];

// 生成视频
export async function generateVideo(params: VideoGenerationParams): Promise<GeneratedVideo> {
  const { scriptId, scriptContent, platform, style, duration, aspectRatio = '9:16' } = params;
  
  // 获取风格
  let selectedStyle: VideoStyle = DEFAULT_STYLE;
  if (style?.id) {
    const found = VIDEO_STYLES.find(s => s.id === style.id);
    if (found) selectedStyle = found;
  } else {
    const platformStyleIds = PLATFORM_STYLES[platform];
    const found = VIDEO_STYLES.find(s => platformStyleIds.includes(s.id));
    if (found) selectedStyle = found;
  }

  // 单片段供应商当前只接受 4–10 秒，不冒充长视频。
  const requestedDuration = duration === 'short' ? 6 : duration === 'long' ? 10 : 8;
  const response = await fetch('/api/ai/generate-video', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      prompt: scriptContent,
      style: selectedStyle.name,
      duration: requestedDuration,
      aspect_ratio: aspectRatio,
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || payload?.message || '视频生成服务暂不可用');
  }
  const videoUrl = String(payload?.video?.url || payload?.url || '');
  if (!videoUrl) throw new Error('视频服务未返回可用文件');

  const completedAt = new Date();
  return {
    id: `video_${completedAt.getTime()}`,
    scriptId,
    status: 'completed',
    progress: 100,
    videoUrl,
    duration: requestedDuration,
    resolution: '以供应商返回文件为准',
    aspectRatio,
    style: selectedStyle,
    createdAt: completedAt,
    completedAt,
  };
}

// 批量生成视频
export async function generateBatchVideos(
  scripts: Array<{ id: string; content: string }>,
  domain: ContentDomain,
  platform: TargetPlatform
): Promise<GeneratedVideo[]> {
  const videos: GeneratedVideo[] = [];
  
  for (const script of scripts) {
    const video = await generateVideo({
      scriptId: script.id,
      scriptContent: script.content,
      domain,
      platform,
    });
    videos.push(video);
  }
  
  return videos;
}

// 获取适合平台的风格
export function getStylesForPlatform(platform: TargetPlatform): VideoStyle[] {
  const styleIds = PLATFORM_STYLES[platform];
  return VIDEO_STYLES.filter(s => styleIds.includes(s.id));
}

// 获取所有风格
export function getAllStyles(): VideoStyle[] {
  return VIDEO_STYLES;
}

// 计算预估文件大小
export function estimateFileSize(duration: number, resolution: string): string {
  const bitrates: Record<string, number> = {
    '720p': 2000,
    '1080p': 4000,
    '4k': 15000,
  };
  
  const bitrate = bitrates[resolution] || 4000;
  const sizeKB = (duration * bitrate) / 8;
  
  if (sizeKB > 1024 * 1024) {
    return `${(sizeKB / (1024 * 1024)).toFixed(1)} GB`;
  }
  return `${(sizeKB / 1024).toFixed(1)} MB`;
}

export const videoService = {
  generateVideo,
  generateBatchVideos,
  getStylesForPlatform,
  getAllStyles,
  estimateFileSize,
};
