'use client';

import React, { useState } from 'react';
import { Button, Tag, Avatar, Badge, message } from 'antd';
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

// Mock Data
const MOCK_TASKS = [
    { id: '1', title: 'AI 创业实战：如何从0到1', platform: 'xhs', account: '分发侠官方号', status: 'success', time: '10:30', date: '2024-05-20' },
    { id: '2', title: '周末探店 VLOG - 上海篇', platform: 'douyin', account: '生活号-小美', status: 'publishing', time: '12:00', date: '2024-05-20' },
    { id: '3', title: '深度解析：Vue3 vs React', platform: 'bilibili', account: '前端胖虎', status: 'failed', time: '09:00', date: '2024-05-20', error: '授权已失效', errorDetail: 'Token 401 Unauthorized' },
    { id: '4', title: '职场黑话翻译机', platform: 'weixin', account: '职场大表哥', status: 'pending', time: '18:00', date: '2024-05-21' },
];

export const PublishTaskList = () => {
    const [expandedRow, setExpandedRow] = useState<string | null>(null);

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

    return (
        <div className="space-y-3">
            {MOCK_TASKS.map(task => {
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
