'use client';

import React from 'react';
import { Button, Select, Input, Badge, Tooltip } from 'antd';
import {
    ExperimentOutlined,
    ThunderboltFilled,
    SaveOutlined,
    EyeOutlined,
    RocketOutlined
} from '@ant-design/icons';
import { TiptapEditor } from '@/components/editor/TiptapEditor';
import clsx from 'clsx';

const { Option } = Select;

interface MainWorkspaceProps {
    topic: string;
    onTopicChange: (val: string) => void;
    content: string;
    onContentChange: (val: string) => void;
    onGenerate: () => void;
    isGenerating: boolean;
}

export const MainWorkspace = ({
    topic,
    onTopicChange,
    content,
    onContentChange,
    onGenerate,
    isGenerating
}: MainWorkspaceProps) => {

    return (
        <div className="flex-1 flex flex-col h-full bg-white relative">
            {/* 1. Page Header */}
            <div className="px-8 py-6 border-b border-zinc-100 bg-white/80 backdrop-blur z-10 sticky top-0">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h1 className="text-2xl font-black text-zinc-900 flex items-center gap-2">
                            AI 创作中心
                            <Badge count="PRO" style={{ backgroundColor: '#6366f1' }} />
                        </h1>
                        <p className="text-zinc-500 text-sm font-medium mt-1">
                            输入主题 → 生成内容包 → 一键适配多平台
                        </p>
                    </div>
                    <div className="flex gap-2 items-center">
                        <Button
                            type="primary"
                            size="large"
                            icon={<ExperimentOutlined />}
                            loading={isGenerating}
                            onClick={onGenerate}
                            className="rounded-full px-8 bg-gradient-to-r from-indigo-600 to-purple-600 border-none shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:-translate-y-0.5 transition-all"
                        >
                            生成内容包
                        </Button>
                        <div className="hidden lg:flex gap-2">
                            <Button size="middle" className="rounded-full text-xs">增强脚本</Button>
                            <Button size="middle" className="rounded-full text-xs">生成标题</Button>
                            <Button size="middle" className="rounded-full text-xs">生成标签</Button>
                        </div>
                    </div>
                </div>

                {/* 2. Parameters Bar */}
                <div className="flex items-center gap-3 p-1 rounded-xl bg-zinc-50 overflow-x-auto scrollbar-hide">
                    <Select defaultValue="ecommerce" variant="borderless" className="min-w-[120px] bg-white rounded-lg shadow-sm">
                        <Option value="ecommerce">电商带货</Option>
                        <Option value="knowledge">知识博主</Option>
                        <Option value="lifestyle">本地生活</Option>
                    </Select>

                    <div className="w-px h-6 bg-zinc-200" />

                    <Select mode="multiple" placeholder="选择平台" defaultValue={['douyin', 'xhs']} variant="borderless" className="min-w-[180px] flex-1 bg-transparent" maxTagCount={2}>
                        <Option value="douyin">抖音</Option>
                        <Option value="xhs">小红书</Option>
                        <Option value="weixin">视频号</Option>
                        <Option value="bilibili">B站</Option>
                    </Select>

                    <div className="w-px h-6 bg-zinc-200" />

                    <Select defaultValue="story" variant="borderless" popupMatchSelectWidth={false} className="w-24">
                        <Option value="dry">干货</Option>
                        <Option value="story">故事</Option>
                        <Option value="promo">口播</Option>
                    </Select>

                    <Select defaultValue="60s" variant="borderless" popupMatchSelectWidth={false} className="w-20">
                        <Option value="30s">30s</Option>
                        <Option value="60s">60s</Option>
                        <Option value="90s">90s</Option>
                    </Select>

                    <div className="w-px h-6 bg-zinc-200" />

                    <Select defaultValue="standard" variant="borderless" popupMatchSelectWidth={false} className="w-24">
                        <Option value="light">轻量</Option>
                        <Option value="standard">标准</Option>
                        <Option value="strong">加强</Option>
                    </Select>
                </div>
            </div>

            {/* 3. Editor Area */}
            <div className="flex-1 overflow-y-auto p-8 relative bg-zinc-50/30">
                <div className="max-w-3xl mx-auto bg-white min-h-[800px] shadow-sm border border-zinc-100 rounded-xl p-10 relative group">
                    {/* Smart Hint Overlay (Example) */}
                    {!content && (
                        <div className="absolute top-1/3 left-0 right-0 text-center pointer-events-none opacity-40">
                            <RocketOutlined className="text-4xl text-indigo-300 mb-4" />
                            <h3 className="text-xl font-bold text-zinc-400">开始您的创作之旅</h3>
                            <p className="text-zinc-300 mt-2">点击顶部"生成内容包"或直接在此输入</p>
                        </div>
                    )}

                    <Input.TextArea
                        placeholder="输入标题..."
                        className="text-3xl font-bold border-none shadow-none p-0 mb-6 resize-none placeholder:text-zinc-300 focus:ring-0"
                        autoSize
                        value={topic}
                        onChange={(e) => onTopicChange(e.target.value)}
                    />

                    <TiptapEditor content={content} onChange={onContentChange} />

                    {/* Smart Hint Bottom Bar */}
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 opacity-0 group-hover:opacity-100 transition-all duration-500">
                        <Tooltip title="点击优化开头">
                            <Button size="small" shape="round" className="bg-indigo-50 text-indigo-600 border-indigo-100 shadow-sm">
                                💡 建议：开头增加一个反问句
                            </Button>
                        </Tooltip>
                    </div>
                </div>
            </div>

            {/* 4. Footer Bar */}
            <div className="h-12 border-t border-zinc-100 bg-white/90 backdrop-blur px-6 flex items-center justify-between text-xs text-zinc-500">
                <div className="flex gap-4">
                    <span>字数: {content ? content.replace(/<[^>]+>/g, '').length : 0}</span>
                    <span>预计时长: {Math.ceil((content ? content.replace(/<[^>]+>/g, '').length : 0) / 5)}s</span>
                </div>

                <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 text-green-600">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                        已自动保存
                    </span>
                    <div className="h-3 w-px bg-zinc-200 mx-2" />
                    <Button type="text" size="small" icon={<EyeOutlined />}>预览</Button>
                    <Button type="text" size="small" icon={<SaveOutlined />}>存草稿</Button>
                </div>
            </div>
        </div>
    );
};
