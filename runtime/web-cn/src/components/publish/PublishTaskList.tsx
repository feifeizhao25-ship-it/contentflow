'use client';

import React, { useEffect, useState } from 'react';
import { Button, Empty, Input, Modal, Skeleton, Tag, message } from 'antd';
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
import { safeErrorText } from '@/lib/api-error';
import { buildCopyText, downloadLabelledCover, isManualPlatform, manualPlatformName, type ManualKit } from '@/lib/manual-publish';

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
                    platform: task.platform_account?.platform || task.platform_content?.platform || 'unknown',
                    // 人工确认发布的任务没有绑定账号：显示平台名与「人工发布」，不再显示「未命名账号」
                    account: task.platform_account
                        ? (task.platform_account.account_nickname || task.platform_account.account_name || '已授权账号')
                        : isManualPlatform(task.platform_content?.platform ?? '')
                            ? `${manualPlatformName(task.platform_content.platform)} · 人工发布`
                            : '未绑定账号',
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
            message.error(safeErrorText(error, '操作失败，请稍后重试'));
        }
    };

    // ── 人工确认发布：复制文案 / 下载封面 / 我已手动发布 ──
    const [kits, setKits] = useState<Record<string, ManualKit>>({});
    const [confirmTask, setConfirmTask] = useState<PublishTask | null>(null);
    const [postUrl, setPostUrl] = useState('');
    const [confirming, setConfirming] = useState(false);

    const loadKit = async (task: PublishTask): Promise<ManualKit> => {
        if (kits[task.id]) return kits[task.id];
        const kit = await apiClient.get<ManualKit>(`/publish/tasks/${task.id}/manual-kit`);
        setKits((current) => ({ ...current, [task.id]: kit }));
        return kit;
    };

    const copyText = async (task: PublishTask) => {
        try {
            const kit = await loadKit(task);
            await navigator.clipboard.writeText(buildCopyText(kit));
            message.success(kit.aiGenerated ? '文案已复制（含「AI 生成」标识，请勿删除）' : '文案已复制');
        } catch (error) {
            message.error(safeErrorText(error, '复制失败，请稍后重试'));
        }
    };

    const downloadCover = async (task: PublishTask) => {
        try {
            const kit = await loadKit(task);
            if (!kit.coverUrl) { message.info('这条内容还没有封面'); return; }
            await downloadLabelledCover(kit.coverUrl, `${kit.title || '封面'}-${kit.platformName}`, { contentId: kit.contentId, providerCode: kit.providerCode });
        } catch (error) {
            message.error(safeErrorText(error, '封面下载失败，请稍后重试'));
        }
    };

    const submitManualDone = async () => {
        if (!confirmTask) return;
        setConfirming(true);
        try {
            await apiClient.post(`/publish/tasks/${confirmTask.id}/manual-done`, postUrl.trim() ? { postUrl: postUrl.trim() } : {});
            message.success('已记录为「已人工发布」');
            setTasks(current => current.map(item => item.id === confirmTask.id ? { ...item, status: 'manual_done', externalUrl: postUrl.trim() || item.externalUrl } : item));
            setConfirmTask(null);
            setPostUrl('');
        } catch (error) {
            message.error(safeErrorText(error, '保存失败，请检查作品链接'));
        } finally {
            setConfirming(false);
        }
    };

    const getStatusConfig = (status: string) => {
        switch (status) {
            case 'manual_pending': return { color: 'orange', icon: <ClockCircleFilled />, text: '待人工发布' };
            case 'manual_done': return { color: 'green', icon: <CheckCircleFilled />, text: '已人工发布' };
            case 'submitted_unconfirmed': return { color: 'cyan', icon: <ClockCircleFilled />, text: '已提交待平台确认' };
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
        const map: any = { douyin: '🎵', xhs: '📕', weixin: '💬', wechat_mp: '📰', bilibili: '📺' };
        return map[key] || '📱';
    };

    if (loading) return <Skeleton active paragraph={{ rows: 4 }} />;
    if (tasks.length === 0) {
        return <Empty description="暂无发布任务。完成内容创作并选择平台后，任务会显示在这里。" />;
    }

    return (
        <div className="space-y-3">
            <Modal
                open={confirmTask !== null}
                title="确认已手动发布"
                okText="确认已发布"
                cancelText="取消"
                confirmLoading={confirming}
                onOk={() => void submitManualDone()}
                onCancel={() => setConfirmTask(null)}
            >
                <p className="text-sm text-zinc-600 mb-3">
                    请确认你已在{confirmTask ? manualPlatformName(confirmTask.platform) : '平台'}发出这条内容。可以粘贴作品链接（选填），分发侠只保存链接，不会去平台读取任何数据。
                </p>
                <Input
                    placeholder="作品链接（选填），以 https:// 开头"
                    value={postUrl}
                    onChange={(e) => setPostUrl(e.target.value)}
                    maxLength={500}
                />
            </Modal>
            {tasks.map(task => {
                const status = getStatusConfig(task.status);
                const isFailed = task.status === 'failed';
                const isExpanded = expandedRow === task.id;

                return (
                    <div key={task.id} className="bg-white rounded-xl border border-zinc-200 overflow-hidden shadow-sm hover:shadow-md transition-all">
                        {/* Task Row */}
                        <div
                            className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4 cursor-pointer hover:bg-zinc-50/50"
                            onClick={() => isFailed && toggleRow(task.id)}
                        >
                            {/* Left: Icon & Title（手机上标题占满一行，不再被右侧两栏挤掉） */}
                            <div className="flex items-center gap-4 flex-1 min-w-0">
                                <div className="w-10 h-10 shrink-0 rounded-lg bg-zinc-100 flex items-center justify-center text-xl">
                                    {getPlatformIcon(task.platform)}
                                </div>
                                <div className="min-w-0">
                                    <div className="font-bold text-sm text-zinc-900 break-words">{task.title}</div>
                                    <div className="text-xs text-zinc-500">{task.account}</div>
                                </div>
                            </div>

                            {/* Center: Status & Time */}
                            <div className="flex items-center gap-2 sm:w-48 sm:flex-col">
                                <Tag icon={status.icon} color={status.color} className="border-0 px-2 py-0.5 rounded-full text-xs font-medium">
                                    {status.text}
                                </Tag>
                                <div className="text-[10px] text-zinc-400 mt-1">
                                    {task.date} {task.time}
                                </div>
                            </div>

                            {/* Right: Actions */}
                            <div className="flex flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
                                {task.status === 'manual_pending' && (
                                    <>
                                        <Button size="small" onClick={(e) => { e.stopPropagation(); void copyText(task); }}>复制文案</Button>
                                        <Button size="small" onClick={(e) => { e.stopPropagation(); void downloadCover(task); }}>下载封面</Button>
                                        <Button size="small" type="primary" onClick={(e) => { e.stopPropagation(); setConfirmTask(task); setPostUrl(''); }}>我已手动发布</Button>
                                    </>
                                )}
                                {task.status === 'manual_done' && task.externalUrl && (
                                    <Button size="small" type="link" href={task.externalUrl} target="_blank" rel="noopener noreferrer">查看作品</Button>
                                )}
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
                                                <div>错误码：{task.errorCode || '未记录'}</div>
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
