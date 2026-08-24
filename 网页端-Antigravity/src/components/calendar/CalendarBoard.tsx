'use client';

import React, { useState, useRef } from 'react';
import { Button, Tag, Badge, Tooltip, Empty } from 'antd';
import {
    ClockCircleOutlined,
    EditOutlined,
    DeleteOutlined,
    LeftOutlined,
    RightOutlined,
    VideoCameraFilled,
    FileTextFilled,
    AppstoreFilled
} from '@ant-design/icons';
import clsx from 'clsx';
import dayjs from 'dayjs';
import { motion, AnimatePresence } from 'framer-motion';


export const CalendarBoard = () => {
    const [view, setView] = useState<'week' | 'month'>('week');
    const [currentDate, setCurrentDate] = useState<dayjs.Dayjs | null>(null);
    const [tasks, setTasks] = useState<any[]>([]);
    const idCounter = useRef(0);

    React.useEffect(() => {
        setCurrentDate(dayjs());
        setTasks([
            {
                id: '1',
                title: 'AI 工具推荐合集',
                date: dayjs().format('YYYY-MM-DD'),
                time: '10:00',
                platforms: ['douyin', 'xhs'],
                status: 'scheduled'
            },
            {
                id: '2',
                title: '周末探店 VLOG',
                date: dayjs().add(1, 'day').format('YYYY-MM-DD'),
                time: '18:00',
                platforms: ['xhs'],
                status: 'published'
            },
            {
                id: '3',
                title: '生产力工具评测',
                date: dayjs().add(3, 'day').format('YYYY-MM-DD'),
                time: '09:00',
                platforms: ['bilibili', 'weixin'],
                status: 'failed'
            }
        ]);
    }, []);

    if (!currentDate) return <div className="flex-1 h-full bg-zinc-50/30 flex items-center justify-center text-zinc-400">Loading calendar...</div>;

    // Week Logic
    const startOfWeek = currentDate.startOf('week');
    const weekDays = Array.from({ length: 7 }).map((_, i) => startOfWeek.add(i, 'day'));

    const getTasksForDate = (dateStr: string) => tasks.filter(t => t.date === dateStr);

    const handleDrop = (e: React.DragEvent, dateStr: string) => {
        e.preventDefault();
        const data = e.dataTransfer.getData('text/plain');
        if (data) {
            const content = JSON.parse(data) as { title?: string; platforms?: string[] };
            // Create new task from dropped content
            const newTask = {
                id: `task_${idCounter.current++}`,
                title: content.title || '未命名内容',
                date: dateStr,
                time: '12:00', // Default time
                platforms: content.platforms || [],
                status: 'scheduled'
            };
            setTasks((prev) => [...prev, newTask]);
        }
    };

    return (
        <div className="flex-1 h-full bg-zinc-50/30 flex flex-col min-w-0">
            {/* Toolbar */}
            <div className="px-6 py-4 flex items-center justify-between bg-white border-b border-zinc-100">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 bg-zinc-100 rounded-lg p-1">
                        <Button
                            size="small"
                            type={view === 'week' ? 'text' : 'text'}
                            className={clsx("text-xs font-medium", view === 'week' && "bg-white shadow-sm text-indigo-600")}
                            onClick={() => setView('week')}
                        >
                            周视图
                        </Button>
                        <Button
                            size="small"
                            type={view === 'month' ? 'text' : 'text'}
                            className={clsx("text-xs font-medium", view === 'month' && "bg-white shadow-sm text-indigo-600")}
                            onClick={() => setView('month')}
                        >
                            月视图
                        </Button>
                    </div>
                    <div className="hidden md:flex items-center gap-2 text-sm font-bold text-zinc-700">
                        <Button type="text" size="small" icon={<LeftOutlined />} onClick={() => setCurrentDate(currentDate.subtract(1, view))} />
                        <span>{currentDate.format('YYYY年 M月')}</span>
                        <Button type="text" size="small" icon={<RightOutlined />} onClick={() => setCurrentDate(currentDate.add(1, view))} />
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="hidden lg:flex items-center gap-2 bg-red-50 text-red-500 px-3 py-1.5 rounded-lg text-xs font-medium border border-red-100">
                        <Badge dot status="error" />
                        <span>本周目标 7 条，还差 4 条</span>
                    </div>
                    <Button type="primary" size="small" className="bg-indigo-600">补齐缺口</Button>
                </div>
            </div>

            {/* Grid */}
            <div className="flex-1 overflow-y-auto p-6">
                {view === 'week' ? (
                    <div className="grid grid-cols-7 gap-4 h-full min-h-[600px]">
                        {weekDays.map(day => {
                            const dateStr = day.format('YYYY-MM-DD');
                            const dayTasks = getTasksForDate(dateStr);
                            const isToday = dateStr === dayjs().format('YYYY-MM-DD');

                            return (
                                <div
                                    key={dateStr}
                                    className={clsx(
                                        "flex flex-col rounded-2xl border transition-all h-full group",
                                        isToday
                                            ? "bg-indigo-50/30 border-indigo-200"
                                            : "bg-white border-zinc-200 hover:border-zinc-300"
                                    )}
                                    onDragOver={(e) => e.preventDefault()}
                                    onDrop={(e) => handleDrop(e, dateStr)}
                                >
                                    {/* Day Header */}
                                    <div className={clsx("p-3 text-center border-b border-dashed", isToday ? "border-indigo-200" : "border-zinc-100")}>
                                        <div className="text-xs text-zinc-400 mb-1">{['周日', '周一', '周二', '周三', '周四', '周五', '周六'][day.day()]}</div>
                                        <div className={clsx(
                                            "text-lg font-bold w-8 h-8 rounded-full flex items-center justify-center mx-auto",
                                            isToday ? "bg-indigo-500 text-white shadow-md shadow-indigo-500/30" : "text-zinc-700"
                                        )}>
                                            {day.date()}
                                        </div>
                                    </div>

                                    {/* Task Slot */}
                                    <div className="flex-1 p-2 space-y-2 relative">
                                        {/* Drop Hint */}
                                        <div className="absolute inset-2 border-2 border-dashed border-indigo-300 rounded-xl bg-indigo-50/50 opacity-0 group-hover:opacity-100 pointer-events-none flex items-center justify-center text-xs text-indigo-500 font-bold z-0">
                                            拖拽至此排期
                                        </div>

                                        {dayTasks.map(task => (
                                            <div key={task.id} className="relative z-10 bg-white p-2.5 rounded-xl border border-zinc-200 shadow-sm cursor-pointer hover:-translate-y-1 hover:shadow-md transition-all group/card">
                                                <div className="flex items-center justify-between mb-1.5">
                                                    <span className="text-[10px] bg-zinc-100 text-zinc-500 px-1.5 rounded">{task.time}</span>
                                                    <Tag color={
                                                        task.status === 'published' ? 'green' :
                                                            task.status === 'failed' ? 'red' : 'blue'
                                                    } className="mr-0 border-0 text-[10px] px-1 h-5 leading-5">
                                                        {task.status === 'published' ? '已发布' :
                                                            task.status === 'failed' ? '失败' : '待发布'}
                                                    </Tag>
                                                </div>
                                                <div className="font-bold text-xs text-zinc-800 line-clamp-2 mb-2 leading-relaxed">
                                                    {task.title}
                                                </div>
                                                <div className="flex gap-1">
                                                    {task.platforms.map((p: string) => (
                                                        <span key={p} className="text-xs">
                                                            {p === 'douyin' && '🎵'}
                                                            {p === 'xhs' && '📕'}
                                                            {p === 'bilibili' && '📺'}
                                                            {p === 'weixin' && '💬'}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}

                                        {dayTasks.length === 0 && (
                                            <button className="w-full h-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                                <div className="w-8 h-8 rounded-full bg-zinc-100 text-zinc-400 flex items-center justify-center hover:bg-indigo-50 hover:text-indigo-500">
                                                    <Badge count="+" className="text-inherit" offset={[0, 0]} size="small" />
                                                </div>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="flex items-center justify-center h-full text-zinc-400">
                        月视图开发中...
                    </div>
                )}
            </div>
        </div>
    );
};
