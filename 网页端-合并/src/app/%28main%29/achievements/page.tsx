'use client';

import React, { useState } from 'react';
import { Card, Tag, Progress, Empty, Tooltip, Badge } from 'antd';
import {
    TrophyOutlined,
    FireOutlined,
    RocketOutlined,
    StarOutlined,
    ThunderboltOutlined,
    CheckCircleOutlined,
    LockOutlined,
    CrownOutlined,
    BulbOutlined,
    HeartOutlined
} from '@ant-design/icons';
import { motion } from 'framer-motion';
import { useThemeStore } from '@/store/themeStore';
import { usePointsStore } from '@/store/pointsStore';
import clsx from 'clsx';

// 成就数据定义
const ACHIEVEMENTS = [
    // 创作类
    {
        id: 'first_content',
        name: '初出茅庐',
        description: '创建第一篇内容',
        icon: '✍️',
        color: '#6366f1',
        category: 'creation',
        requirement: 1,
        reward: 50,
        type: 'count'
    },
    {
        id: 'content_10',
        name: '内容创作者',
        description: '创建10篇内容',
        icon: '📝',
        color: '#8b5cf6',
        category: 'creation',
        requirement: 10,
        reward: 100,
        type: 'count'
    },
    {
        id: 'content_50',
        name: '高产似母猪',
        description: '创建50篇内容',
        icon: '🐷',
        color: '#a855f7',
        category: 'creation',
        requirement: 50,
        reward: 300,
        type: 'count'
    },
    {
        id: 'content_100',
        name: '内容大师',
        description: '创建100篇内容',
        icon: '👑',
        color: '#d946ef',
        category: 'creation',
        requirement: 100,
        reward: 500,
        type: 'count'
    },
    
    // 发布类
    {
        id: 'first_publish',
        name: '首发成功',
        description: '首次成功发布内容',
        icon: '🚀',
        color: '#10b981',
        category: 'publish',
        requirement: 1,
        reward: 100,
        type: 'count'
    },
    {
        id: 'publish_10',
        name: '分发达人',
        description: '成功发布10篇内容',
        icon: '📤',
        color: '#14b8a6',
        category: 'publish',
        requirement: 10,
        reward: 200,
        type: 'count'
    },
    {
        id: 'publish_50',
        name: '分发专家',
        description: '成功发布50篇内容',
        icon: '🌟',
        color: '#06b6d4',
        category: 'publish',
        requirement: 50,
        reward: 400,
        type: 'count'
    },
    
    // 签到类
    {
        id: 'checkin_7',
        name: '连续7天',
        description: '连续签到7天',
        icon: '📅',
        color: '#f59e0b',
        category: 'checkin',
        requirement: 7,
        reward: 150,
        type: 'streak'
    },
    {
        id: 'checkin_30',
        name: '月度全勤',
        description: '连续签到30天',
        icon: '🏆',
        color: '#ef4444',
        category: 'checkin',
        requirement: 30,
        reward: 500,
        type: 'streak'
    },
    {
        id: 'checkin_100',
        name: '坚持不懈',
        description: '连续签到100天',
        icon: '💎',
        color: '#f97316',
        category: 'checkin',
        requirement: 100,
        reward: 1000,
        type: 'streak'
    },
    
    // 积分类
    {
        id: 'points_500',
        name: '小有积蓄',
        description: '累计获得500积分',
        icon: '💰',
        color: '#22c55e',
        category: 'points',
        requirement: 500,
        reward: 100,
        type: 'total'
    },
    {
        id: 'points_2000',
        name: '积分大户',
        description: '累计获得2000积分',
        icon: '💎',
        color: '#10b981',
        category: 'points',
        requirement: 2000,
        reward: 300,
        type: 'total'
    },
    {
        id: 'points_10000',
        name: '积分王',
        description: '累计获得10000积分',
        icon: '👑',
        color: '#eab308',
        category: 'points',
        requirement: 10000,
        reward: 1000,
        type: 'total'
    },
    
    // 平台类
    {
        id: 'platform_3',
        name: '三平台达人',
        description: '绑定3个社交账号',
        icon: '🔗',
        color: '#3b82f6',
        category: 'platform',
        requirement: 3,
        reward: 150,
        type: 'count'
    },
    {
        id: 'platform_all',
        name: '全平台制霸',
        description: '绑定所有支持平台',
        icon: '🌐',
        color: '#6366f1',
        category: 'platform',
        requirement: 5,
        reward: 500,
        type: 'count'
    },
    
    // 等级类
    {
        id: 'level_10',
        name: '新星创作者',
        description: '达到10级',
        icon: '⭐',
        color: '#f59e0b',
        category: 'level',
        requirement: 10,
        reward: 200,
        type: 'level'
    },
    {
        id: 'level_25',
        name: '资深创作者',
        description: '达到25级',
        icon: '🌟',
        color: '#8b5cf6',
        category: 'level',
        requirement: 25,
        reward: 500,
        type: 'level'
    },
    {
        id: 'level_50',
        name: '传奇创作者',
        description: '达到50级',
        icon: '🏆',
        color: '#d946ef',
        category: 'level',
        requirement: 50,
        reward: 1500,
        type: 'level'
    },
];

