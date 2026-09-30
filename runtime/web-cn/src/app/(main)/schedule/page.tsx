'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import {
    Button, Card, Tag, Modal, Form, Input, Select, message, Empty,
    Segmented, Table, Badge, Tooltip, Avatar, Divider, Space
} from 'antd';
import {
    CalendarOutlined,
    PlusOutlined,
    ClockCircleOutlined,
    EditOutlined,
    DeleteOutlined,
    CheckCircleOutlined,
    ExclamationCircleOutlined,
    UnorderedListOutlined,
    GlobalOutlined,
    FilterOutlined,
    AppstoreOutlined,
    ExclamationCircleFilled,
    LoadingOutlined
} from '@ant-design/icons';
import { motion, AnimatePresence } from 'framer-motion';
import { useThemeStore } from '@/store/themeStore';
import { apiClient } from '@/lib/api-client';
import { mapPublishTasks, type CalendarTask } from '@/lib/page-data';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import clsx from 'clsx';
import dayjs from 'dayjs';

const { TextArea } = Input;
const { Option } = Select;

// ==================== Types ====================
type PublishTask = CalendarTask;

const STATUS_BADGE: Record<CalendarTask['status'], { badge: 'processing' | 'success' | 'error' | 'default'; text: string }> = {
    scheduled: { badge: 'processing', text: '待发布' },
    published: { badge: 'success', text: '已发布' },
    failed: { badge: 'error', text: '发布失败' },
    cancelled: { badge: 'default', text: '已取消' },
};

const PLATFORMS = [
    { id: 'xhs', name: '小红书', color: '#ef4444', icon: '📕' },
    { id: 'douyin', name: '抖音', color: '#1a1a1a', icon: '🎵' },
    { id: 'weixin', name: '视频号', color: '#07c160', icon: '💬' },
    { id: 'weibo', name: '微博', color: '#f59e0b', icon: '👁️' },
    { id: 'bilibili', name: 'B站', color: '#00a1d6', icon: '📺' },
    { id: 'zhihu', name: '知乎', color: '#0066ff', icon: '💡' },
];

// ==================== Utils ====================
const getCalendarDays = (currentDate: dayjs.Dayjs) => {
    const days = [];
    const startOfMonth = currentDate.startOf('month');
    const endOfMonth = currentDate.endOf('month');
    const startDay = startOfMonth.day();
    const daysInMonth = endOfMonth.date();

    for (let i = 0; i < startDay; i++) {
        days.push({ date: null, day: null, isCurrentMonth: false });
    }
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = currentDate.date(day).format('YYYY-MM-DD');
        days.push({
            date: dateStr,
            day,
            isCurrentMonth: true,
            isToday: dateStr === dayjs().format('YYYY-MM-DD'),
        });
    }
    return days;
};

