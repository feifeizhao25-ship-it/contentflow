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
import { useSearchParams } from 'next/navigation';
import clsx from 'clsx';
import dayjs from 'dayjs';

const { TextArea } = Input;
const { Option } = Select;

// ==================== Types ====================
interface PublishTask {
    id: string;
    title: string;
    date: string;
    time: string;
    platforms: string[];
    status: 'scheduled' | 'published' | 'failed';
    thumbnail?: string;
    account?: string;
}

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
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTask, setEditingTask] = useState<PublishTask | null>(null);
    const [form] = Form.useForm();

    useEffect(() => {
        const view = searchParams.get('view');
        if (view === 'list' || view === 'month') {
            setViewMode(view);
        }
    }, [searchParams]);

    const fetchTasks = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await apiClient.get<any>(`/publish/tasks?status=${filterPlatform === 'all' ? '' : filterPlatform}`);
            if (res.data) {
                const mapped: PublishTask[] = res.data.map((t: any) => ({
                    id: t.id,
                    title: t.content?.title || '未命名内容',
                    date: dayjs(t.scheduled_at).format('YYYY-MM-DD'),
                    time: dayjs(t.scheduled_at).format('HH:mm'),
                    platforms: [t.platform],
                    status: t.status === 'pending' ? 'scheduled' : t.status === 'published' ? 'published' : 'failed',
                    thumbnail: t.content?.thumbnail_url
                }));
                setTasks(mapped);
            } else {
                setTasks([]);
            }
        } catch (e) {
            console.error('Failed to fetch tasks', e);
            message.error('发布任务加载失败，请稍后重试');
            setTasks([]);
        } finally {
            setIsLoading(false);
        }
    }, [filterPlatform]);

    useEffect(() => {
        void fetchTasks();
    }, [fetchTasks]);

    const filteredTasks = tasks;
    const calendarDays = getCalendarDays(currentMonth);

    const getTasksForDate = (date: string | null) => filteredTasks.filter(task => task.date === date);

    const hasConflict = (task: PublishTask) => {
        return tasks.some(t => t.id !== task.id && t.date === task.date && t.time === task.time);
    };

    const handleDateClick = (date: string | null) => {
        if (date) setSelectedDate(date);
    };

    const handleSubmit = async () => {
        const values = await form.validateFields();
        if (editingTask) {
            setTasks(tasks.map(t => t.id === editingTask.id ? { ...t, ...values } : t));
            message.success('任务已更新');
        } else {
            setTasks([...tasks, { id: Date.now().toString(), ...values, status: 'scheduled' }]);
            message.success('任务已排期');
        }
        setIsModalOpen(false);
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
                    render: (status) => (
                        <Badge status={status === 'scheduled' ? 'processing' : 'success'} text={status === 'scheduled' ? '待发布' : '已发布'} />
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
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingTask(null); setIsModalOpen(true); }} className="bg-indigo-600 rounded-xl">新建排期</Button>
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

            <Modal title={editingTask ? '编辑排期' : '新建排期'} open={isModalOpen} onCancel={() => setIsModalOpen(false)} onOk={handleSubmit} okText="确认" cancelText="取消">
                <Form form={form} layout="vertical" initialValues={{ date: selectedDate, time: '10:00' }}>
                    <Form.Item name="title" label="标题" rules={[{ required: true }]}><Input /></Form.Item>
                    <div className="grid grid-cols-2 gap-4">
                        <Form.Item name="date" label="日期"><Input type="date" /></Form.Item>
                        <Form.Item name="time" label="时间"><Input type="time" /></Form.Item>
                    </div>
                    <Form.Item name="platforms" label="平台"><Select mode="multiple">{PLATFORMS.map(p => <Option key={p.id} value={p.id}>{p.icon} {p.name}</Option>)}</Select></Form.Item>
                </Form>
            </Modal>

            <style jsx global>{`
                .glass-card { background: rgba(255,255,255,0.7); backdrop-filter: blur(10px); border-radius: 16px; }
            `}</style>
        </div>
    );
}
