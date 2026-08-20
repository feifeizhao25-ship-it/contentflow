'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Empty, Skeleton, Tag, message } from 'antd';
import {
    CheckCircleFilled,
    CloseCircleFilled,
    SyncOutlined,
    ClockCircleFilled,
    ReloadOutlined,
    LinkOutlined,
} from '@ant-design/icons';
import { apiClient } from '@/lib/api-client';

interface PublishTask {
    id: string;
    status: string;
    scheduled_at?: string;
    platform_post_url?: string;
    error_code?: string;
    error_message?: string;
    content?: { title?: string; cover_url?: string };
    platform_account?: {
        platform?: string;
        account_name?: string;
        account_nickname?: string;
    };
}

function unwrapTasks(response: any): PublishTask[] {
    const payload = response?.data ?? response;
    return Array.isArray(payload?.tasks) ? payload.tasks : [];
}

export const PublishTaskList = () => {
    const [tasks, setTasks] = useState<PublishTask[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [retrying, setRetrying] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setLoadError('');
        try {
            const response = await apiClient.get('/publish/tasks?pageSize=50');
            setTasks(unwrapTasks(response));
        } catch (error) {
            setLoadError(error instanceof Error ? error.message : '发布任务加载失败');
            setTasks([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void load(); }, [load]);

    const retry = async (taskId: string) => {
        setRetrying(taskId);
        try {
            await apiClient.post(`/publish/tasks/${taskId}/retry`, {});
            message.success('任务已重新进入发布队列');
            await load();
        } catch (error) {
            message.error(error instanceof Error ? error.message : '重试失败');
        } finally {
            setRetrying(null);
        }
    };

    const getStatus = (status: string) => {
        switch (status) {
            case 'published': return { color: 'green', icon: <CheckCircleFilled />, text: '发布成功' };
            case 'failed': return { color: 'red', icon: <CloseCircleFilled />, text: '发布失败' };
            case 'queued':
            case 'processing':
            case 'submitted_unconfirmed':
                return { color: 'blue', icon: <SyncOutlined spin={status !== 'submitted_unconfirmed'} />, text: status === 'submitted_unconfirmed' ? '等待远端确认' : '发布中' };
            default: return { color: 'default', icon: <ClockCircleFilled />, text: '待发布' };
        }
    };

    if (loading) return <Skeleton active paragraph={{ rows: 5 }} />;
    if (loadError) return <Alert type="error" showIcon message="无法加载发布任务" description={loadError} action={<Button onClick={() => void load()}>重试</Button>} />;
    if (tasks.length === 0) return <Empty description="暂无真实发布任务" />;

    return (
        <div className="space-y-3">
            {tasks.map((task) => {
                const status = getStatus(task.status);
                const account = task.platform_account;
                return (
                    <div key={task.id} className="bg-white rounded-xl border border-zinc-200 p-4 shadow-sm">
                        <div className="flex flex-col gap-3 md:flex-row md:items-center">
                            <div className="flex-1 min-w-0">
                                <div className="font-bold text-sm text-zinc-900 truncate">{task.content?.title || '未命名内容'}</div>
                                <div className="text-xs text-zinc-500">
                                    {[account?.platform, account?.account_nickname || account?.account_name].filter(Boolean).join(' · ') || '账号信息不可用'}
                                </div>
                            </div>
                            <Tag icon={status.icon} color={status.color}>{status.text}</Tag>
                            <div className="text-xs text-zinc-500">{task.scheduled_at ? new Date(task.scheduled_at).toLocaleString('zh-CN') : '未设置时间'}</div>
                            <div className="flex gap-2">
                                {task.platform_post_url && task.status === 'published' && (
                                    <Button href={task.platform_post_url} target="_blank" icon={<LinkOutlined />}>远端链接</Button>
                                )}
                                {task.status === 'failed' && (
                                    <Button loading={retrying === task.id} onClick={() => void retry(task.id)} icon={<ReloadOutlined />}>重试</Button>
                                )}
                            </div>
                        </div>
                        {task.status === 'failed' && (
                            <Alert
                                type="error"
                                showIcon
                                className="mt-3"
                                message={task.error_message || '远端发布失败'}
                                description={task.error_code ? `错误码：${task.error_code}` : undefined}
                            />
                        )}
                    </div>
                );
            })}
        </div>
    );
};
