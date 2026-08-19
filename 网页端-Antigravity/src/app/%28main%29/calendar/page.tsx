'use client';

import React from 'react';
import { Button, Badge } from 'antd';
import { ThunderboltFilled, CalendarOutlined } from '@ant-design/icons';
import { ContentPool } from '@/components/calendar/ContentPool';
import { CalendarBoard } from '@/components/calendar/CalendarBoard';
import { StrategyPanel } from '@/components/calendar/StrategyPanel';

export default function CalendarPage() {
    return (
        <div className="h-[calc(100vh-64px)] flex flex-col overflow-hidden bg-background">
            {/* PageHeader */}
            <div className="flex-none px-6 py-4 bg-white border-b border-zinc-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-zinc-900 flex items-center gap-2">
                        <CalendarOutlined className="text-indigo-500" />
                        排期日历
                    </h1>
                    <p className="text-zinc-500 text-sm font-medium mt-1">
                        拖拽安排发布计划，智能推荐最佳时机
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="hidden lg:flex items-center gap-2 bg-orange-50 text-orange-600 px-3 py-1.5 rounded-lg text-xs font-medium border border-orange-100">
                        <Badge dot status="warning" />
                        <span>本周目标 7 条，还差 4 条</span>
                    </div>
                    <Button
                        type="primary"
                        size="large"
                        icon={<ThunderboltFilled />}
                        className="rounded-full px-6 bg-gradient-to-r from-indigo-600 to-purple-600 border-none shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:-translate-y-0.5 transition-all"
                    >
                        自动补齐本周排期
                    </Button>
                </div>
            </div>

            {/* 3-Panel Layout */}
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                {/* Left Panel: Content Pool */}
                <div className="hidden md:block flex-none h-full z-20 shadow-sm transition-all duration-300">
                    <ContentPool />
                </div>

                {/* Center Panel: Calendar Board */}
                <div className="flex-1 h-full min-w-0 z-10 w-full mb-20 md:mb-0">
                    <CalendarBoard />
                </div>

                {/* Right Panel: Strategy Panel */}
                <div className="hidden md:block flex-none h-full z-20 shadow-sm transition-all duration-300">
                    <StrategyPanel />
                </div>
            </div>
        </div>
    );
}

