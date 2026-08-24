'use client';

import React, { useState } from 'react';
import { Select, Radio, Badge } from 'antd';
import {
    FireFilled,
    PlayCircleFilled,
    LikeFilled,
    CommentOutlined,
    RightOutlined
} from '@ant-design/icons';
import clsx from 'clsx';
import { motion } from 'framer-motion';

const { Option } = Select;

// Mock Data
const RANK_DATA = [
    { id: '1', title: 'AI 创业实战：如何从0到1', platform: 'xhs', views: '10.2w', likes: '5.2k', score: 98, trend: 'up' },
    { id: '2', title: '周末探店 VLOG', platform: 'douyin', views: '8.5w', likes: '3.1k', score: 92, trend: 'flat' },
    { id: '3', title: '深度解析：Vue3 vs React', platform: 'bilibili', views: '5.1w', likes: '1.2k', score: 88, trend: 'up' },
    { id: '4', title: '职场黑话翻译机', platform: 'xhs', views: '3.2w', likes: '892', score: 85, trend: 'down' },
];

interface ContentRankListProps {
    onSelect: (id: string) => void;
    selectedId: string | null;
}

export const ContentRankList = ({ onSelect, selectedId }: ContentRankListProps) => {
    return (
        <div className="bg-white rounded-2xl border border-zinc-200 h-full flex flex-col w-[340px]">
            {/* Header */}
            <div className="p-4 border-b border-zinc-100 space-y-3">
                <div className="font-bold text-zinc-800">内容表现排行</div>
                <div className="flex gap-2">
                    <Select defaultValue="all" size="small" variant="borderless" className="bg-zinc-50 rounded-lg">
                        <Option value="all">全平台</Option>
                        <Option value="xhs">小红书</Option>
                        <Option value="douyin">抖音</Option>
                    </Select>
                    <Select defaultValue="7d" size="small" variant="borderless" className="bg-zinc-50 rounded-lg">
                        <Option value="7d">近7天</Option>
                        <Option value="30d">近30天</Option>
                    </Select>
                    <Select defaultValue="views" size="small" variant="borderless" className="bg-zinc-50 rounded-lg">
                        <Option value="views">播放最高</Option>
                        <Option value="likes">互动最高</Option>
                    </Select>
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-2 bg-zinc-50/50">
                {RANK_DATA.map((item, index) => (
                    <div
                        key={item.id}
                        onClick={() => onSelect(item.id)}
                        className={clsx(
                            "p-3 rounded-xl border cursor-pointer transition-all group relative overflow-hidden",
                            selectedId === item.id
                                ? "bg-white border-indigo-500 shadow-md shadow-indigo-500/10 scale-[1.02]"
                                : "bg-white border-zinc-100 hover:border-zinc-300 hover:shadow-sm"
                        )}
                    >
                        {/* Rank Badge */}
                        <div className={clsx(
                            "absolute top-0 left-0 w-8 h-8 rounded-br-xl text-center leading-8 font-black text-xs z-10",
                            index < 3 ? "bg-yellow-50 text-yellow-600" : "bg-zinc-100 text-zinc-400"
                        )}>
                            {index + 1}
                        </div>

                        <div className="pl-10">
                            <h4 className={clsx(
                                "text-sm font-bold line-clamp-1 mb-2",
                                selectedId === item.id ? "text-indigo-600" : "text-zinc-800"
                            )}>
                                {item.title}
                            </h4>

                            <div className="flex justify-between items-center text-xs text-zinc-500">
                                <div className="flex items-center gap-2">
                                    <span className="flex items-center gap-1">
                                        {item.platform === 'xhs' ? '📕' : item.platform === 'douyin' ? '🎵' : '📺'}
                                        {item.views}
                                    </span>
                                    <span className="flex items-center gap-1 text-zinc-400">
                                        <LikeFilled className="text-zinc-300" /> {item.likes}
                                    </span>
                                </div>

                                {selectedId === item.id && (
                                    <RightOutlined className="text-indigo-500 text-[10px]" />
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
