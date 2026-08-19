'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// 内容领域定义
export type ContentDomain = 
  | 'beauty'      // 美妆护肤
  | 'fashion'     // 穿搭时尚
  | 'food'        // 美食探店
  | 'tech'        // 数码科技
  | 'gaming'      // 游戏电竞
  | 'movie'       // 影视剧评
  | 'career'      // 职场成长
  | 'emotional'   // 情感励志
  | 'knowledge'   // 知识科普
  | 'lifestyle'   // 生活日常
  | 'pets'        // 萌宠动物
  | 'travel';     // 旅行出行

// 目标平台定义
export type TargetPlatform = 
  | 'douyin'      // 抖音
  | 'xiaohongshu' // 小红书
  | 'bilibili'    // B站
  | 'kuaishou'    // 快手
  | 'video号';    // 视频号

export interface DomainOption {
  id: ContentDomain;
  name: string;
  icon: string;
  description: string;
  color: string;
}

export interface PlatformOption {
  id: TargetPlatform;
  name: string;
  icon: string;
  description: string;
  color: string;
  recommended: boolean;
}

export interface OnboardingProgress {
  // 步骤完成状态
  step1Completed: boolean;  // 领域选择
  step2Completed: boolean;  // 平台选择
  step3Completed: boolean;  // 首个脚本生成
  step4Completed: boolean;  // 首个视频生成
  step5Completed: boolean;  // 发布/预览完成
  
  // 用户选择
  selectedDomain?: ContentDomain;
  selectedPlatforms: TargetPlatform[];
  
  // 首次创作记录
  firstScriptId?: string;
  firstVideoId?: string;
  
  // 时间戳
  startedAt: Date;
  completedAt?: Date;
  
  // 奖励状态
  rewards: {
    step3Reward: boolean;   // 50积分
    step4Reward: boolean;   // 3天VIP
    step5Reward: boolean;   // "新星诞生"徽章
    completionReward: boolean; // 100积分
  };
}

interface OnboardingState {
  // 当前状态
  isActive: boolean;
  currentStep: number;
  progress: OnboardingProgress;
  isLoading: boolean;
  
  // 领域选项
  domains: DomainOption[];
  platforms: PlatformOption[];
  
  // Actions
  startOnboarding: () => void;
  closeOnboarding: () => void;
  selectDomain: (domain: ContentDomain) => void;
  selectPlatform: (platform: TargetPlatform) => void;
  deselectPlatform: (platform: TargetPlatform) => void;
  completeStep1: () => void;
  completeStep2: () => void;
  completeStep3: (scriptId: string) => void;
  completeStep4: (videoId: string) => void;
  completeStep5: () => void;
  completeOnboarding: () => void;
  resetProgress: () => void;
}

// 领域选项配置
const DOMAIN_OPTIONS: DomainOption[] = [
  { id: 'beauty', name: '美妆护肤', icon: '💄', description: '化妆品、护肤品、化妆教程', color: '#EC4899' },
  { id: 'fashion', name: '穿搭时尚', icon: '👗', description: '服装搭配、潮流趋势、穿搭技巧', color: '#8B5CF6' },
  { id: 'food', name: '美食探店', icon: '🍜', description: '美食推荐、餐厅测评、烹饪教程', color: '#F59E0B' },
  { id: 'tech', name: '数码科技', icon: '📱', description: '手机、电脑、数码产品评测', color: '#3B82F6' },
  { id: 'gaming', name: '游戏电竞', icon: '🎮', description: '游戏解说、攻略、电竞资讯', color: '#10B981' },
  { id: 'movie', name: '影视剧评', icon: '🎬', description: '电影解说、剧评、明星八卦', color: '#EF4444' },
  { id: 'career', name: '职场成长', icon: '💼', description: '职场技能、求职面试、自我提升', color: '#6366F1' },
  { id: 'emotional', name: '情感励志', icon: '💕', description: '情感故事、人生感悟、正能量', color: '#EC4899' },
  { id: 'knowledge', name: '知识科普', icon: '📚', description: '知识分享、科普讲解、干货教程', color: '#0EA5E9' },
  { id: 'lifestyle', name: '生活日常', icon: '🏠', description: '日常生活、Vlog、家居生活', color: '#22C55E' },
  { id: 'pets', name: '萌宠动物', icon: '🐾', description: '宠物日常、萌宠视频、动物科普', color: '#F97316' },
  { id: 'travel', name: '旅行出行', icon: '✈️', description: '旅行攻略、景点推荐、出行记录', color: '#14B8A6' },
];

// 平台选项配置
const PLATFORM_OPTIONS: PlatformOption[] = [
  { id: 'douyin', name: '抖音', icon: '🎵', description: '推荐首选，流量最大', color: '#000000', recommended: true },
  { id: 'xiaohongshu', name: '小红书', icon: '📕', description: '种草笔记，女性用户多', color: '#FE2C55', recommended: true },
  { id: 'bilibili', name: 'B站', icon: '📺', description: '年轻社区，长视频友好', color: '#00A1D6', recommended: false },
  { id: 'kuaishou', name: '快手', icon: '📱', description: '下沉市场，强互动', color: '#FF4906', recommended: false },
  { id: 'video号', name: '视频号', icon: '🎬', description: '微信生态，私域转化', color: '#07C160', recommended: false },
];

