'use client';

import React, { useState, useEffect } from 'react';
import { Button, Card, Tag, Modal, Form, Input, Select, message, Empty } from 'antd';
import {
    CalendarOutlined,
    PlusOutlined,
    ClockCircleOutlined,
    EditOutlined,
    DeleteOutlined,
    CheckCircleOutlined,
    ExclamationCircleOutlined
} from '@ant-design/icons';
import { motion, AnimatePresence } from 'framer-motion';
import { useThemeStore } from '@/store/themeStore';
import clsx from 'clsx';
import dayjs from 'dayjs';

const { TextArea } = Input;
const { Option } = Select;

// 发布任务类型
interface PublishTask {
    id: string;
    title: string;
    date: string;
    time: string;
    platforms: string[];
    status: 'scheduled' | 'published' | 'failed';
    content?: string;
}

// 模拟数据
const MOCK_TASKS: PublishTask[] = [
    {
        id: '1',
        title: 'AI 工具推荐合集',
        date: dayjs().format('YYYY-MM-DD'),
        time: '10:00',
        platforms: ['xhs', 'douyin'],
        status: 'scheduled',
        content: '分享几款实用的AI工具...'
    },
    {
        id: '2',
        title: '周末美食探店',
        date: dayjs().add(1, 'day').format('YYYY-MM-DD'),
        time: '14:00',
        platforms: ['weixin'],
        status: 'scheduled',
        content: '发现一家超好吃的店...'
    },
    {
        id: '3',
        title: '职场干货分享',
        date: dayjs().add(2, 'day').format('YYYY-MM-DD'),
        time: '09:00',
        platforms: ['weibo', 'zhihu'],
        status: 'scheduled',
        content: '职场新人必看...'
    },
];

const PLATFORMS = [
    { id: 'xhs', name: '小红书', color: '#ef4444', icon: '📕' },
    { id: 'douyin', name: '抖音', color: '#10b981', icon: '🎵' },
    { id: 'weixin', name: '公众号', color: '#22c55e', icon: '💬' },
    { id: 'weibo', name: '微博', color: '#f59e0b', icon: '👁️' },
    { id: 'bilibili', name: 'B站', color: '#3b82f6', icon: '📺' },
    { id: 'zhihu', name: '知乎', color: '#06b6d4', icon: '❓' },
];

// 获取月份日历数据
const getCalendarDays = (currentDate: dayjs.Dayjs) => {
    const days = [];
    const startOfMonth = currentDate.startOf('month');
    const endOfMonth = currentDate.endOf('month');
    const startDay = startOfMonth.day(); // 0 = Sunday
    const daysInMonth = endOfMonth.date();
    
    // 填充空白天数
    for (let i = 0; i < startDay; i++) {
        days.push({
            date: null,
            day: null,
            isCurrentMonth: false,
        });
    }
    
    // 填充当月天数
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = currentDate.date(day).format('YYYY-MM-DD');
        const isToday = dateStr === dayjs().format('YYYY-MM-DD');
        days.push({
            date: dateStr,
            day,
            isCurrentMonth: true,
            isToday,
        });
    }
    
    return days;
};

