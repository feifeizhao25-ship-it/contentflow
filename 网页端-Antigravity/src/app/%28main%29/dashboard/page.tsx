'use client';

import React, { useState, useEffect } from 'react';
import { Row, Col, Progress, Badge, Tooltip, Spin, message, Button } from 'antd';
import {
    ArrowUpOutlined,
    EyeOutlined,
    FileTextOutlined,
    ThunderboltFilled,
    RightOutlined,
    PlusOutlined,
    SendOutlined,
    BarChartOutlined,
    FireFilled,
    VideoCameraAddOutlined,
    StarFilled,
    RobotOutlined,
    HistoryOutlined,
    BulbOutlined,
    GlobalOutlined,
    CrownFilled,
    LoadingOutlined,
    CalendarOutlined
} from '@ant-design/icons';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { usePermissions } from '@/hooks/usePermissions';
import { getUserPoints } from '@/lib/points-service';
import { getUserMaterials, Material } from '@/lib/materials-service';

export default function DashboardPage() {
    const router = useRouter();
    const { subscription, isPremium, plan, limits } = usePermissions();

    const [loading, setLoading] = useState(true);
    const [userPoints, setUserPoints] = useState({ balance: 0, level: 1 });
    const [userStats, setUserStats] = useState({
        totalContents: 0,
        totalMaterials: 0,
        totalViews: 0
    });

    // 每日灵感
    const dailyInspirations = [
        { id: 1, title: 'AI 视频生成的 10 个爆款技巧', trend: '+125%', category: '教学', time: '10:00' },
        { id: 2, title: '春节礼物推荐：如何用 AI 筛选好物', trend: '+89%', category: '带货', time: '12:00' },
        { id: 3, title: 'DeepSeek 满分提示词大公开', trend: '+210%', category: '科技', time: '18:00' },
    ];

    // 核心指标
    const stats = [
        { label: '本周播放', value: '12.8k', trend: '+12%', icon: <EyeOutlined />, color: 'text-indigo-500', bg: 'bg-indigo-50' },
        { label: '内容总数', value: '142', trend: '+3', icon: <FileTextOutlined />, color: 'text-emerald-500', bg: 'bg-emerald-50' },
        { label: '粉丝增长', value: '852', trend: '+45', icon: <StarFilled />, color: 'text-amber-500', bg: 'bg-amber-50' },
        { label: '分发平台', value: '6', trend: '稳定', icon: <GlobalOutlined />, color: 'text-rose-500', bg: 'bg-rose-50' },
    ];

    return (
        <div className="space-y-8 max-w-7xl mx-auto pb-12">
            {/* 顶层：欢迎与快捷入口 */}
            <section className="relative overflow-hidden rounded-3xl bg-zinc-900 p-8 md:p-12 text-white shadow-2xl">
                {/* 背景光效 */}
                <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/20 blur-[100px] -z-0" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/10 blur-[80px] -z-0" />

                <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
                    <div className="space-y-4 text-center md:text-left">
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                        >
                            <span className="px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-medium border border-indigo-500/30">
                                🚀 今日灵感已就绪
                            </span>
                            <h1 className="text-3xl md:text-5xl font-bold mt-4 leading-tight">
                                准备好创作下一个<br />
                                <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">千万级爆款</span>了吗？
                            </h1>
                            <p className="text-zinc-400 text-lg mt-4 max-w-lg">
                                基于全网热点为您智能匹配了 5 条高转化选题，立即开始您的艺术创作。
                            </p>

                            {/* 新手引导快捷入口 */}
                            <div className="mt-8 p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm flex items-center gap-4 text-left max-w-md mx-auto md:mx-0">
                                <div className="w-12 h-12 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-400 flex-shrink-0">
                                    <BulbOutlined className="text-xl" />
                                </div>
                                <div className="flex-1">
                                    <div className="text-sm font-bold">新手必看：如何快速发布第一条内容？</div>
                                    <div className="text-xs text-zinc-500">完成 3 分钟引导即可获得 50 积分奖励</div>
                                </div>
                                <Button
                                    type="link"
                                    onClick={() => router.push('/onboarding')}
                                    className="text-indigo-400 p-0 flex items-center gap-1 font-bold"
                                >
                                    去完成 <RightOutlined className="text-[10px]" />
                                </Button>
                            </div>
                        </motion.div>
                    </div>

                    <div className="flex flex-col gap-4 w-full md:w-auto">
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => router.push('/studio')}
                            className="px-8 py-4 bg-white text-zinc-900 rounded-2xl font-bold flex items-center justify-center gap-3 shadow-xl hover:bg-zinc-100 transition-all"
                        >
                            <ThunderboltFilled className="text-xl text-indigo-600" />
                            开启极速创作
                        </motion.button>
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => router.push('/schedule')}
                            className="px-8 py-4 bg-zinc-800 text-white rounded-2xl font-bold flex items-center justify-center gap-3 border border-zinc-700 hover:bg-zinc-700 transition-all"
                        >
                            <CalendarOutlined />
                            查看发布排期
                        </motion.button>
                    </div>
                </div>
            </section>

            {/* 中层：灵感雷达 与 创作任务 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* 每日灵感雷达 */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <BulbOutlined className="text-amber-500 text-xl" />
                            <h3 className="text-xl font-bold text-zinc-900">灵感雷达</h3>
                        </div>
                        <button className="text-indigo-600 text-sm font-medium hover:underline">查看更多热点 →</button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {dailyInspirations.map((item, i) => (
                            <motion.div
                                key={item.id}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.1 }}
                                className="group bg-white p-5 rounded-2xl border border-zinc-200 hover:border-indigo-500 hover:shadow-xl hover:shadow-indigo-500/10 transition-all cursor-pointer"
                            >
                                <div className="flex justify-between items-start mb-3">
                                    <span className="px-2 py-0.5 rounded-lg bg-zinc-100 text-zinc-500 text-[10px] font-bold uppercase">
                                        {item.category}
                                    </span>
                                    <span className="text-emerald-500 text-xs font-bold flex items-center gap-1">
                                        <ArrowUpOutlined /> {item.trend}
                                    </span>
                                </div>
                                <h4 className="font-bold text-zinc-900 group-hover:text-indigo-600 transition-colors line-clamp-2">
                                    {item.title}
                                </h4>
                                <div className="mt-4 flex items-center justify-between">
                                    <span className="text-zinc-400 text-xs">建议发布：今日 {item.time}</span>
                                    <button className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                                        <PlusOutlined />
                                    </button>
                                </div>
                            </motion.div>
                        ))}
                        <div className="bg-indigo-600 rounded-2xl p-6 text-white flex flex-col justify-between items-center text-center relative overflow-hidden group">
                            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.1),transparent_70%)] animate-pulse" />
                            <FireFilled className="text-4xl mb-2 text-amber-400" />
                            <h4 className="font-bold">探索全网实时热议</h4>
                            <p className="text-indigo-100 text-xs mt-2">实时抓取抖音/小红书/微博爆款话题</p>
                            <button className="mt-4 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-xl text-sm transition-all">立即前往</button>
                        </div>
                    </div>
                </div>

                {/* 账号活跃度与额度 */}
                <div className="space-y-6">
                    <h3 className="text-xl font-bold text-zinc-900">创作状态</h3>
                    <div className="bg-white rounded-3xl border border-zinc-200 p-6 space-y-6">
                        {/* AI 额度 */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-zinc-600">AI 创作次数</span>
                                <span className="text-zinc-900 font-bold">16/20 <span className="text-zinc-400 text-xs font-normal">次</span></span>
                            </div>
                            <Progress percent={80} showInfo={false} strokeColor="#6366f1" railColor="#f3f4f6" />
                            <p className="text-[10px] text-zinc-400 mt-2">您的免费配额将在 7 天后刷新</p>
                        </div>

                        {/* 常用平台 */}
                        <div className="pt-6 border-t border-zinc-100">
                            <span className="text-sm font-medium text-zinc-600 block mb-4">活跃平台概览</span>
                            <div className="space-y-4">
                                {[
                                    { name: '小红书', status: '正常', color: 'bg-red-500', icon: '📕' },
                                    { name: '抖音', status: '未连接', color: 'bg-zinc-900/10', icon: '🎵', warning: true },
                                    { name: '微信公众号', status: '正常', color: 'bg-green-500', icon: '💬' },
                                ].map(p => (
                                    <div key={p.name} className="flex items-center justify-between p-2 rounded-xl hover:bg-zinc-50 transition-all cursor-pointer">
                                        <div className="flex items-center gap-3">
                                            <div className={clsx("w-8 h-8 rounded-lg flex items-center justify-center text-white", p.color)}>
                                                <span className="text-xs">{p.icon}</span>
                                            </div>
                                            <span className="text-sm font-medium text-zinc-900">{p.name}</span>
                                        </div>
                                        {p.warning ? (
                                            <Button size="small" type="primary" className="h-6 text-[10px] rounded-full bg-indigo-500 border-none">连接</Button>
                                        ) : (
                                            <span className="text-xs text-zinc-400">{p.status}</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <button
                            onClick={() => router.push('/pricing')}
                            className="w-full py-3 bg-amber-50 text-amber-600 rounded-xl text-sm font-bold border border-amber-200 hover:bg-amber-100 transition-all"
                        >
                            升级专业版 解锁 4K 导出
                        </button>
                    </div>
                </div>
            </div>

            {/* 底层：效能中心 */}
            <section className="space-y-6">
                <div className="flex items-center gap-2">
                    <BarChartOutlined className="text-indigo-500 text-xl" />
                    <h3 className="text-xl font-bold text-zinc-900">效能简报</h3>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {stats.map((stat, i) => (
                        <motion.div
                            key={i}
                            whileHover={{ y: -5 }}
                            className="bg-white p-6 rounded-3xl border border-zinc-200"
                        >
                            <div className="flex items-center gap-3 mb-4">
                                <span className={clsx("p-2 rounded-xl", stat.bg)}>
                                    {React.cloneElement(stat.icon as React.ReactElement<{ className?: string }>, {
                                        className: clsx("text-lg", stat.color)
                                    })}
                                </span>
                                <span className="text-sm text-zinc-500">{stat.label}</span>
                            </div>
                            <div className="flex items-baseline justify-between">
                                <span className="text-3xl font-bold text-zinc-900">{stat.value}</span>
                                <span className={clsx("text-xs font-bold",
                                    stat.trend.startsWith('+') ? "text-emerald-500" : "text-zinc-400"
                                )}>
                                    {stat.trend}
                                </span>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </section>

            {/* 最近活跃任务 */}
            <section className="bg-white rounded-3xl border border-zinc-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-zinc-200 flex items-center justify-between bg-zinc-50/50">
                    <div className="flex items-center gap-2">
                        <HistoryOutlined className="text-zinc-400" />
                        <h3 className="font-bold text-zinc-900">正在进行的创作</h3>
                    </div>
                    <button className="text-xs text-zinc-500 font-medium">查看内容中心 →</button>
                </div>
                <div className="divide-y divide-zinc-100">
                    {[
                        { title: '零基础 AI 视频教程脚本', state: '分镜生成中', progress: 45, time: '2分钟前' },
                        { title: '小红书 2026 美妆趋势预测', state: '待分发', progress: 100, time: '1小时前' },
                        { title: '如何利用 DeepSeek 优化工作流', state: '已发布', progress: 100, time: '3小时前' },
                    ].map((task, i) => (
                        <div key={i} className="p-4 flex items-center justify-between hover:bg-zinc-50 transition-colors">
                            <div className="flex-1 min-w-0 pr-8">
                                <h5 className="font-medium text-zinc-900 truncate">{task.title}</h5>
                                <div className="flex items-center gap-3 mt-1">
                                    <span className="text-[10px] text-zinc-400">{task.time}</span>
                                    <span className={clsx("text-[10px] font-bold px-1.5 py-0.5 rounded",
                                        task.progress < 100 ? "bg-indigo-50 text-indigo-600" : "bg-emerald-50 text-emerald-600"
                                    )}>
                                        {task.state}
                                    </span>
                                </div>
                            </div>
                            <div className="w-24">
                                <Progress percent={task.progress} size="small" showInfo={false} strokeColor={task.progress < 100 ? "#6366f1" : "#10b981"} />
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
}