const INITIAL_PROGRESS: OnboardingProgress = {
  step1Completed: false,
  step2Completed: false,
  step3Completed: false,
  step4Completed: false,
  step5Completed: false,
  selectedPlatforms: [],
  startedAt: new Date(),
  rewards: {
    step3Reward: false,
    step4Reward: false,
    step5Reward: false,
    completionReward: false,
  },
};

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set, get) => ({
      // 初始状态
      isActive: false,
      currentStep: 0,
      progress: INITIAL_PROGRESS,
      isLoading: false,
      domains: DOMAIN_OPTIONS,
      platforms: PLATFORM_OPTIONS,
      
      // Actions
      startOnboarding: () => {
        const hasStarted = localStorage.getItem('onboardingStarted');
        if (!hasStarted) {
          set({ isActive: true, currentStep: 0 });
          localStorage.setItem('onboardingStarted', 'true');
        }
      },
      
      closeOnboarding: () => {
        set({ isActive: false });
      },
      
      selectDomain: (domain) => {
        set((state) => ({
          progress: {
            ...state.progress,
            selectedDomain: domain,
          },
        }));
      },
      
      selectPlatform: (platform) => {
        set((state) => {
          const platforms = state.progress.selectedPlatforms.includes(platform)
            ? state.progress.selectedPlatforms
            : [...state.progress.selectedPlatforms, platform];
          return {
            progress: {
              ...state.progress,
              selectedPlatforms: platforms,
            },
          };
        });
      },
      
      deselectPlatform: (platform) => {
        set((state) => ({
          progress: {
            ...state.progress,
            selectedPlatforms: state.progress.selectedPlatforms.filter((p) => p !== platform),
          },
        }));
      },
      
      completeStep1: () => {
        set((state) => ({
          progress: {
            ...state.progress,
            step1Completed: true,
          },
          currentStep: 1,
        }));
      },
      
      completeStep2: () => {
        set((state) => ({
          progress: {
            ...state.progress,
            step2Completed: true,
          },
          currentStep: 2,
        }));
      },
      
      completeStep3: (scriptId) => {
        set((state) => ({
          progress: {
            ...state.progress,
            step3Completed: true,
            firstScriptId: scriptId,
            rewards: {
              ...state.progress.rewards,
              step3Reward: true, // 发放50积分
            },
          },
          currentStep: 3,
        }));
      },
      
      completeStep4: (videoId) => {
        set((state) => ({
          progress: {
            ...state.progress,
            step4Completed: true,
            firstVideoId: videoId,
            rewards: {
              ...state.progress.rewards,
              step4Reward: true, // 发放3天VIP
            },
          },
          currentStep: 4,
        }));
      },
      
      completeStep5: () => {
        set((state) => ({
          progress: {
            ...state.progress,
            step5Completed: true,
            completedAt: new Date(),
            rewards: {
              ...state.progress.rewards,
              step5Reward: true, // 发放徽章
              completionReward: true, // 发放100积分
            },
          },
          currentStep: 5,
          isActive: false,
        }));
      },
      
      completeOnboarding: () => {
        set((state) => ({
          progress: {
            ...state.progress,
            step5Completed: true,
            completedAt: new Date(),
            rewards: {
              ...state.progress.rewards,
              step5Reward: true,
              completionReward: true,
            },
          },
          currentStep: 5,
          isActive: false,
        }));
      },
      
      resetProgress: () => {
        localStorage.removeItem('onboardingStarted');
        set({
          isActive: false,
          currentStep: 0,
          progress: INITIAL_PROGRESS,
        });
      },
    }),
    {
      name: 'onboarding-storage',
      partialize: (state) => ({
        progress: state.progress,
        isActive: state.isActive,
        currentStep: state.currentStep,
      }),
    }
  )
);

// 选择器组件的辅助函数
export const getDomainById = (id: ContentDomain): DomainOption | undefined => {
  return DOMAIN_OPTIONS.find((d) => d.id === id);
};

export const getPlatformById = (id: TargetPlatform): PlatformOption | undefined => {
  return PLATFORM_OPTIONS.find((p) => p.id === id);
};

// 领域ID到中文名称映射
export const DOMAIN_NAMES: Record<ContentDomain, string> = {
  beauty: '美妆护肤',
  fashion: '穿搭时尚',
  food: '美食探店',
  tech: '数码科技',
  gaming: '游戏电竞',
  movie: '影视剧评',
  career: '职场成长',
  emotional: '情感励志',
  knowledge: '知识科普',
  lifestyle: '生活日常',
  pets: '萌宠动物',
  travel: '旅行出行',
};

// 平台ID到中文名称映射
export const PLATFORM_NAMES: Record<TargetPlatform, string> = {
  douyin: '抖音',
  xiaohongshu: '小红书',
  bilibili: 'B站',
  kuaishou: '快手',
  video号: '视频号',
};