export default function CalendarPage() {
    const { isDark } = useThemeStore();
    const [currentMonth, setCurrentMonth] = useState(dayjs());
    const [tasks, setTasks] = useState<PublishTask[]>(MOCK_TASKS);
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTask, setEditingTask] = useState<PublishTask | null>(null);
    const [form] = Form.useForm();

    const calendarDays = getCalendarDays(currentMonth);
    const weekDays = ['日', '一', '二', '三', '四', '五', '六'];

    // 获取某天的任务
    const getTasksForDate = (date: string | null) => {
        if (!date) return [];
        return tasks.filter(task => task.date === date);
    };

    // 获取某天的任务数量
    const getTaskCount = (date: string | null) => {
        return getTasksForDate(date).length;
    };

    // 格式化月份显示
    const monthDisplay = currentMonth.format('YYYY年M月');

    const handlePrevMonth = () => {
        setCurrentMonth(currentMonth.subtract(1, 'month'));
    };

    const handleNextMonth = () => {
        setCurrentMonth(currentMonth.add(1, 'month'));
    };

    const handleToday = () => {
        setCurrentMonth(dayjs());
    };

    const handleDateClick = (date: string | null) => {
        if (date) {
            setSelectedDate(date);
            setEditingTask(null);
            form.resetFields();
            setIsModalOpen(true);
        }
    };

    const handleEditTask = (task: PublishTask) => {
        setEditingTask(task);
        setSelectedDate(task.date);
        form.setFieldsValue({
            title: task.title,
            date: task.date,
            time: task.time,
            platforms: task.platforms,
            content: task.content,
        });
        setIsModalOpen(true);
    };

    const handleDeleteTask = (taskId: string) => {
        setTasks(tasks.filter(t => t.id !== taskId));
        message.success('任务已删除');
    };

    const handleSubmit = async () => {
        try {
            const values = await form.validateFields();
            
            if (editingTask) {
                // 更新任务
                setTasks(tasks.map(t => 
                    t.id === editingTask.id
                        ? { ...t, ...values }
                        : t
                ));
                message.success('任务已更新');
            } else {
                // 创建新任务
                const newTask: PublishTask = {
                    id: Date.now().toString(),
                    title: values.title,
                    date: values.date,
                    time: values.time,
                    platforms: values.platforms,
                    content: values.content,
                    status: 'scheduled',
                };
                setTasks([...tasks, newTask]);
                message.success('任务已创建');
            }
            
            setIsModalOpen(false);
            form.resetFields();
        } catch (error) {
            console.error('Validation failed:', error);
        }
    };

    const selectedTasks = getTasksForDate(selectedDate);

    return (
        <div className="min-h-screen">
            {/* 头部 */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-zinc-900 dark:text-white mb-2">
                        发布日历
                    </h1>
                    <p className="text-zinc-500 dark:text-zinc-400">
                        规划您的内容发布节奏，提高运营效率
                    </p>
                </div>
                
                <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    size="large"
                    onClick={() => {
                        setEditingTask(null);
                        setSelectedDate(dayjs().format('YYYY-MM-DD'));
                        form.resetFields();
                        setIsModalOpen(true);
                    }}
                    className="h-12 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500"
                >
                    新建任务
                </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* 日历 */}
                <div className={clsx(
                    "lg:col-span-3 rounded-2xl p-6",
                    isDark ? "bg-zinc-900" : "bg-white"
                )}>
                    {/* 月份导航 */}
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={handlePrevMonth}
                                className={clsx(
                                    "w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
                                    isDark 
                                        ? "bg-zinc-800 hover:bg-zinc-700 text-zinc-400" 
                                        : "bg-zinc-100 hover:bg-zinc-200 text-zinc-600"
                                )}
                            >
                                ←
                            </button>
                            <h2 className="text-xl font-bold text-zinc-900 dark:text-white min-w-[140px] text-center">
                                {monthDisplay}
                            </h2>
                            <button
                                onClick={handleNextMonth}
                                className={clsx(
                                    "w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
                                    isDark 
                                        ? "bg-zinc-800 hover:bg-zinc-700 text-zinc-400" 
                                        : "bg-zinc-100 hover:bg-zinc-200 text-zinc-600"
                                )}
                            >
                                →
                            </button>
                        </div>
                        
                        <Button onClick={handleToday} size="small">
                            今天
                        </Button>
                    </div>

                    {/* 星期标题 */}
                    <div className="grid grid-cols-7 gap-1 mb-2">
                        {weekDays.map(day => (
                            <div
                                key={day}
                                className={clsx(
                                    "text-center text-sm font-medium py-2",
                                    isDark ? "text-zinc-500" : "text-zinc-400"
                                )}
                            >
                                {day}
                            </div>
                        ))}
                    </div>

                    {/* 日历网格 */}
                    <div className="grid grid-cols-7 gap-1">
                        {calendarDays.map((dayInfo, index) => {
                            const taskCount = getTaskCount(dayInfo.date);
                            const hasTasks = taskCount > 0;
                            
                            return (
                                <motion.div
                                    key={index}
                                    whileHover={{ scale: dayInfo.date ? 1.02 : 1 }}
                                    whileTap={{ scale: dayInfo.date ? 0.98 : 1 }}
                                    onClick={() => handleDateClick(dayInfo.date)}
                                    className={clsx(
                                        "min-h-[100px] p-2 rounded-xl cursor-pointer transition-all relative",
                                        dayInfo.isCurrentMonth
                                            ? dayInfo.isToday
                                                ? "bg-indigo-100 dark:bg-indigo-900/30 border-2 border-indigo-500"
                                                : isDark 
                                                    ? "hover:bg-zinc-800 bg-zinc-900" 
                                                    : "hover:bg-zinc-50 bg-white"
                                            : isDark 
                                                ? "bg-zinc-950/50" 
                                                : "bg-zinc-50",
                                        !dayInfo.date && "cursor-default"
                                    )}
                                >
                                    {dayInfo.date && (
                                        <>
                                            <div className="flex items-center justify-between mb-1">
                                                <span className={clsx(
                                                    "text-sm font-medium",
                                                    dayInfo.isToday
                                                        ? "text-indigo-600 dark:text-indigo-400"
                                                        : isDark ? "text-zinc-300" : "text-zinc-700"
                                                )}>
                                                    {dayInfo.day}
                                                </span>
                                                {hasTasks && (
                                                    <Tag color="blue" className="text-xs">
                                                        {taskCount}
                                                    </Tag>
                                                )}
                                            </div>
                                            
                                            {/* 任务预览 */}
                                            <div className="space-y-1">
                                                {getTasksForDate(dayInfo.date).slice(0, 2).map(task => (
                                                    <div
                                                        key={task.id}
                                                        className={clsx(
                                                            "text-xs px-1.5 py-0.5 rounded truncate",
                                                            task.status === 'published'
                                                                ? "bg-green-100 dark:bg-green-900/30 text-green-600"
                                                                : "bg-blue-100 dark:bg-blue-900/30 text-blue-600"
                                                        )}
                                                    >
                                                        {task.title}
                                                    </div>
                                                ))}
                                                {taskCount > 2 && (
                                                    <div className={clsx(
                                                        "text-xs text-center",
                                                        isDark ? "text-zinc-500" : "text-zinc-400"
                                                    )}>
                                                        +{taskCount - 2} 个任务
                                                    </div>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </motion.div>
                            );
                        })}
                    </div>
                </div>

                {/* 选中日期的任务列表 */}
                <div className={clsx(
                    "rounded-2xl p-6 h-fit",
                    isDark ? "bg-zinc-900" : "bg-white"
                )}>
                    <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-4">
                        {selectedDate 
                            ? dayjs(selectedDate).format('M月D日 dddd')
                            : '选择日期查看任务'
                        }
                    </h3>

                    {!selectedDate ? (
                        <Empty
                            description="点击日历中的日期查看任务"
                            className="py-8"
                        />
                    ) : selectedTasks.length === 0 ? (
                        <Empty
                            description="当天没有计划任务"
                            className="py-8"
                        >
                            <Button
                                type="primary"
                                size="small"
                                onClick={() => handleDateClick(selectedDate)}
                            >
                                添加任务
                            </Button>
                        </Empty>
                    ) : (
                        <div className="space-y-3">
                            {selectedTasks.map(task => (
                                <motion.div
                                    key={task.id}
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className={clsx(
                                        "p-4 rounded-xl border",
                                        isDark 
                                            ? "bg-zinc-800 border-zinc-700" 
                                            : "bg-zinc-50 border-zinc-200"
                                    )}
                                >
                                    <div className="flex items-start justify-between mb-2">
                                        <h4 className="font-medium text-zinc-900 dark:text-white">
                                            {task.title}
                                        </h4>
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => handleEditTask(task)}
                                                className={clsx(
                                                    "w-7 h-7 rounded-lg flex items-center justify-center transition-colors",
                                                    isDark 
                                                        ? "hover:bg-zinc-700 text-zinc-400" 
                                                        : "hover:bg-zinc-200 text-zinc-500"
                                                )}
                                            >
                                                <EditOutlined />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteTask(task.id)}
                                                className={clsx(
                                                    "w-7 h-7 rounded-lg flex items-center justify-center transition-colors text-red-500",
                                                    isDark 
                                                        ? "hover:bg-zinc-700" 
                                                        : "hover:bg-red-50"
                                                )}
                                            >
                                                <DeleteOutlined />
                                            </button>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400 mb-3">
                                        <span className="flex items-center gap-1">
                                            <ClockCircleOutlined />
                                            {task.time}
                                        </span>
                                        <Tag color={
                                            task.status === 'published' ? 'green' :
                                            task.status === 'scheduled' ? 'blue' : 'red'
                                        } className="text-xs">
                                            {task.status === 'published' ? '已发布' : '待发布'}
                                        </Tag>
                                    </div>
                                    
                                    <div className="flex flex-wrap gap-1">
                                        {task.platforms.map(p => {
                                            const platform = PLATFORMS.find(pl => pl.id === p);
                                            return platform ? (
                                                <span
                                                    key={p}
                                                    className="text-xs px-2 py-0.5 rounded bg-white dark:bg-zinc-700 border"
                                                    style={{ borderColor: platform.color }}
                                                >
                                                    {platform.icon} {platform.name}
                                                </span>
                                            ) : null;
                                        })}
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* 新建/编辑任务弹窗 */}
            <Modal
                title={editingTask ? '编辑任务' : '新建任务'}
                open={isModalOpen}
                onCancel={() => {
                    setIsModalOpen(false);
                    form.resetFields();
                }}
                footer={null}
                width={500}
                className="calendar-modal"
            >
                <Form
                    form={form}
                    layout="vertical"
                    initialValues={{
                        date: selectedDate || dayjs().format('YYYY-MM-DD'),
                        time: '10:00',
                        platforms: [],
                    }}
                >
                    <Form.Item
                        name="title"
                        label="任务标题"
                        rules={[{ required: true, message: '请输入任务标题' }]}
                    >
                        <Input placeholder="给任务起个名字" className="rounded-lg" />
                    </Form.Item>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <Form.Item
                            name="date"
                            label="发布日期"
                            rules={[{ required: true, message: '请选择日期' }]}
                        >
                            <Input type="date" className="rounded-lg" />
                        </Form.Item>
                        
                        <Form.Item
                            name="time"
                            label="发布时间"
                            rules={[{ required: true, message: '请选择时间' }]}
                        >
                            <Input type="time" className="rounded-lg" />
                        </Form.Item>
                    </div>
                    
                    <Form.Item
                        name="platforms"
                        label="发布平台"
                        rules={[{ required: true, message: '请选择至少一个平台' }]}
                    >
                        <Select
                            mode="multiple"
                            placeholder="选择发布平台"
                            className="rounded-lg"
                        >
                            {PLATFORMS.map(platform => (
                                <Option key={platform.id} value={platform.id}>
                                    <span className="flex items-center gap-2">
                                        <span>{platform.icon}</span>
                                        <span>{platform.name}</span>
                                    </span>
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>
                    
                    <Form.Item
                        name="content"
                        label="内容摘要"
                    >
                        <TextArea
                            rows={3}
                            placeholder="简单描述一下内容..."
                            className="rounded-lg resize-none"
                        />
                    </Form.Item>
                    
                    <div className="flex justify-end gap-3">
                        <Button
                            onClick={() => {
                                setIsModalOpen(false);
                                form.resetFields();
                            }}
                        >
                            取消
                        </Button>
                        <Button
                            type="primary"
                            onClick={handleSubmit}
                            className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 rounded-lg"
                        >
                            {editingTask ? '保存修改' : '创建任务'}
                        </Button>
                    </div>
                </Form>
            </Modal>
        </div>
    );
}
