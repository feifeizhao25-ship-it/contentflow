'use client';

import React, { useState, useEffect } from 'react';
import { Card, Button, Tag, Progress, Badge, Empty, message } from 'antd';
import {
    PlusOutlined,
    CalendarOutlined,
    GiftOutlined,
    TrophyOutlined,
    FireOutlined,
    RocketOutlined,
    CheckCircleOutlined,
    RightOutlined,
    BellOutlined,
    ThunderboltOutlined,
    UserOutlined,
    SettingOutlined,
    LogoutOutlined
} from '@ant-design/icons';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useThemeStore } from '@/store/themeStore';
import { usePointsStore } from '@/store/pointsStore';
import CheckInModal from '@/components/checkin/CheckInModal';
import OnboardingGuide from '@/components/onboarding/OnboardingGuide';
import clsx from 'clsx';
import dayjs from 'dayjs';

// 模拟今日任务数据
const TODAY_TASKS = [
    { id: '1', title: '发布 AI 工具推荐文章', platform: 'xhs', time: '10:00', status: 'pending' },
    { id: '2', title: '发布职场干货内容', platform: 'weibo', time: '14:00', status: 'completed' },
    { id: '3', title: '发布周末探店图文', platform: 'douyin', time: '18:00', status: 'pending' },
];

// 模拟最近成就
const RECENT_ACHIEVEMENTS = [
    { id: 'first_content', name: '初出茅庐', icon: '✍️', unlocked: true },
    { id: 'checkin_7', name: '连续7天', icon: '📅', unlocked: false, progress: 71 },
];

// 模拟推荐动作
const RECOMMENDED_ACTIONS = [
    { id: '1', title: '完成今日签到', points: '+45', action: 'checkin', icon: '📅' },
    { id: '2', title: '发布一篇内容', points: '+30', action: 'create', icon: '✨' },
    { id: '3', title: '邀请好友注册', points: '+100', action: 'invite', icon: '👥' },
];