// 用户进度模拟数据（实际应从API获取）
const getUserProgress = () => ({
    contentCreated: 15,
    contentPublished: 8,
    consecutiveDays: 5,
    totalPoints: 680,
    platformsBound: 2,
    level: 5,
    totalCheckins: 12,
});

const CATEGORIES = [
    { id: 'all', name: '全部', icon: <TrophyOutlined /> },
    { id: 'creation', name: '创作', icon: '✍️' },
    { id: 'publish', name: '发布', icon: '🚀' },
    { id: 'checkin', name: '签到', icon: '📅' },
    { id: 'points', name: '积分', icon: '💰' },
    { id: 'platform', name: '平台', icon: '🔗' },
    { id: 'level', name: '等级', icon: '⭐' },
];

export default function AchievementsPage() {
    const { isDark } = useThemeStore();
    const { points, addPoints, experiencePoints } = usePointsStore();
    const [activeCategory, setActiveCategory] = useState('all');
    
    // 模拟已解锁成就
    const [unlockedIds, setUnlockedIds] = useState<string[]>(['first_content', 'first_publish', 'checkin_7']);
    
    // 模拟进度
    const progress = getUserProgress();
    
    // 计算解锁进度
    const getProgress = (achievement: typeof ACHIEVEMENTS[0]) => {
        switch (achievement.category) {
            case 'creation':
                return Math.min((progress.contentCreated / achievement.requirement) * 100, 100);
            case 'publish':
                return Math.min((progress.contentPublished / achievement.requirement) * 100, 100);
            case 'checkin':
                return Math.min((progress.consecutiveDays / achievement.requirement) * 100, 100);
            case 'points':
                return Math.min((progress.totalPoints / achievement.requirement) * 100, 100);
            case 'platform':
                return Math.min((progress.platformsBound / achievement.requirement) * 100, 100);
            case 'level':
                return Math.min((progress.level / achievement.requirement) * 100, 100);
            default:
                return 0;
        }
    };

    const getCurrentValue = (achievement: typeof ACHIEVEMENTS[0]) => {
        switch (achievement.category) {
            case 'creation':
                return progress.contentCreated;
            case 'publish':
                return progress.contentPublished;
            case 'checkin':
                return progress.consecutiveDays;
            case 'points':
                return progress.totalPoints;
            case 'platform':
                return progress.platformsBound;
            case 'level':
                return progress.level;
            default:
                return 0;
        }
    };

    // 筛选成就
    const filteredAchievements = activeCategory === 'all'
        ? ACHIEVEMENTS
        : ACHIEVEMENTS.filter(a => a.category === activeCategory);

    // 统计
    const unlockedCount = ACHIEVEMENTS.filter(a => unlockedIds.includes(a.id)).length;
    const totalReward = ACHIEVEMENTS
        .filter(a => unlockedIds.includes(a.id))
        .reduce((sum, a) => sum + a.reward, 0);

    const handleClaimReward = (achievement: typeof ACHIEVEMENTS[0]) => {
        if (!unlockedIds.includes(achievement.id)) {
            // 解锁成就
            setUnlockedIds([...unlockedIds, achievement.id]);
            addPoints(achievement.reward, `成就奖励: ${achievement.name}`);
        }
    };

    return (
        <div className="min-h-screen">
            {/* 头部统计 */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={clsx(
                        "rounded-2xl p-6",
                        isDark ? "bg-zinc-900" : "bg-white"
                    )}
                >
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                            <TrophyOutlined className="text-xl text-amber-500" />
                        </div>
                        <div>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400">已解锁成就</p>
                            <p className="text-2xl font-bold text-zinc-900 dark:text-white">
                                {unlockedCount} / {ACHIEVEMENTS.length}
                            </p>
                        </div>
                    </div>
                    <Progress
                        percent={Math.round((unlockedCount / ACHIEVEMENTS.length) * 100)}
                        showInfo={false}
                        strokeColor="#f59e0b"
                        trailColor={isDark ? '#3f3f46' : '#e2e8f0'}
                    />
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className={clsx(
                        "rounded-2xl p-6",
                        isDark ? "bg-zinc-900" : "bg-white"
                    )}
                >
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                            <StarOutlined className="text-xl text-purple-500" />
                        </div>
                        <div>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400">当前等级</p>
                            <p className="text-2xl font-bold text-zinc-900 dark:text-white">
                                Lv.{progress.level}
                            </p>
                        </div>
                    </div>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                        距离 Lv.{progress.level + 1} 还需 {1000 - (progress.level * 100) % 1000} XP
                    </p>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className={clsx(
                        "rounded-2xl p-6",
                        isDark ? "bg-zinc-900" : "bg-white"
                    )}
                >
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-12 h-12 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                            <FireOutlined className="text-xl text-orange-500" />
                        </div>
                        <div>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400">连续签到</p>
                            <p className="text-2xl font-bold text-zinc-900 dark:text-white">
                                {progress.consecutiveDays} 天
                            </p>
                        </div>
                    </div>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                        最佳记录: 15 天
                    </p>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className={clsx(
                        "rounded-2xl p-6",
                        isDark ? "bg-zinc-900" : "bg-white"
                    )}
                >
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                            <ThunderboltOutlined className="text-xl text-green-500" />
                        </div>
                        <div>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400">累计奖励</p>
                            <p className="text-2xl font-bold text-zinc-900 dark:text-white">
                                +{totalReward}
                            </p>
                        </div>
                    </div>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                        积分
                    </p>
                </motion.div>
            </div>

            {/* 分类标签 */}
            <div className={clsx(
                "rounded-2xl p-4 mb-6 flex flex-wrap gap-2",
                isDark ? "bg-zinc-900" : "bg-white"
            )}>
                {CATEGORIES.map((cat) => (
                    <button
                        key={cat.id}
                        onClick={() => setActiveCategory(cat.id)}
                        className={clsx(
                            "px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2",
                            activeCategory === cat.id
                                ? "bg-indigo-600 text-white"
                                : isDark
                                    ? "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                        )}
                    >
                        <span>{cat.icon}</span>
                        {cat.name}
                    </button>
                ))}
            </div>

            {/* 成就列表 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredAchievements.map((achievement, index) => {
                    const isUnlocked = unlockedIds.includes(achievement.id);
                    const progressValue = getProgress(achievement);
                    const currentValue = getCurrentValue(achievement);

                    return (
                        <motion.div
                            key={achievement.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                        >
                            <Card
                                className={clsx(
                                    "rounded-2xl overflow-hidden transition-all",
                                    isUnlocked
                                        ? isDark
                                            ? "bg-zinc-900 border-zinc-800"
                                            : "bg-white border-zinc-200"
                                        : isDark
                                            ? "bg-zinc-900/50 border-zinc-800 opacity-75"
                                            : "bg-zinc-50 border-zinc-200 opacity-75"
                                )}
                                styles={{ body: { padding: 0 } }}
                            >
                                <div className="flex">
                                    {/* 左侧图标 */}
                                    <div 
                                        className={clsx(
                                            "w-24 flex items-center justify-center relative",
                                            isUnlocked ? '' : 'grayscale opacity-50'
                                        )}
                                        style={{ background: isUnlocked ? achievement.color : undefined }}
                                    >
                                        <span className="text-4xl">{achievement.icon}</span>
                                        {isUnlocked && (
                                            <div className="absolute -top-1 -right-1 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                                                <CheckCircleOutlined className="text-white text-xs" />
                                            </div>
                                        )}
                                    </div>
                                    
                                    {/* 右侧内容 */}
                                    <div className="flex-1 p-4">
                                        <div className="flex items-start justify-between mb-2">
                                            <div>
                                                <h3 className={clsx(
                                                    "font-bold",
                                                    isUnlocked ? "text-zinc-900 dark:text-white" : "text-zinc-500"
                                                )}>
                                                    {achievement.name}
                                                </h3>
                                                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                                                    {achievement.description}
                                                </p>
                                            </div>
                                            {isUnlocked ? (
                                                <Tag color="green">已解锁</Tag>
                                            ) : (
                                                <Tooltip title={`还需 ${achievement.requirement - currentValue} ${achievement.type === 'streak' ? '天' : ''}`}>
                                                    <LockOutlined className="text-zinc-400" />
                                                </Tooltip>
                                            )}
                                        </div>
                                        
                                        {/* 进度条 */}
                                        {!isUnlocked && (
                                            <div className="mt-3">
                                                <div className="flex justify-between text-xs text-zinc-500 mb-1">
                                                    <span>{currentValue} / {achievement.requirement}</span>
                                                    <span>{Math.round(progressValue)}%</span>
                                                </div>
                                                <Progress
                                                    percent={progressValue}
                                                    showInfo={false}
                                                    strokeColor={achievement.color}
                                                    trailColor={isDark ? '#3f3f46' : '#e2e8f0'}
                                                    size="small"
                                                />
                                            </div>
                                        )}
                                        
                                        {/* 奖励 */}
                                        <div className={clsx(
                                            "mt-3 flex items-center gap-2 text-sm",
                                            isUnlocked ? "text-green-600" : "text-zinc-400"
                                        )}>
                                            <span>🏆 奖励 {achievement.reward} 积分</span>
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        </motion.div>
                    );
                })}
            </div>

            {/* 空状态 */}
            {filteredAchievements.length === 0 && (
                <Empty
                    description="暂无成就"
                    className="py-16"
                />
            )}
        </div>
    );
}
