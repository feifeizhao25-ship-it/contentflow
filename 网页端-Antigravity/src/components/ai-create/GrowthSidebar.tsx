'use client';

import React from 'react';
import { Button, Card, Tag, Typography, Badge } from 'antd';
import {
    ThunderboltFilled,
    PictureOutlined,
    CalendarOutlined,
    RocketOutlined,
    CopyOutlined,
    RightOutlined,
    CrownFilled
} from '@ant-design/icons';
import clsx from 'clsx';
import { motion } from 'framer-motion';

const { Text } = Typography;

export const GrowthSidebar = () => {
    return (
        <div className="h-full flex flex-col bg-stone-50/50 border-l border-zinc-200/60 w-[320px] overflow-y-auto">
            <div className="p-4 space-y-6">

                {/* Module 1: Next Steps (Strong Call to Action) */}
                <div>
                    <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3 px-1">下一步建议</h3>
                    <div className="space-y-3">
                        <div className="bg-white p-3 rounded-xl border border-zinc-100 shadow-sm flex items-center justify-between group hover:border-indigo-200 transition-all cursor-pointer">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-red-50 text-red-500 flex items-center justify-center">
                                    <RocketOutlined />
                                </div>
                                <div>
                                    <div className="font-bold text-sm text-zinc-800">适配小红书版</div>
                                    <div className="text-[10px] text-zinc-400">预计耗时 12 秒</div>
                                </div>
                            </div>
                            <Button size="small" type="primary" className="bg-red-500 hover:bg-red-600 text-xs px-2 h-7">一键适配</Button>
                        </div>

                        <div className="bg-white p-3 rounded-xl border border-zinc-100 shadow-sm flex items-center justify-between group hover:border-indigo-200 transition-all cursor-pointer">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-500 flex items-center justify-center">
                                    <PictureOutlined />
                                </div>
                                <div>
                                    <div className="font-bold text-sm text-zinc-800 flex items-center gap-1">
                                        生成封面
                                        <Tag color="gold" className="m-0 text-[8px] px-1 py-0 h-4 leading-4 border-0">PRO</Tag>
                                    </div>
                                    <div className="text-[10px] text-zinc-400">10版精美封面</div>
                                </div>
                            </div>
                            <Button size="small" className="text-xs px-2 h-7 bg-indigo-50 text-indigo-600 border-indigo-100">生成10版</Button>
                        </div>

                        <div className="bg-white p-3 rounded-xl border border-zinc-100 shadow-sm flex items-center justify-between group hover:border-indigo-200 transition-all cursor-pointer">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-green-50 text-green-500 flex items-center justify-center">
                                    <CalendarOutlined />
                                </div>
                                <div>
                                    <div className="font-bold text-sm text-zinc-800">一键排期</div>
                                    <div className="text-[10px] text-zinc-400">预计 6 秒</div>
                                </div>
                            </div>
                            <Button size="small" type="dashed" className="text-xs px-2 h-7">去排期</Button>
                        </div>
                    </div>
                </div>

                {/* Module 2: Viral Hooks */}
                <div>
                    <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3 px-1">爆款开头 Hook</h3>
                    <div className="bg-white rounded-xl border border-zinc-100 overflow-hidden shadow-sm">
                        {[
                            { title: '反常识开头', text: '99%的人都做错了，其实...', tag: '推荐', score: 9.8 },
                            { title: '悬念提问', text: '如果告诉你只需3步就能...', tag: null, score: 8.5 },
                            { title: '数据冲击', text: '昨天我用这个方法赚了...', tag: null, score: 8.2 },
                        ].map((hook, i) => (
                            <div key={i} className={clsx(
                                "p-3 border-b border-zinc-50 last:border-0 hover:bg-zinc-50 transition-colors cursor-pointer group",
                                i === 0 && "bg-indigo-50/30"
                            )}>
                                <div className="flex justify-between items-center mb-1">
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-xs text-zinc-700">{hook.title}</span>
                                        {hook.tag && <Badge status="processing" color="indigo" />}
                                    </div>
                                    <span className="text-[10px] text-green-500 font-mono">HR {hook.score}</span>
                                </div>
                                <div className="text-xs text-zinc-500 mb-2">{hook.text}</div>
                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                                    <Button size="small" type="link" className="text-[10px] h-5 p-0">使用</Button>
                                    <Button size="small" type="link" className="text-[10px] h-5 p-0 text-zinc-400">复制</Button>
                                </div>
                            </div>
                        ))}
                        <div className="p-2 bg-zinc-50 text-center">
                            <Button type="text" size="small" icon={<ThunderboltFilled />} className="text-xs text-indigo-500 w-full">再生成3个</Button>
                        </div>
                    </div>
                </div>

                {/* Module 3: Preview */}
                <div>
                    <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3 px-1">多平台预览</h3>
                    <div className="space-y-2">
                        {['抖音 (TikTok)', '小红书 (RedBook)'].map(p => (
                            <div key={p} className="flex items-center justify-between p-3 bg-white rounded-lg border border-zinc-100">
                                <span className="text-xs font-medium text-zinc-600">{p}</span>
                                <RightOutlined className="text-zinc-300 text-xs" />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Module 4: Pro Upsell (Soft) */}
                <div className="mt-4 p-4 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/20 relative overflow-hidden group cursor-pointer">
                    <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                        <CrownFilled className="text-6xl -rotate-12" />
                    </div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-1">
                            <CrownFilled className="text-yellow-300" />
                            <span className="font-bold text-sm">解锁 Pro 版</span>
                        </div>
                        <p className="text-xs text-indigo-100 leading-relaxed mb-3">
                            获得 批量适配 + 高清导出 + 专属客服支持。
                            <span className="block mt-1 font-bold text-white">本次预计节省 18 分钟</span>
                        </p>
                        <Button size="small" className="w-full bg-white/20 border-white/40 text-white hover:bg-white hover:text-indigo-600 border-none backdrop-blur-sm">
                            立即升级
                        </Button>
                    </div>
                </div>

            </div>
        </div>
    );
};
