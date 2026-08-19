'use client';

import React, { useState, useEffect } from 'react';
import { Card, Button, Tag, Progress, Badge, Empty, message, Row, Col, Space, Statistic, Avatar } from 'antd';
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
    RiseOutlined,
    SyncOutlined,
    LoadingOutlined,
    CloudOutlined,
    SmileOutlined
} from '@ant-design/icons';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useThemeStore } from '@/store/themeStore';
import { usePointsStore } from '@/store/pointsStore';
import { apiClient } from '@/lib/api-client';
import CheckInModal from '@/components/checkin/CheckInModal';
import OnboardingGuide from '@/components/onboarding/OnboardingGuide';
import clsx from 'clsx';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

const PLATFORM_MAP: Record<string, { icon: string, color: string }> = {
    xhs: { icon: '📕', color: '#ef4444' },
    douyin: { icon: '🎵', color: '#1a1a1a' },
    wechat: { icon: '💬', color: '#07c160' },
    weibo: { icon: '👁️', color: '#f59e0b' },
    bilibili: { icon: '📺', color: '#00a1d6' }
};

export default function OverviewPage() {
    const router = useRouter();
    const { balance, getLevelProgress } = usePointsStore();

    const [showCheckIn, setShowCheckIn] = useState(false);
    const [hasCheckedIn, setHasCheckedIn] = useState(false);
    const [todayTasks, setTodayTasks] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [dashboardData, setDashboardData] = useState<any>({
        stats: { todayPublishes: 0, totalSuccess: 0, contentCount: 0, totalFollowers: 0 },
        recentActivities: []
    });

    const levelProgress = getLevelProgress();

    useEffect(() => {
        const lastCheckIn = localStorage.getItem('lastCheckIn');
        if (lastCheckIn === dayjs().format('YYYY-MM-DD')) {
            setHasCheckedIn(true);
        }
        fetchData();
    }, []);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            // Parallel fetch
            const [dashboardRes, tasksRes] = await Promise.all([
                apiClient.get<any>('/analytics/dashboard'),
                apiClient.get<any>('/publish/tasks')
            ]);

            if (dashboardRes.success) {
                setDashboardData(dashboardRes.data);
            }

            if (tasksRes.data) {
                const today = dayjs().format('YYYY-MM-DD');
                const filtered = tasksRes.data.filter((t: any) => dayjs(t.scheduled_at).format('YYYY-MM-DD') === today);
                setTodayTasks(filtered.map((t: any) => ({
                    id: t.id,
                    title: t.content?.title || '未命名内容',
                    platform: t.platform,
                    time: dayjs(t.scheduled_at).format('HH:mm'),
                    status: t.status === 'published' ? 'completed' : 'pending'
                })));
            }
        } catch (e) {
            console.error('Failed to fetch dashboard data', e);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="max-w-[1400px] mx-auto p-4 space-y-8">
            <OnboardingGuide />

            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between bg-zinc-900 p-8 md:p-10 rounded-[32px] text-white relative overflow-hidden shadow-2xl gap-6">
                <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2" />
                <div className="relative z-10">
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                        <h1 className="text-3xl md:text-4xl font-black mb-3 flex items-center gap-3">
                            创作者面板 <RiseOutlined className="text-indigo-400" />
                        </h1>
                        <p className="text-zinc-400 text-lg">
                            {dayjs().hour() < 12 ? '早安' : dayjs().hour() < 18 ? '下午好' : '晚上好'}，
                            今天是 {dayjs().format('YYYY年M月D日 dddd')}
                        </p>
                    </motion.div>
                </div>
                <div className="relative z-10 flex gap-4">
                    <Button
                        type="primary"
                        size="large"
                        icon={hasCheckedIn ? <CheckCircleOutlined /> : <FireOutlined />}
                        onClick={() => setShowCheckIn(true)}
                        className={clsx("h-12 md:h-14 px-6 md:px-8 rounded-2xl font-bold border-none transition-all", hasCheckedIn ? "bg-zinc-800 text-green-500" : "bg-orange-500 hover:scale-105")}
                    >
                        {hasCheckedIn ? '已签到' : '每日签到'}
                    </Button>
                    <Button
                        type="primary"
                        size="large"
                        icon={<PlusOutlined />}
                        onClick={() => router.push('/create')}
                        className="h-12 md:h-14 px-6 md:px-8 rounded-2xl font-bold bg-indigo-600 border-none hover:bg-indigo-500 hover:scale-105 transition-all shadow-lg shadow-indigo-500/20"
                    >
                        新建创作
                    </Button>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: '今日发布', value: dashboardData.stats.todayPublishes, icon: <CalendarOutlined />, color: 'blue', suffix: '篇' },
                    { label: '累计粉丝', value: dashboardData.stats.totalFollowers.toLocaleString(), icon: <UserOutlined />, color: 'rose', suffix: '' },
                    { label: '当前积分', value: balance, icon: <GiftOutlined />, color: 'amber', suffix: 'pts' },
                    { label: '总创作数', value: dashboardData.stats.contentCount, icon: <CloudOutlined />, color: 'indigo', suffix: '个' },
                ].map((item, idx) => (
                    <motion.div key={item.label} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: idx * 0.1 }}>
                        <Card className="rounded-3xl border-none shadow-sm hover:shadow-md transition-shadow h-full">
                            <div className={clsx("w-12 h-12 rounded-2xl flex items-center justify-center mb-4", `bg-${item.color}-50 text-${item.color}-500 text-xl`)}>
                                {item.icon}
                            </div>
                            <h3 className="text-3xl font-black text-zinc-900">{item.value}<span className="text-sm font-normal text-zinc-400 ml-1">{item.suffix}</span></h3>
                            <p className="text-zinc-500 font-medium">{item.label}</p>
                        </Card>
                    </motion.div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Tasks & Activity Section */}
                <div className="lg:col-span-2 space-y-6">
                    <Card title={<div className="flex items-center gap-2"><SyncOutlined /> 今日发布计划</div>} className="rounded-3xl border-none shadow-sm" extra={<Button type="link" onClick={() => router.push('/schedule')}>更多排期 <RightOutlined /></Button>}>
                        <div className="space-y-4">
                            {isLoading ? <div className="py-12 text-center"><LoadingOutlined className="text-3xl text-indigo-500" /></div> :
                                todayTasks.length > 0 ? todayTasks.map((task, idx) => (
                                    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.1 }} key={task.id} className="group p-5 rounded-2xl border border-zinc-100 flex items-center justify-between hover:bg-zinc-50 transition-all cursor-pointer">
                                        <div className="flex items-center gap-5">
                                            <div className="w-12 h-12 rounded-xl bg-zinc-100 flex items-center justify-center text-xl grayscale group-hover:grayscale-0 transition-all">
                                                {PLATFORM_MAP[task.platform]?.icon || '🌐'}
                                            </div>
                                            <div>
                                                <h4 className={clsx("font-bold text-zinc-800", task.status === 'completed' && "text-zinc-400 line-through")}>{task.title}</h4>
                                                <div className="flex items-center gap-3 mt-1">
                                                    <Tag className="m-0 border-none bg-zinc-200/50 text-zinc-500 rounded-md py-0.5">{task.time}</Tag>
                                                    <Badge status={task.status === 'completed' ? 'success' : 'processing'} text={task.status === 'completed' ? '已发布' : '等待中'} className="text-[11px]" />
                                                </div>
                                            </div>
                                        </div>
                                        {task.status === 'pending' && <Button shape="round" className="opacity-0 group-hover:opacity-100 transition-opacity font-bold" onClick={(e) => { e.stopPropagation(); message.success('发布指令已下达'); }}>立即发布</Button>}
                                    </motion.div>
                                )) : <Empty description="今日暂无发布计划" className="py-8" />}
                        </div>
                    </Card>

                    <Card title="📣 最近动态" className="rounded-3xl border-none shadow-sm">
                        <div className="space-y-4">
                            {dashboardData.recentActivities?.length > 0 ? dashboardData.recentActivities.map((act: any, idx: number) => (
                                <div key={idx} className="flex items-center gap-4 p-3 hover:bg-zinc-50 rounded-xl transition-colors">
                                    <div className={clsx("w-2 h-2 rounded-full", act.type === 'publish' ? "bg-green-500" : "bg-indigo-500")} />
                                    <div className="flex-1">
                                        <p className="text-sm font-bold text-zinc-800">{act.title}</p>
                                        <p className="text-xs text-zinc-400">{dayjs(act.created_at).fromNow()} • {act.type === 'publish' ? '发布成功' : '创作完成'}</p>
                                    </div>
                                    <Tag>{PLATFORM_MAP[act.platform]?.icon || '✨'}</Tag>
                                </div>
                            )) : <div className="text-center text-zinc-400 py-4">暂无最近动态</div>}
                        </div>
                    </Card>
                </div>

                {/* Profile/Quick Info Section */}
                <div className="space-y-6">
                    <Card className="rounded-3xl border-none shadow-sm text-center p-6 bg-gradient-to-b from-white to-zinc-50">
                        <div className="relative inline-block mb-4">
                            <Avatar size={100} className="bg-indigo-500 ring-8 ring-indigo-50 shadow-xl" icon={<UserOutlined />} />
                            <div className="absolute bottom-0 right-0 w-8 h-8 bg-amber-400 rounded-full border-4 border-white flex items-center justify-center text-xs text-white font-bold">
                                <TrophyOutlined />
                            </div>
                        </div>
                        <h4 className="text-xl font-black text-zinc-800">Lv.{levelProgress.level} 黄金播种者</h4>
                        <div className="mt-6 text-left space-y-2">
                            <div className="flex justify-between text-xs font-bold text-zinc-500">
                                <span>经验值 {levelProgress.currentXP} / {levelProgress.xpForNextLevel}</span>
                                <span className="text-indigo-600">{Math.round((levelProgress.currentXP / levelProgress.xpForNextLevel) * 100)}%</span>
                            </div>
                            <Progress percent={Math.round((levelProgress.currentXP / levelProgress.xpForNextLevel) * 100)} showInfo={false} strokeColor="#6366f1" strokeWidth={10} className="m-0" />
                        </div>
                        <p className="text-zinc-400 text-xs mt-6 px-4">再获得 {levelProgress.xpForNextLevel - levelProgress.currentXP} XP 即可解锁「多端定时自动分发」功能</p>
                    </Card>

                    <Card title="⚡ 创作工具箱" className="rounded-3xl border-none shadow-sm" styles={{ body: { padding: '12px' } }}>
                        <div className="grid grid-cols-2 gap-2">
                            {[
                                { icon: '📝', name: '文章生成', path: '/create', color: 'indigo' },
                                { icon: '🎞️', name: '视频切片', path: '/video-studio', color: 'purple' },
                                { icon: '🎨', name: '封面设计', path: '/materials', color: 'rose' },
                                { icon: '🏷️', name: '标签建议', path: '/hot', color: 'amber' },
                            ].map(item => (
                                <div key={item.name} onClick={() => router.push(item.path)} className="p-5 rounded-2xl hover:bg-zinc-50 cursor-pointer flex flex-col items-center transition-all group">
                                    <div className="text-3xl mb-2 group-hover:scale-110 transition-transform">{item.icon}</div>
                                    <div className="text-[11px] font-bold text-zinc-600">{item.name}</div>
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>
            </div>

            <CheckInModal visible={showCheckIn} onClose={() => setShowCheckIn(false)} />
        </div>
    );
}
