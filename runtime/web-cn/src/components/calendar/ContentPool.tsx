'use client';

import React, { useState } from 'react';
import { Input, Select, Tag, Button } from 'antd';
import { SearchOutlined, HolderOutlined, EyeOutlined, PlusOutlined } from '@ant-design/icons';
import clsx from 'clsx';

const { Option } = Select;

interface ContentItem {
    id: string;
    title: string;
    platforms: string[];
    duration: string;
    tags: string[];
    status: 'draft' | 'generated' | 'adapted';
}

export const ContentPool = () => {
    // Mock Data
    const [contents] = useState<ContentItem[]>([
        { id: '1', title: 'AI短视频带货：3个爆点', platforms: ['douyin', 'xhs'], duration: '30s', tags: ['#带货', '#爆款'], status: 'generated' },
        { id: '2', title: '职场黑话翻译机', platforms: ['xhs'], duration: '15s', tags: ['#职场', '#干货'], status: 'adapted' },
        { id: '3', title: 'Notion 模版分享', platforms: ['bilibili'], duration: '3m', tags: ['#工具', '#效率'], status: 'draft' },
        { id: '4', title: '周末去哪儿玩', platforms: ['xhs', 'douyin', 'weixin'], duration: '60s', tags: ['#探店'], status: 'generated' },
    ]);

    const getPlatformIcon = (key: string) => {
        const map: any = { douyin: '🎵', xhs: '📕', weixin: '💬', bilibili: '📺' };
        return map[key] || '📱';
    };

    return (
        <div className="h-full flex flex-col bg-white border-r border-zinc-200/60 w-[320px]">
            {/* Header / Filter */}
            <div className="p-4 border-b border-zinc-100 space-y-3">
                <Input
                    prefix={<SearchOutlined className="text-zinc-400" />}
                    placeholder="搜索内容..."
                    className="rounded-full bg-zinc-50 border-zinc-200"
                />
                <div className="flex gap-2">
                    <Select defaultValue="all" size="small" className="flex-1" variant="borderless">
                        <Option value="all">全部状态</Option>
                        <Option value="draft">草稿</Option>
                        <Option value="ready">可发布</Option>
                    </Select>
                    <Select defaultValue="all" size="small" className="flex-1" variant="borderless">
                        <Option value="all">全平台</Option>
                        <Option value="douyin">抖音</Option>
                        <Option value="xhs">小红书</Option>
                    </Select>
                </div>
            </div>

            {/* Content List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-zinc-50/50">
                <div className="text-xs font-bold text-zinc-400 px-1 uppercase">待排期 ({contents.length})</div>

                {contents.map(item => (
                    <div
                        key={item.id}
                        draggable
                        className="bg-white p-3 rounded-xl border border-zinc-200 shadow-sm cursor-grab active:cursor-grabbing hover:border-indigo-400 hover:shadow-md transition-all group relative"
                        onDragStart={(e) => {
                            e.dataTransfer.setData('text/plain', JSON.stringify(item));
                            e.dataTransfer.effectAllowed = 'copy';
                        }}
                    >
                        <div className="flex justify-between items-start mb-2">
                            <h4 className="font-bold text-sm text-zinc-800 line-clamp-2 leading-relaxed">
                                {item.title}
                            </h4>
                            <HolderOutlined className="text-zinc-300" />
                        </div>

                        <div className="flex items-center gap-2 mb-3">
                            <div className="flex -space-x-1.5">
                                {item.platforms.map(p => (
                                    <div key={p} className="w-5 h-5 rounded-full bg-zinc-100 border border-white flex items-center justify-center text-[10px]">
                                        {getPlatformIcon(p)}
                                    </div>
                                ))}
                            </div>
                            <span className="text-[10px] text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded-md">{item.duration}</span>
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="flex flex-wrap gap-1">
                                {item.tags.map(tag => (
                                    <span key={tag} className="text-[10px] text-indigo-400">{tag}</span>
                                ))}
                            </div>

                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button size="small" type="text" icon={<EyeOutlined />} className="text-zinc-400" />
                                <Button size="small" type="text" icon={<PlusOutlined />} className="text-indigo-600 bg-indigo-50" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