export default function OverviewPage() {
    const router = useRouter();
    const { isDark } = useThemeStore();
    const { points, checkIn, getLevelProgress } = usePointsStore();
    
    const [showCheckIn, setShowCheckIn] = useState(false);
    const [hasCheckedIn, setHasCheckedIn] = useState(false);
    const [todayTasks, setTodayTasks] = useState(TODAY_TASKS);
    const levelProgress = getLevelProgress();

    // 检查今日是否已签到
    useEffect(() => {
        const lastCheckIn = localStorage.getItem('lastCheckIn');
        if (lastCheckIn === dayjs().format('YYYY-MM-DD')) {
            setHasCheckedIn(true);
        }
    }, []);

    const handleQuickAction = (action: string) => {
        switch (action) {
            case 'checkin':
                setShowCheckIn(true);
                break;
            case 'create':
                router.push('/ai-create');
                break;
            case 'invite':
                message.info('邀请功能即将上线');
                break;
        }
    };

    const handleCompleteTask = (taskId: string) => {
        setTodayTasks(tasks => 
            tasks.map(t => t.id === taskId ? { ...t, status: 'completed' } : t)
        );
        message.success('任务完成！+30 积分已到账');
        // 这里应该调用积分增加的逻辑
    };

    const pendingTasks = todayTasks.filter(t => t.status === 'pending');
    const completedTasks = todayTasks.filter(t => t.status === 'completed');

    return (
        <div className="min-h-screen">
            {/* Onboarding Guide */}
            <OnboardingGuide />

            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-zinc-900 dark:text-white mb-2">
                        👋 你好，创作者！
                    </h1>
                    <p className="text-zinc-500 dark:text-zinc-400">
                        今天是 {dayjs().format('YYYY年M月D日 dddd')}，来看一下今天的计划吧
                    </p>
                </div>
                
                {/* 顶部操作区 */}
                <div className="flex items-center gap-4">
                    {/* 签到状态 */}
                    <motion.div
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                    >
                        <Button
                            type={hasCheckedIn ? 'default' : 'primary'}
                            size="large"
                            onClick={() => setShowCheckIn(true)}
                            disabled={hasCheckedIn}
                            icon={<FireOutlined />}
                            className={clsx(
                                "h-12 rounded-xl",
                                hasCheckedIn 
                                    ? "border-green-500 text-green-500" 
                                    : "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 border-none"
                            )}
                        >
                            {hasCheckedIn ? '已签到' : '去签到'}
                        </Button>
                    </motion.div>
                    
                    {/* 新建任务 */}
                    <motion.div
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                    >
                        <Button
                            type="primary"
                            size="large"
                            icon={<PlusOutlined />}
                            onClick={() => router.push('/calendar')}
                            className="h-12 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 border-none"
                        >
                            新建任务
                        </Button>
                    </motion.div>
                </div>
            </div>

            {/* 快捷统计卡片 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {/* 今日任务 */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={clsx(
                        "rounded-2xl p-6",
                        isDark ? "bg-zinc-900" : "bg-white"
                    )}
                >
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                            <CalendarOutlined className="text-xl text-blue-500" />
                        </div>
                        <Badge count={pendingTasks.length} color="#3b82f6" />
                    </div>
                    <h3 className={clsx(
                        "text-2xl font-bold mb-1",
                        isDark ? "text-white" : "text-zinc-900"
                    )}>
                        {pendingTasks.length}
                    </h3>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">今日待发布</p>
                    <Button
                        type="link"
                        size="small"
                        className="mt-3 p-0"
                        onClick={() => router.push('/calendar')}
                    >
                        查看日历 <RightOutlined />
                    </Button>
                </motion.div>

                {/* 当前积分 */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className={clsx(
                        "rounded-2xl p-6",
                        isDark ? "bg-zinc-900" : "bg-white"
                    )}
                >
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                            <GiftOutlined className="text-xl text-amber-500" />
                        </div>
                        <Tag color="gold">可用</Tag>
                    </div>
                    <h3 className={clsx(
                        "text-2xl font-bold mb-1",
                        isDark ? "text-white" : "text-zinc-900"
                    )}>
                        {points}
                    </h3>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">当前积分</p>
                    <Button
                        type="link"
                        size="small"
                        className="mt-3 p-0"
                        onClick={() => router.push('/points')}
                    >
                        去兑换 <RightOutlined />
                    </Button>
                </motion.div>

                {/* 已解锁成就 */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className={clsx(
                        "rounded-2xl p-6",
                        isDark ? "bg-zinc-900" : "bg-white"
                    )}
                >
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                            <TrophyOutlined className="text-xl text-purple-500" />
                        </div>
                        <Badge count={3} color="#a855f7" />
                    </div>
                    <h3 className={clsx(
                        "text-2xl font-bold mb-1",
                        isDark ? "text-white" : "text-zinc-900"
                    )}>
                        3/17
                    </h3>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">已解锁成就</p>
                    <Button
                        type="link"
                        size="small"
                        className="mt-3 p-0"
                        onClick={() => router.push('/achievements')}
                    >
                        查看成就 <RightOutlined />
                    </Button>
                </motion.div>

                {/* 连续签到 */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className={clsx(
                        "rounded-2xl p-6",
                        isDark ? "bg-zinc-900" : "bg-white"
                    )}
                >
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                            <FireOutlined className="text-xl text-orange-500" />
                        </div>
                        <Tag color="orange">{hasCheckedIn ? '进行中' : '未开始'}</Tag>
                    </div>
                    <h3 className={clsx(
                        "text-2xl font-bold mb-1",
                        isDark ? "text-white" : "text-zinc-900"
                    )}>
                        {hasCheckedIn ? 5 : 0} 天
                    </h3>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">连续签到</p>
                    <Progress
                        percent={hasCheckedIn ? 71 : 0}
                        showInfo={false}
                        strokeColor="#f59e0b"
                        trailColor={isDark ? '#3f3f46' : '#e2e8f0'}
                        size="small"
                    />
                </motion.div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 左侧：今日任务列表 */}
                <div className="lg:col-span-2">
                    <Card
                        className={clsx(
                            "rounded-2xl",
                            isDark ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200"
                        )}
                        title={
                            <div className="flex items-center justify-between">
                                <span className="text-lg font-bold">今日发布计划</span>
                                <Button
                                    type="primary"
                                    size="small"
                                    icon={<PlusOutlined />}
                                    onClick={() => router.push('/calendar')}
                                >
                                    添加任务
                                </Button>
                            </div>
                        }
                    >
                        {todayTasks.length === 0 ? (
                            <Empty
                                description="今天还没有计划"
                                className="py-8"
                            >
                                <Button
                                    type="primary"
                                    onClick={() => router.push('/calendar')}
                                >
                                    创建任务
                                </Button>
                            </Empty>
                        ) : (
                            <div className="space-y-3">
                                {todayTasks.map(task => (
                                    <motion.div
                                        key={task.id}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className={clsx(
                                            "p-4 rounded-xl border flex items-center justify-between",
                                            task.status === 'completed'
                                                ? isDark 
                                                    ? "bg-green-900/20 border-green-800" 
                                                    : "bg-green-50 border-green-200"
                                                : isDark 
                                                    ? "bg-zinc-800 border-zinc-700" 
                                                    : "bg-zinc-50 border-zinc-200"
                                        )}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={clsx(
                                                "w-10 h-10 rounded-lg flex items-center justify-center",
                                                task.status === 'completed'
                                                    ? "bg-green-100 dark:bg-green-900/30"
                                                    : "bg-blue-100 dark:bg-blue-900/30"
                                            )}>
                                                {task.status === 'completed' ? (
                                                    <CheckCircleOutlined className="text-green-500" />
                                                ) : (
                                                    <RocketOutlined className="text-blue-500" />
                                                )}
                                            </div>
                                            <div>
                                                <h4 className={clsx(
                                                    "font-medium",
                                                    task.status === 'completed'
                                                        ? "line-through text-zinc-400"
                                                        : isDark ? "text-white" : "text-zinc-900"
                                                )}>
                                                    {task.title}
                                                </h4>
                                                <div className="flex items-center gap-2 text-sm text-zinc-500">
                                                    <Tag color="blue" className="text-xs">
                                                        {task.platform === 'xhs' ? '小红书' :
                                                         task.platform === 'weibo' ? '微博' : '抖音'}
                                                    </Tag>
                                                    <span>{task.time}</span>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        {task.status === 'pending' && (
                                            <Button
                                                type="primary"
                                                size="small"
                                                onClick={() => handleCompleteTask(task.id)}
                                                className="rounded-lg"
                                            >
                                                完成任务
                                            </Button>
                                        )}
                                    </motion.div>
                                ))}
                            </div>
                        )}
                    </Card>

                    {/* 推荐动作 */}
                    <Card
                        className={clsx(
                            "mt-6 rounded-2xl",
                            isDark ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200"
                        )}
                        title={
                            <span className="text-lg font-bold">💡 推荐动作</span>
                        }
                    >
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {RECOMMENDED_ACTIONS.map((action, index) => (
                                <motion.div
                                    key={action.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.1 }}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => handleQuickAction(action.action)}
                                    className={clsx(
                                        "p-4 rounded-xl cursor-pointer transition-all",
                                        isDark 
                                            ? "bg-zinc-800 hover:bg-zinc-700" 
                                            : "bg-zinc-50 hover:bg-zinc-100"
                                    )}
                                >
                                    <div className="flex items-center gap-3 mb-2">
                                        <span className="text-2xl">{action.icon}</span>
                                        <span className={clsx(
                                            "font-medium",
                                            isDark ? "text-white" : "text-zinc-900"
                                        )}>
                                            {action.title}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <Tag color="gold" className="text-xs">
                                            {action.points} 积分
                                        </Tag>
                                        <RightOutlined className="text-zinc-400" />
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </Card>
                </div>

                {/* 右侧：积分、成就、等级 */}
                <div className="space-y-6">
                    {/* 等级卡片 */}
                    <Card
                        className={clsx(
                            "rounded-2xl",
                            isDark ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200"
                        )}
                    >
                        <div className="text-center mb-4">
                            <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center mb-3">
                                <span className="text-3xl font-bold text-white">
                                    {Math.floor(levelProgress.currentXP / 1000) + 1}
                                </span>
                            </div>
                            <h3 className={clsx(
                                "text-lg font-bold",
                                isDark ? "text-white" : "text-zinc-900"
                            )}>
                                Lv.{Math.floor(levelProgress.currentXP / 1000) + 1}
                            </h3>
                            <p className="text-sm text-zinc-500">
                                距离下一级还需 {1000 - (levelProgress.currentXP % 1000)} XP
                            </p>
                        </div>
                        <Progress
                            percent={Math.round((levelProgress.currentXP % 1000) / 10)}
                            strokeColor="#6366f1"
                            trailColor={isDark ? '#3f3f46' : '#e2e8f0'}
                        />
                    </Card>

                    {/* 最近成就 */}
                    <Card
                        className={clsx(
                            "rounded-2xl",
                            isDark ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200"
                        )}
                        title={
                            <div className="flex items-center justify-between">
                                <span className="font-bold">🏆 最近成就</span>
                                <Button
                                    type="link"
                                    size="small"
                                    onClick={() => router.push('/achievements')}
                                >
                                    查看全部
                                </Button>
                            </div>
                        }
                    >
                        <div className="space-y-3">
                            {RECENT_ACHIEVEMENTS.map(achievement => (
                                <div
                                    key={achievement.id}
                                    className={clsx(
                                        "p-3 rounded-xl flex items-center gap-3",
                                        achievement.unlocked
                                            ? isDark ? "bg-zinc-800" : "bg-zinc-50"
                                            : isDark ? "bg-zinc-900/50" : "bg-zinc-50/50"
                                    )}
                                >
                                    <div className={clsx(
                                        "w-12 h-12 rounded-xl flex items-center justify-center text-xl",
                                        achievement.unlocked
                                            ? "bg-amber-100 dark:bg-amber-900/30"
                                            : "bg-zinc-200 dark:bg-zinc-700 grayscale"
                                    )}>
                                        {achievement.icon}
                                    </div>
                                    <div className="flex-1">
                                        <div className={clsx(
                                            "font-medium",
                                            achievement.unlocked
                                                ? isDark ? "text-white" : "text-zinc-900"
                                                : "text-zinc-400"
                                        )}>
                                            {achievement.name}
                                        </div>
                                        {!achievement.unlocked && achievement.progress && (
                                            <Progress
                                                percent={achievement.progress}
                                                size="small"
                                                showInfo={false}
                                                strokeColor="#6366f1"
                                                trailColor={isDark ? '#3f3f46' : '#e2e8f0'}
                                            />
                                        )}
                                    </div>
                                    {achievement.unlocked ? (
                                        <CheckCircleOutlined className="text-green-500 text-lg" />
                                    ) : (
                                        <span className="text-xs text-zinc-400">锁定</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </Card>

                    {/* 快捷入口 */}
                    <Card
                        className={clsx(
                            "rounded-2xl",
                            isDark ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200"
                        )}
                        title={
                            <span className="font-bold">⚡ 快捷入口</span>
                        }
                    >
                        <div className="grid grid-cols-2 gap-3">
                            {[
                                { icon: '📝', name: 'AI创作', path: '/ai-create', color: 'blue' },
                                { icon: '📅', name: '日历', path: '/calendar', color: 'green' },
                                { icon: '🎁', name: '积分', path: '/points', color: 'gold' },
                                { icon: '🎯', name: '成就', path: '/achievements', color: 'purple' },
                            ].map((item, index) => (
                                <motion.div
                                    key={item.name}
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => router.push(item.path)}
                                    className={clsx(
                                        "p-4 rounded-xl cursor-pointer text-center",
                                        isDark 
                                            ? "bg-zinc-800 hover:bg-zinc-700" 
                                            : "bg-zinc-50 hover:bg-zinc-100"
                                    )}
                                >
                                    <div className="text-2xl mb-2">{item.icon}</div>
                                    <div className={clsx(
                                        "text-sm font-medium",
                                        isDark ? "text-white" : "text-zinc-900"
                                    )}>
                                        {item.name}
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </Card>
                </div>
            </div>

            {/* 签到弹窗 */}
            <CheckInModal
                open={showCheckIn}
                onClose={() => setShowCheckIn(false)}
            />
        </div>
    );
}