// ==================== Main Component ====================
export default function SchedulePage() {
    const { isDark } = useThemeStore();
    const searchParams = useSearchParams();
    const initialView = (searchParams.get('view') === 'list' ? 'list' : 'month') as 'month' | 'list';
    const [viewMode, setViewMode] = useState<'month' | 'list'>(initialView);
    const [currentMonth, setCurrentMonth] = useState(dayjs());
    const [isLoading, setIsLoading] = useState(false);
    const [tasks, setTasks] = useState<PublishTask[]>([]);
    const [selectedDate, setSelectedDate] = useState<string | null>(dayjs().format('YYYY-MM-DD'));
    const [filterPlatform, setFilterPlatform] = useState<string>('all');

    useEffect(() => {
        const view = searchParams.get('view');
        if (view === 'list' || view === 'month') {
            setViewMode(view);
        }
    }, [searchParams]);

    const fetchTasks = useCallback(async () => {
        setIsLoading(true);
        try {
            // 平台筛选在前端做（filterPlatform 是平台，不是任务状态）；后端返回 { tasks, pagination }
            const res = await apiClient.get<any>('/publish/tasks?pageSize=100');
            setTasks(mapPublishTasks(res));
        } catch (e) {
            console.error('Failed to fetch tasks', e);
            message.error('发布任务加载失败，请稍后重试');
            setTasks([]);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        void fetchTasks();
    }, [fetchTasks]);

    const filteredTasks = filterPlatform === 'all' ? tasks : tasks.filter(t => t.platforms.includes(filterPlatform));
    const calendarDays = getCalendarDays(currentMonth);

    const getTasksForDate = (date: string | null) => filteredTasks.filter(task => task.date === date);

    const hasConflict = (task: PublishTask) => {
        return tasks.some(t => t.id !== task.id && t.date === task.date && t.time === task.time);
    };

    const handleDateClick = (date: string | null) => {
        if (date) setSelectedDate(date);
    };

    // Monthly View
    const renderMonthView = () => (
        <div className="grid grid-cols-7 gap-px bg-zinc-200 dark:bg-zinc-800 rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-sm relative">
            {isLoading && <div className="absolute inset-0 bg-white/50 dark:bg-black/50 z-20 flex items-center justify-center"><LoadingOutlined className="text-3xl text-indigo-500" /></div>}
            {['日', '一', '二', '三', '四', '五', '六'].map(d => (
                <div key={d} className="bg-zinc-50 dark:bg-zinc-900/[0.4] py-3 text-center text-xs font-bold text-zinc-400">{d}</div>
            ))}
            {calendarDays.map((day, i) => {
                const dayTasks = getTasksForDate(day.date);
                const isSelected = selectedDate === day.date;
                return (
                    <div
                        key={i}
                        onClick={() => handleDateClick(day.date)}
                        className={clsx(
                            "min-h-[120px] p-2 transition-all cursor-pointer relative",
                            day.isCurrentMonth ? "bg-white dark:bg-zinc-900" : "bg-zinc-50/50 dark:bg-zinc-950/50 opacity-50",
                            isSelected && "ring-2 ring-inset ring-indigo-500 z-10",
                            day.isToday && "bg-indigo-50/30"
                        )}
                    >
                        <span className={clsx("text-xs font-medium", day.isToday ? "text-indigo-600 font-bold" : "text-zinc-500")}>
                            {day.day}
                        </span>
                        <div className="mt-1 space-y-1">
                            {dayTasks.slice(0, 3).map(t => (
                                <div key={t.id} className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 truncate border border-indigo-100 flex items-center gap-1">
                                    {hasConflict(t) && <ExclamationCircleFilled className="text-amber-500 text-[8px]" />}
                                    {t.title}
                                </div>
                            ))}
                            {dayTasks.length > 3 && <div className="text-[9px] text-zinc-400 text-center">+{dayTasks.length - 3} 更多</div>}
                        </div>
                    </div>
                );
            })}
        </div>
    );

    // List View
    const renderListView = () => (
        <Table
            loading={isLoading}
            dataSource={filteredTasks}
            rowKey="id"
            pagination={false}
            className="custom-table"
            columns={[
                {
                    title: '内容',
                    dataIndex: 'title',
                    render: (text, record) => (
                        <div className="flex items-center gap-3">
                            {record.thumbnail ? <Image src={record.thumbnail} alt="内容缩略图" width={40} height={40} unoptimized className="w-10 h-10 rounded-lg object-cover" /> : <div className="w-10 h-10 rounded-lg bg-zinc-100 flex items-center justify-center" aria-label="暂无缩略图">📄</div>}
                            <div>
                                <div className="font-bold text-sm">{text}</div>
                                <div className="text-[10px] text-zinc-400">{record.account || '默认账号'}</div>
                            </div>
                        </div>
                    )
                },
                {
                    title: '平台',
                    dataIndex: 'platforms',
                    render: (pids: string[]) => (
                        <div className="flex gap-1">
                            {pids.map(id => <span key={id}>{PLATFORMS.find(x => x.id === id)?.icon || '🌐'}</span>)}
                        </div>
                    )
                },
                {
                    title: '发布时间',
                    render: (_, record) => (
                        <div className="text-xs">
                            <div className="font-medium text-zinc-700">{record.date}</div>
                            <div className="text-zinc-400">{record.time}</div>
                        </div>
                    )
                },
                {
                    title: '状态',
                    dataIndex: 'status',
                    render: (status: CalendarTask['status']) => (
                        <Badge status={STATUS_BADGE[status].badge} text={STATUS_BADGE[status].text} />
                    )
                }
            ]}
        />
    );

    return (
        <div className="max-w-[1400px] mx-auto space-y-6">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">排期日历</h1>
                </div>
                <div className="flex items-center gap-4">
                    <Select value={filterPlatform} onChange={setFilterPlatform} style={{ width: 140 }}>
                        <Option value="all">全部平台</Option>
                        {PLATFORMS.map(p => <Option key={p.id} value={p.id}>{p.icon} {p.name}</Option>)}
                    </Select>
                    <Segmented value={viewMode} onChange={(v) => setViewMode(v as any)} options={[{ label: '日历', value: 'month', icon: <CalendarOutlined /> }, { label: '列表', value: 'list', icon: <UnorderedListOutlined /> }]} />
                    {/* 排期必须绑定真实内容与平台账号，由内容工作室创建发布任务；这里不再有只存在于页面内存里、刷新即消失的「假排期」。 */}
                    <Link href="/studio"><Button type="primary" icon={<PlusOutlined />} className="bg-indigo-600 rounded-xl">去内容工作室排期</Button></Link>
                </div>
            </header>

            <div className="grid grid-cols-12 gap-8">
                <div className="col-span-9">{viewMode === 'month' ? renderMonthView() : renderListView()}</div>
                <div className="col-span-3 space-y-4">
                    <Card title={<div className="flex justify-between items-center"><span className="text-sm">本日任务</span> <Tag className="m-0 text-[10px]">{selectedDate}</Tag></div>} className="glass-card shadow-sm">
                        <div className="space-y-3">
                            {getTasksForDate(selectedDate).length > 0 ? getTasksForDate(selectedDate).map(t => (
                                <div key={t.id} className="group p-3 rounded-xl border hover:border-indigo-200 transition-all">
                                    <h4 className="text-xs font-bold truncate">{t.title}</h4>
                                    <div className="text-[10px] text-zinc-500">{t.time}</div>
                                </div>
                            )) : <Empty description="无排期任务" image={Empty.PRESENTED_IMAGE_SIMPLE} />}
                        </div>
                    </Card>
                </div>
            </div>

            <style jsx global>{`
                .glass-card { background: rgba(255,255,255,0.7); backdrop-filter: blur(10px); border-radius: 16px; }
            `}</style>
        </div>
    );
}
