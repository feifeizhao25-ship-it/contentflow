'use client';

import React, { useEffect, useState } from 'react';
import { Button, Empty, Skeleton, Tag, message } from 'antd';
import {
    CheckCircleFilled,
    CloseCircleFilled,
    SyncOutlined,
    ClockCircleFilled,
    RightOutlined,
    WarningFilled,
    ReloadOutlined,
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
    errorCode?: string;
    externalUrl?: string;
};

type PublishTaskResponse = { tasks: any[]; pagination: { total: number; page: number; pageSize: number; totalPages: number } };

export const PublishTaskList = () => {
    const [expandedRow, setExpandedRow] = useState<string | null>(null);
    const [tasks, setTasks] = useState<PublishTask[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        apiClient.get<PublishTaskResponse>('/publish/tasks')
            .then((result) => setTasks((result.tasks || []).map((task: any) => {
                const scheduledAt = task.scheduled_at ? new Date(task.scheduled_at) : null;
                return {
                    id: String(task.id),
                    title: task.content?.title || '未命名内容',
                    platform: task.platform_account?.platform || 'unknown',
                    account: task.platform_account?.account_nickname || task.platform_account?.account_name || '未命名账号',
                    status: task.status || 'pending',
                    date: scheduledAt ? scheduledAt.toLocaleDateString('zh-CN') : '尚未排期',
                    time: scheduledAt ? scheduledAt.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '',
                    error: task.error_message,
                    errorCode: task.error_code,
                    externalUrl: task.platform_post_url,
                };
            })))
            .catch(() => message.error('发布任务加载失败，请稍后重试'))
            .finally(() => setLoading(false));
    }, []);

    const toggleRow = (id: string) => {
        setExpandedRow(expandedRow === id ? null : id);
    };

    const runAction = async (task: PublishTask, action: 'retry' | 'cancel') => {
        try {
            await apiClient.post(`/publish/tasks/${task.id}/${action}`, {});
            message.success(action === 'retry' ? '任务已重新加入队列' : '任务已取消');
            setTasks(current => current.map(item => item.id === task.id ? { ...item, status: action === 'retry' ? 'queued' : 'cancelled' } : item));
            setExpandedRow(null);
        } catch (error) {
            message.error(error instanceof Error ? error.message : '操作失败，请稍后重试');
        }
    };

    const getStatusConfig = (status: string) => {
        switch (status) {
            case 'published': return { color: 'green', icon: <CheckCircleFilled />, text: '发布成功' };
            case 'submitted': return { color: 'cyan', icon: <ClockCircleFilled />, text: '平台审核中' };
            case 'failed': return { color: 'red', icon: <CloseCircleFilled />, text: '发布失败' };
            case 'processing': return { color: 'blue', icon: <SyncOutlined spin />, text: '发布中' };
            case 'cancelled': return { color: 'default', icon: <CloseCircleFilled />, text: '已取消' };
            case 'queued': return { color: 'gold', icon: <ClockCircleFilled />, text: '队列中' };
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
                                {task.status === 'published' && task.externalUrl && (
                                    <>
                                        <Button size="small" type="link" href={task.externalUrl} target="_blank" rel="noopener noreferrer">查看链接</Button>
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
                                {task.status === 'processing' && <Button size="small" loading>正在同步</Button>}
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
                                            <h4 className="font-bold text-red-600 mb-1">失败原因：{task.error || '平台未返回可识别的错误说明'}</h4>
                                            <p className="text-sm text-zinc-600 mb-4">请根据真实错误处理。账号授权或平台通道未恢复前，重复重试不会被标记为成功。</p>

                                            <div className="flex gap-3 mb-4">
                                                <Button icon={<ReloadOutlined />} onClick={() => runAction(task, 'retry')}>重试</Button>
                                                <Button type="text" danger onClick={() => runAction(task, 'cancel')}>取消任务</Button>
                                            </div>

                                            <div className="bg-red-100/50 p-3 rounded-lg text-[10px] font-mono text-pink-700">
                                                <div>ERROR_CODE: {task.errorCode || 'UNKNOWN'}</div>
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
