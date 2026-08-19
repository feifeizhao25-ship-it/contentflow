'use client';

import React from 'react';
import { Button, Statistic } from 'antd';
import {
    ThunderboltFilled,
    CalendarOutlined,
    RiseOutlined,
    FireFilled,
    UserAddOutlined,
    CommentOutlined,
    CrownFilled
} from '@ant-design/icons';

export const ConclusionHero = () => {
    return (
        <div className="bg-gradient-to-r from-indigo-600 to-violet-600 rounded-3xl p-8 text-white relative overflow-hidden shadow-xl shadow-indigo-500/20">
            {/* Background Decor */}
            <div className="absolute top-0 right-0 p-12 opacity-10">
                <CrownFilled className="text-9xl -rotate-12" />
            </div>

            <div className="relative z-10 flex flex-col lg:flex-row gap-8 justify-between items-start lg:items-center">
                {/* Left: Main Insight */}
                <div className="space-y-4 max-w-2xl">
                    <div className="flex items-center gap-2 text-indigo-200 font-bold tracking-wider text-xs uppercase">
                        <ThunderboltFilled /> 今日增长建议
                    </div>

                    <h2 className="text-3xl font-black leading-tight">
                        🎉 你最近的爆款来自：<span className="text-yellow-300">反常识开头 + 结尾强CTA</span>
                    </h2>

                    <p className="text-indigo-100 text-lg opacity-90">
                        建议你复刻 10 条同结构内容，提升稳定爆发概率。
                    </p>

                    <div className="flex gap-4 pt-2">
                        <Button
                            type="primary"
                            size="large"
                            icon={<FireFilled />}
                            className="bg-white text-indigo-600 font-bold border-none hover:bg-indigo-50 shadow-lg h-12 px-8 rounded-full"
                        >
                            复刻爆款内容包 (10条)
                        </Button>
                        <Button
                            ghost
                            size="large"
                            icon={<CalendarOutlined />}
                            className="border-white/30 text-white hover:bg-white/10 hover:border-white h-12 px-6 rounded-full"
                        >
                            生成本周计划
                        </Button>
                    </div>
                </div>

                {/* Right: Mini Stats */}
                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 flex gap-8 border border-white/10">
                    <Statistic
                        title={<span className="text-indigo-200 text-xs">本周发布</span>}
                        value={12}
                        valueStyle={{ color: 'white', fontWeight: 'bold' }}
                        prefix={<ThunderboltFilled />}
                    />
                    <div className="w-px bg-white/10 h-12 self-center" />
                    <Statistic
                        title={<span className="text-indigo-200 text-xs">互动率</span>}
                        value={8.5}
                        suffix="%"
                        precision={1}
                        valueStyle={{ color: '#86efac', fontWeight: 'bold' }}
                        prefix={<CommentOutlined />}
                    />
                    <div className="w-px bg-white/10 h-12 self-center" />
                    <Statistic
                        title={<span className="text-indigo-200 text-xs">本周涨粉</span>}
                        value={893}
                        valueStyle={{ color: '#fca5a5', fontWeight: 'bold' }}
                        prefix={<UserAddOutlined />}
                    />
                </div>
            </div>
        </div>
    );
};
