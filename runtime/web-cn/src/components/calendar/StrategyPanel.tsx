'use client';

import React from 'react';
import { Button, Tag } from 'antd';
import {
    RocketOutlined,
    ThunderboltFilled,
    CheckCircleFilled,
    ClockCircleOutlined,
    CrownFilled
} from '@ant-design/icons';

export const StrategyPanel = () => {

    // Mock Plans
    const plans = [
        { id: '1', title: '7天新手计划', desc: '每天1条，快速起号', duration: '7天' },
        { id: '2', title: '30天增长挑战', desc: '3主题轮换，稳定涨粉', duration: '30天' },
        { id: '3', title: '抖音冲刺计划', desc: '高频发布，连发7天', duration: '7天' },
    ];

    return (
        <div className="h-full flex flex-col bg-white border-l border-zinc-200/60 w-[320px] overflow-y-auto">
            <div className="p-4 space-y-6">

                {/* Module 1: Growth Plans */}
                <div>
                    <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3 px-1">增长计划模板</h3>
                    <div className="space-y-3">
                        {plans.map((p, i) => (
                            <div key={p.id} className="bg-zinc-50 p-3 rounded-xl border border-zinc-100 hover:border-indigo-300 hover:shadow-md transition-all group cursor-pointer relative overflow-hidden">
                                <div className="absolute right-0 top-0 p-2 opacity-10 group-hover:opacity-20">
                                    <RocketOutlined className="text-4xl text-indigo-500" />
                                </div>
                                <div className="relative z-10">
                                    <div className="flex justify-between items-start mb-1">
                                        <div className="font-bold text-sm text-zinc-800">{p.title}</div>
                                        <Tag className="mr-0 border-0 bg-white shadow-sm text-[10px] scale-90 origin-right">{p.duration}</Tag>
                                    </div>
                                    <div className="text-xs text-zinc-500 mb-3">{p.desc}</div>
                                    <Button size="small" type="primary" className="bg-indigo-600 text-xs h-7 px-3 w-full opacity-0 group-hover:opacity-100 transition-opacity">
                                        立即应用
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Module 2: Time Recommendations */}
                <div>
                    <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3 px-1">最佳发布时间</h3>
                    <div className="bg-white rounded-xl border border-zinc-200 p-4 space-y-4 shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-black text-white flex items-center justify-center text-lg">🎵</div>
                            <div className="flex-1">
                                <div className="font-bold text-xs">抖音 (Douyin)</div>
                                <div className="text-xs text-green-600 font-mono flex items-center gap-1">
                                    <ClockCircleOutlined /> 今日推荐 12:05 / 20:30
                                </div>
                            </div>
                        </div>
                        <div className="w-full h-px bg-zinc-100" />
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-red-500 text-white flex items-center justify-center text-lg">📕</div>
                            <div className="flex-1">
                                <div className="font-bold text-xs">小红书 (RedBook)</div>
                                <div className="text-xs text-green-600 font-mono flex items-center gap-1">
                                    <ClockCircleOutlined /> 今日推荐 11:40 / 22:10
                                </div>
                            </div>
                        </div>

                        <Button block type="dashed" size="small" className="mt-2 text-indigo-600 border-indigo-200 bg-indigo-50/50">
                            一键套用推荐时间
                        </Button>
                    </div>
                </div>

                {/* Module 3: Pro Upsell */}
                <div className="bg-gradient-to-r from-zinc-900 to-zinc-800 rounded-xl p-4 text-white relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-3">
                        <CrownFilled className="text-5xl text-white/5 -rotate-12" />
                    </div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="bg-yellow-500 text-black text-[10px] font-bold px-1.5 py-0.5 rounded">PRO</span>
                            <span className="font-bold text-sm">解锁高级排期</span>
                        </div>
                        <p className="text-xs text-zinc-400 mb-3">
                            获得 AI 自动填补空缺 + 跨平台一键分发 + 数据预测分析
                        </p>
                        <Button size="small" type="primary" className="bg-yellow-500 text-black border-none font-bold w-full hover:bg-yellow-400">
                            立即升级
                        </Button>
                    </div>
                </div>

            </div>
        </div>
    );
};
