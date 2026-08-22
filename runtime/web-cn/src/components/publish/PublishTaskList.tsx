'use client';

import React, { useEffect, useState } from 'react';
import { Button, Empty, Skeleton, Tag, message } from 'antd';
import {
    CheckCircleFilled,
    CloseCircleFilled,
    SyncOutlined,
    ClockCircleFilled,
    RightOutlined,
    DownOutlined,
    WarningFilled,
    ReloadOutlined,
    LinkOutlined
} from '@ant-design/icons';
import clsx from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';

import { apiClient } from '@/lib/api-client';

type PublishTask = {
    id: string;
    title: string;
    platform: string;
    account: string;
    status: string;
    time: string;
    date: string;
    error?: string;
};

export const PublishTaskList = () => {
    const [expandedRow, setExpandedRow] = useState<string | null>(null);
    const [tasks, setTasks] = useState<PublishTask[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        apiClient.get<any[]>('/publish/tasks')
            .then((rows) => setTasks((rows || []).map((task: any) => {
                const scheduledAt = task.scheduled_at ? new Date(task.scheduled_at) : null;
                return {
                    id: String(task.id),
                    title: task.content?.title || '未命名内容',
                    platform: task.platform || 'unknown',
                    account: task.account?.display_name || task.account?.name || '未绑定账号',
                    status: task.status || 'pending',
                    date: scheduledAt ? scheduledAt.toLocaleDateString('zh-CN') : '尚未排期',
                    time: scheduledAt ? scheduledAt.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '',
                    error: task.error_message,
                };
            })))
            .catch(() => message.error('发布任务加载失败，请稍后重试'))
            .finally(() => setLoading(false));
    }, []);

    const toggleRow = (id: string) => {
        setExpandedRow(expandedRow === id ? null : id);
    };

    const getStatusConfig = (status: string) => {
        switch (status) {
            case 'success': return { color: 'green', icon: <CheckCircleFilled />, text: '发布成功' };
            case 'failed': return { color: 'red', icon: <CloseCircleFilled />, text: '发布失败' };
            case 'publishing': return { color: 'blue', icon: <SyncOutlined spin />, text: '发布中' };
            default: return { color: 'zinc', icon: <ClockCircleFilled />, text: '待发布' };
        }
    };

    const getPlatformIcon = (key: string) => {
        const map: any = { douyin: '🎵', xhs: '📕', weixin: '💬', bilibili: '📺' };
        return map[key] || '📱';
    };

    if (loading) return <Skeleton active paragraph={{ rows: 4 }} />;
    if (tasks.length === 0) {
        return <Empty description="暂无发布任务。完成内容创作并选择平台后，任务会显示在这里。" />;
    }

    return (
        <div className="space-y-3">
            {tasks.map(task => {
                const status = getStatusConfig(task.status);
                const isFailed = task.status === 'failed';
                const isExpanded = expandedRow === task.id;

                return (
                    <div key={task.id} className="bg-white rounded-xl border border-zinc-200 overflow-hidden shadow-sm hover:shadow-md transition-all">
                        {/* Task Row */}
                        <div
                            className="p-4 flex items-center gap-4 cursor-pointer hover:bg-zinc-50/50"
                            onClick={() => isFailed && toggleRow(task.id)}
                        >
                            {/* Left: Icon & Title */}
                            <div className="flex items-center gap-4 flex-1 min-w-0">
                                <div className="w-10 h-10 rounded-lg bg-zinc-100 flex items-center justify-center text-xl">
                                    {getPlatformIcon(task.platform)}
                                </div>
                                <div>
                                    <div className="font-bold text-sm text-zinc-900 truncate">{task.title}</div>
                                    <div className="text-xs text-zinc-500">{task.account}</div>
                                </div>
                            </div>

                            {/* Center: Status & Time */}
                            <div className="w-48 flex flex-col items-center">
                                <Tag icon={status.icon} color={status.color} className="border-0 px-2 py-0.5 rounded-full text-xs font-medium">
                                    {status.text}
                                </Tag>
                                <div className="text-[10px] text-zinc-400 mt-1">
                                    {task.date} {task.time}
                                </div>
                            </div>

                            {/* Right: Actions */}
                            <div className="flex items-center gap-2 w-48 justify-end">
                                {task.status === 'success' && (
                                    <>
                                        <Button size="small" type="link">查看链接</Button>
                                        <Button size="small">复刻</Button>
                                    </>
                                )}
                                {task.status === 'failed' && (
                                    <>
                                        <Button
                                            size="small"
                                            type="primary"
                                            danger
                                            onClick={(e) => { e.stopPropagation(); toggleRow(task.id); }}
                                        >
                                            一键修复
                                        </Button>
                                        <Button size="small" icon={<RightOutlined rotate={isExpanded ? 90 : 0} />} type="text" />
                                    </>
                                )}
                                {task.status === 'publishing' && <Button size="small" loading>正在同步</Button>}
                            </div>
                        </div>

                        {/* Failure Detail Card (Expandable) */}
                        <AnimatePresence>
                            {isExpanded && isFailed && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="bg-red-50/50 border-t border-red-100"
                                >
                                    <div className="p-4 px-6 flex items-start gap-6">
                                        <div className="w-10 h-10 rounded-full bg-red-100 text-red-500 flex items-center justify-center flex-none">
                                            <WarningFilled className="text-xl" />
                                        </div>
                                        <div className="flex-1">
                                            <h4 className="font-bold text-red-600 mb-1">失败原因：{task.error}</h4>
                                            <p className="text-sm text-zinc-600 mb-4">建议：平台账号登录状态可能已过期，请重新绑定账号后重试。</p>

                                            <div className="flex gap-3 mb-4">
                                                <Button type="primary" danger icon={<LinkOutlined />}>重新绑定并重试 (推荐)</Button>
                                                <Button icon={<ReloadOutlined />}>仅重试</Button>
                                                <Button type="text" danger>取消任务</Button>
                                            </div>

                                            <div className="bg-red-100/50 p-3 rounded-lg text-[10px] font-mono text-pink-700">
                                                <div>ERROR_CODE: 401_UNAUTHORIZED</div>
                                                <div>TRACE_ID: req_8f9s8d9f8s9d8fs</div>
                                                <div>STEP: uploading_video</div>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                );
            })}
        </div>
    );
};
