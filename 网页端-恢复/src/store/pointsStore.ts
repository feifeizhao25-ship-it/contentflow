'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// 积分记录类型
export interface PointsRecord {
  id: string;
  points: number;
  type: 'earn' | 'spend';
  source: string;
  description: string;
  createdAt: Date;
}

// 签到记录
export interface CheckInRecord {
  date: string; // YYYY-MM-DD
  streak: number;
  bonus: number;
}

// 用户积分状态
interface PointsState {
  balance: number;
  totalEarned: number;
  totalSpent: number;
  records: PointsRecord[];
  checkInRecords: CheckInRecord[];
  currentStreak: number;
  lastCheckInDate: string | null;
  consecutiveDays: number;
}

// 等级进度
export interface LevelProgress {
  currentXP: number;
  level: number;
  xpForNextLevel: number;
  progress: number;
}

// Actions
interface PointsActions {
  addPoints: (points: number, source: string, description: string) => void;
  spendPoints: (points: number, source: string, description: string) => boolean;
  checkIn: () => { success: boolean; bonus?: number; streak?: number };
  getTodayStatus: () => { checkedIn: boolean; canCheckIn: boolean };
  getRecords: (limit?: number) => PointsRecord[];
  getLevelProgress: () => LevelProgress;
  reset: () => void;
}

// 积分配置
const POINTS_CONFIG = {
  dailyCheckIn: {
    base: 10,
    streakBonus: {
      '7': 10,
      '14': 20,
      '30': 50,
      '60': 100,
    },
  },
  content: {
    generateScript: 5,
    generateVideo: 10,
    publishContent: 20,
  },
  engagement: {
    like: 1,
    share: 5,
    comment: 2,
  },
  referral: {
    register: 50,
    firstContent: 30,
    firstVideo: 50,
  },
};

// 初始状态
const INITIAL_STATE: PointsState = {
  balance: 0,
  totalEarned: 0,
  totalSpent: 0,
  records: [],
  checkInRecords: [],
  currentStreak: 0,
  lastCheckInDate: null,
  consecutiveDays: 0,
};

// 创建store
export const usePointsStore = create<PointsState & PointsActions>()(
  persist(
    (set, get) => ({
      ...INITIAL_STATE,

      // 增加积分
      addPoints: (points, source, description) => {
        set((state) => ({
          balance: state.balance + points,
          totalEarned: state.totalEarned + points,
          records: [
            {
              id: `pts_${Date.now()}`,
              points,
              type: 'earn',
              source,
              description,
              createdAt: new Date(),
            },
            ...state.records.slice(0, 99), // 只保留最近100条
          ],
        }));
      },

      // 消耗积分
      spendPoints: (points, source, description) => {
        const state = get();
        if (state.balance < points) {
          return false;
        }
        set((state) => ({
          balance: state.balance - points,
          totalSpent: state.totalSpent + points,
          records: [
            {
              id: `pts_${Date.now()}`,
              points,
              type: 'spend',
              source,
              description,
              createdAt: new Date(),
            },
            ...state.records.slice(0, 99),
          ],
        }));
        return true;
      },

      // 签到
      checkIn: () => {
        const state = get();
        const today = new Date().toISOString().split('T')[0];
        
        // 检查今天是否已签到
        if (state.lastCheckInDate === today) {
          return { success: false };
        }

        // 计算连续天数
        let consecutiveDays = 1;
        if (state.lastCheckInDate) {
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          const yesterdayStr = yesterday.toISOString().split('T')[0];
          
          if (state.lastCheckInDate === yesterdayStr) {
            consecutiveDays = state.consecutiveDays + 1;
          }
        }

        // 计算签到奖励
        const baseBonus = POINTS_CONFIG.dailyCheckIn.base;
        const streakKeys = [7, 14, 30, 60] as const;
        const closestKey = streakKeys.filter(k => consecutiveDays >= k).pop() || 0;
        const streakBonus = POINTS_CONFIG.dailyCheckIn.streakBonus[String(closestKey) as keyof typeof POINTS_CONFIG.dailyCheckIn.streakBonus] || 0;
        const totalBonus = baseBonus + streakBonus;

        // 更新状态
        set((state) => ({
          balance: state.balance + totalBonus,
          totalEarned: state.totalEarned + totalBonus,
          currentStreak: consecutiveDays,
          consecutiveDays,
          lastCheckInDate: today,
          checkInRecords: [
            ...state.checkInRecords,
            {
              date: today,
              streak: consecutiveDays,
              bonus: totalBonus,
            },
          ],
          records: [
            {
              id: `pts_${Date.now()}`,
              points: totalBonus,
              type: 'earn',
              source: 'daily_checkin',
              description: `每日签到${consecutiveDays}天`,
              createdAt: new Date(),
            },
            ...state.records.slice(0, 99),
          ],
        }));

        return { success: true, bonus: totalBonus, streak: consecutiveDays };
      },

      // 获取今天签到状态
      getTodayStatus: () => {
        const state = get();
        const today = new Date().toISOString().split('T')[0];
        return {
          checkedIn: state.lastCheckInDate === today,
          canCheckIn: state.lastCheckInDate !== today,
        };
      },

      // 获取积分记录
      getRecords: (limit = 10) => {
        const state = get();
        return state.records.slice(0, limit);
      },

      // 获取等级进度
      getLevelProgress: () => {
        const state = get();
        const currentXP = state.totalEarned;
        const level = Math.floor(currentXP / 1000) + 1;
        const xpForNextLevel = level * 1000;
        const progress = (currentXP % 1000) / 1000;
        
        return {
          currentXP,
          level,
          xpForNextLevel,
          progress,
        };
      },

      // 重置
      reset: () => {
        set(INITIAL_STATE);
      },
    }),
    {
      name: 'points-storage',
      partialize: (state) => ({
        balance: state.balance,
        totalEarned: state.totalEarned,
        totalSpent: state.totalSpent,
        records: state.records,
        checkInRecords: state.checkInRecords,
        currentStreak: state.currentStreak,
        lastCheckInDate: state.lastCheckInDate,
        consecutiveDays: state.consecutiveDays,
      }),
    }
  )
);

// 积分配置导出
export const POINTS = POINTS_CONFIG;

// 积分商城奖励列表
export interface RewardItem {
  id: string;
  name: string;
  points: number;
  type: 'coupon' | 'subscription' | 'storage' | 'other';
  description: string;
}

export const REWARDS: RewardItem[] = [
  { id: '1', name: '10元优惠券', points: 500, type: 'coupon', description: '可用于会员订阅抵扣' },
  { id: '2', name: '30元优惠券', points: 1200, type: 'coupon', description: '可用于会员订阅抵扣' },
  { id: '3', name: '1天VIP会员', points: 100, type: 'subscription', description: '解锁全部高级功能' },
  { id: '4', name: '7天VIP会员', points: 500, type: 'subscription', description: '解锁全部高级功能' },
  { id: '5', name: '30天VIP会员', points: 1500, type: 'subscription', description: '解锁全部高级功能' },
  { id: '6', name: '10GB云存储', points: 800, type: 'storage', description: '用于存储素材和作品' },
  { id: '7', name: '50GB云存储', points: 3000, type: 'storage', description: '用于存储素材和作品' },
  { id: '8', name: '专属头像框', points: 2000, type: 'other', description: '展示你的VIP身份' },
];
