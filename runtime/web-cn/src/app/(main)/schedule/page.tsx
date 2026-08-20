'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Card, Empty, Segmented, Select, Skeleton, Table, Tag } from 'antd';
import { CalendarOutlined, ReloadOutlined, UnorderedListOutlined } from '@ant-design/icons';
import Link from 'next/link';
import dayjs, { Dayjs } from 'dayjs';
import { apiClient } from '@/lib/api-client';

interface ApiTask {
    id: string;
    status: string;
    scheduled_at?: string;
    platform_post_url?: string;
    error_message?: string;
    content?: { title?: string; cover_url?: string };
    platform_account?: { platform?: string; account_name?: string; account_nickname?: string };
}

const STATUS_LABELS: Record<string, string> = {
    pending: '待排期',
    queued: '已入队',
    processing: '发布中',
    submitted_unconfirmed: '等待远端确认',
    published: '已发布',
    failed: '失败',
    cancelled: '已取消',
};

function unwrapTasks(response: any): ApiTask[] {
    const payload = response?.data ?? response;
    return Array.isArray(payload?.tasks) ? payload.tasks : [];
}

function statusBadge(status: string) {
    if (status === 'published') return 'success';
    if (status === 'failed') return 'error';
    if (status === 'cancelled') return 'default';
    return 'processing';
}

function calendarDays(month: Dayjs) {
    const result: Array<{ date: string | null; day: number | null }> = [];
    for (let index = 0; index < month.startOf('month').day(); index += 1) {
        result.push({ date: null, day: null });
    }
    for (let day = 1; day <= month.daysInMonth(); day += 1) {
        result.push({ date: month.date(day).format('YYYY-MM-DD'), day });
    }
    return result;
}

export default function SchedulePage() {
    const [view, setView] = useState<'month' | 'list'>('month');
    const [status, setStatus] = useState('all');
    const [month] = useState(dayjs());
    const [selectedDate, setSelectedDate] = useState(dayjs().format('YYYY-MM-DD'));
    const [tasks, setTasks] = useState<ApiTask[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const query = status === 'all' ? '' : `?status=${encodeURIComponent(status)}`;
            setTasks(unwrapTasks(await apiClient.get(`/publish/tasks${query}`)));
        } catch (loadError) {
            setTasks([]);
            setError(loadError instanceof Error ? loadError.message : '排期加载失败');
        } finally {
            setLoading(false);
        }
    }, [status]);

    useEffect(() => { void load(); }, [load]);

    const days = useMemo(() => calendarDays(month), [month]);
    const tasksOn = (date: string | null) => tasks.filter(task => task.scheduled_at && dayjs(task.scheduled_at).format('YYYY-MM-DD') === date);

    if (loading) return <Skeleton active paragraph={{ rows: 8 }} />;

    return (
        <div className="max-w-[1400px] mx-auto space-y-6">
            <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-2xl font-bold">排期日历</h1>
                    <p className="text-sm text-zinc-500 mt-1">仅展示服务端保存的真实任务和远端确认状态</p>
                </div>
                <div className="flex flex-wrap gap-3">
                    <Select value={status} onChange={setStatus} style={{ width: 160 }} options={[
                        { value: 'all', label: '全部状态' },
                        ...Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label })),
                    ]} />
                    <Segmented value={view} onChange={(value) => setView(value as 'month' | 'list')} options={[
                        { label: '日历', value: 'month', icon: <CalendarOutlined /> },
                        { label: '列表', value: 'list', icon: <UnorderedListOutlined /> },
                    ]} />
                    <Button icon={<ReloadOutlined />} onClick={() => void load()}>刷新</Button>
                    <Link href="/studio"><Button type="primary">创建内容并排期</Button></Link>
                </div>
            </header>

            {error && <Alert type="error" showIcon message="无法加载真实排期" description={error} />}

            {!error && tasks.length === 0 ? (
                <Card><Empty description="暂无真实排期任务"><Link href="/studio"><Button type="primary">创建第一条任务</Button></Link></Empty></Card>
            ) : view === 'list' ? (
                <Table<ApiTask>
                    rowKey="id"
                    dataSource={tasks}
                    pagination={{ pageSize: 20 }}
                    columns={[
                        { title: '内容', render: (_, task) => task.content?.title || '未命名内容' },
                        { title: '账号', render: (_, task) => [task.platform_account?.platform, task.platform_account?.account_nickname || task.platform_account?.account_name].filter(Boolean).join(' · ') || '账号信息不可用' },
                        { title: '时间', render: (_, task) => task.scheduled_at ? dayjs(task.scheduled_at).format('YYYY-MM-DD HH:mm') : '未设置' },
                        { title: '状态', render: (_, task) => <Badge status={statusBadge(task.status)} text={STATUS_LABELS[task.status] || task.status} /> },
                        { title: '远端证据', render: (_, task) => task.status === 'published' && task.platform_post_url ? <a href={task.platform_post_url} target="_blank" rel="noreferrer">查看链接</a> : <span className="text-zinc-400">尚无</span> },
                    ]}
                />
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
                    <div className="grid grid-cols-7 gap-px bg-zinc-200 rounded-2xl overflow-hidden border border-zinc-200">
                        {['日', '一', '二', '三', '四', '五', '六'].map(label => <div key={label} className="bg-zinc-50 py-3 text-center text-xs font-bold text-zinc-400">{label}</div>)}
                        {days.map((item, index) => (
                            <button
                                key={`${item.date}-${index}`}
                                type="button"
                                disabled={!item.date}
                                onClick={() => item.date && setSelectedDate(item.date)}
                                className={`min-h-28 p-2 text-left bg-white ${item.date === selectedDate ? 'ring-2 ring-inset ring-indigo-500' : ''} ${!item.date ? 'opacity-40' : ''}`}
                            >
                                <span className="text-xs text-zinc-500">{item.day}</span>
                                <div className="mt-2 space-y-1">
                                    {tasksOn(item.date).slice(0, 3).map(task => <Tag key={task.id} color={task.status === 'failed' ? 'red' : task.status === 'published' ? 'green' : 'blue'} className="block truncate m-0">{task.content?.title || '未命名内容'}</Tag>)}
                                </div>
                            </button>
                        ))}
                    </div>
                    <Card title={<span>当日任务 <Tag>{selectedDate}</Tag></span>}>
                        {tasksOn(selectedDate).length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="无排期任务" /> : tasksOn(selectedDate).map(task => (
                            <div key={task.id} className="border-b border-zinc-100 py-3 last:border-0">
                                <div className="text-sm font-medium">{task.content?.title || '未命名内容'}</div>
                                <Badge status={statusBadge(task.status)} text={STATUS_LABELS[task.status] || task.status} />
                            </div>
                        ))}
                    </Card>
                </div>
            )}
        </div>
    );
}
