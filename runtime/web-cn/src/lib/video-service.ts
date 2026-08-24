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
  const { scriptId, scriptContent, platform, style, duration } = params;
  
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

  // 预估视频时长
  const estimatedDuration = duration === 'short' ? 15 : duration === 'long' ? 60 : 30;
  
  // 创建视频记录
  const video: GeneratedVideo = {
    id: `video_${Date.now()}`,
    scriptId,
    status: 'pending',
    progress: 0,
    duration: estimatedDuration,
    resolution: '1080p',
    aspectRatio: '9:16',
    style: selectedStyle,
    createdAt: new Date(),
  };

  // 模拟生成过程
  await simulateVideoGeneration(video);
  
  return video;
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

// 视频生成进度模拟
async function simulateVideoGeneration(video: GeneratedVideo): Promise<void> {
  const steps = [
    { progress: 10, message: '解析脚本内容...' },
    { progress: 25, message: '生成画面素材...' },
    { progress: 40, message: '匹配背景音乐...' },
    { progress: 55, message: '合成字幕特效...' },
    { progress: 70, message: '渲染视频帧...' },
    { progress: 85, message: '音频合成...' },
    { progress: 95, message: '最终输出...' },
    { progress: 100, message: '生成完成！' },
  ];

  for (const step of steps) {
    await new Promise(resolve => setTimeout(resolve, 500));
    video.progress = step.progress;
    console.log(`[Video Generation] ${step.message} (${step.progress}%)`);
  }

  video.status = 'completed';
  video.progress = 100;
  video.completedAt = new Date();
  video.thumbnailUrl = `https://via.placeholder.com/540x960/6366f1/ffffff?text=Video+${video.id}`;
  video.videoUrl = `https://example.com/videos/${video.id}.mp4`;
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
