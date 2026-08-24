'use client';

import React from 'react';
import {
    FileTextOutlined,
    PictureOutlined,
    GlobalOutlined,
    TagsOutlined,
    CalendarOutlined,
    PlusOutlined,
    ExportOutlined,
    HistoryOutlined,
    CheckCircleFilled,
    ClockCircleFilled,
    MoreOutlined
} from '@ant-design/icons';
import { Button, Progress, Tag, Dropdown } from 'antd';
import clsx from 'clsx';

interface ContentPackPanelProps {
    activeSection: string;
    onSectionChange: (section: string) => void;
}

export const ContentPackPanel = ({ activeSection, onSectionChange }: ContentPackPanelProps) => {

    const menuItems = [
        { id: 'title', label: '标题', count: 10, icon: <FileTextOutlined />, status: 'completed' },
        { id: 'script', label: '脚本/正文', count: 1, icon: <FileTextOutlined />, status: 'completed' },
        { id: 'cover', label: '视觉封面', count: 0, icon: <PictureOutlined />, status: 'pending' },
        { id: 'adapter', label: '平台适配', count: '0/3', icon: <GlobalOutlined />, status: 'pending' },
        { id: 'tags', label: '标签话题', count: '缺2', icon: <TagsOutlined />, status: 'warning' },
        { id: 'schedule', label: '排期发布', count: '未设', icon: <CalendarOutlined />, status: 'pending' },
    ];

    const renderStatusIcon = (status: string) => {
        switch (status) {
            case 'completed': return <CheckCircleFilled className="text-green-500" />;
            case 'warning': return <ClockCircleFilled className="text-orange-400" />;
            default: return <div className="w-3 h-3 rounded-full border border-zinc-300" />;
        }
    };

    return (
        <div className="h-full flex flex-col bg-white/50 backdrop-blur-xl border-r border-zinc-200/60 w-[260px]">
            {/* Header */}
            <div className="p-4 border-b border-zinc-100">
                <div className="flex items-center justify-between mb-2">
                    <h2 className="font-bold text-lg text-zinc-800">内容包 #001</h2>
                    <Tag color="blue" className="mr-0 border-0 bg-indigo-50 text-indigo-600 font-bold">草稿</Tag>
                </div>
                <div className="space-y-1">
                    <div className="flex justify-between text-xs text-zinc-500 mb-1">
                        <span>可发布度</span>
                        <span className="font-bold text-indigo-600">80%</span>
                    </div>
                    <Progress percent={80} showInfo={false} strokeColor="#6366f1" size="small" className="!m-0" />
                    <div className="text-[10px] text-zinc-400 mt-2 flex items-center gap-1">
                        <CheckCircleFilled className="text-green-500" /> 已自动保存 3秒前
                    </div>
                </div>
            </div>

            {/* Navigation List */}
            <div className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
                {menuItems.map(item => (
                    <button
                        key={item.id}
                        onClick={() => onSectionChange(item.id)}
                        className={clsx(
                            "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all group relative",
                            activeSection === item.id
                                ? "bg-white shadow-sm ring-1 ring-zinc-200 text-indigo-600 font-medium"
                                : "text-zinc-600 hover:bg-zinc-100/80"
                        )}
                    >
                        <span className={clsx(
                            "text-lg transition-colors",
                            activeSection === item.id ? "text-indigo-500" : "text-zinc-400 group-hover:text-zinc-600"
                        )}>
                            {item.icon}
                        </span>

                        <span className="flex-1 text-left">{item.label}</span>

                        {item.count && (
                            <span className={clsx(
                                "text-xs px-1.5 py-0.5 rounded-md",
                                activeSection === item.id ? "bg-indigo-50 text-indigo-600" : "bg-zinc-100 text-zinc-500"
                            )}>
                                {item.count}
                            </span>
                        )}

                        <div className="absolute right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            {renderStatusIcon(item.status)}
                        </div>
                    </button>
                ))}
            </div>

            {/* Footer Actions */}
            <div className="p-4 border-t border-zinc-100 bg-zinc-50/50 space-y-2">
                <Button block icon={<PlusOutlined />} className="text-left justify-start border-dashed border-zinc-300 hover:border-indigo-500 hover:text-indigo-600">
                    新增平台版本
                </Button>
                <div className="grid grid-cols-2 gap-2">
                    <Button block size="small" icon={<ExportOutlined />} className="text-xs text-zinc-500">导出</Button>
                    <Button block size="small" icon={<HistoryOutlined />} className="text-xs text-zinc-500">历史</Button>
                </div>
            </div>
        </div>
    );
};
