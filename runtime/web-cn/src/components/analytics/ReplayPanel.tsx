'use client';

import React from 'react';
import ReactECharts from 'echarts-for-react';
import { Button, Tag } from 'antd';
import {
    CheckCircleFilled,
    BulbFilled,
    CopyOutlined,
    ThunderboltFilled
} from '@ant-design/icons';

// ECharts Option
const getOption = () => {
    return {
        grid: { top: 20, right: 20, bottom: 20, left: 40, show: false },
        tooltip: { trigger: 'axis' },
        xAxis: {
            type: 'category',
            data: ['1h', '3h', '6h', '12h', '24h', '3d', '7d'],
            axisLine: { show: false },
            axisTick: { show: false },
            axisLabel: { color: '#9ca3af' }
        },
        yAxis: {
            type: 'value',
            splitLine: { lineStyle: { type: 'dashed', color: '#f3f4f6' } }
        },
        series: [
            {
                data: [120, 932, 2001, 3500, 12000, 45000, 102000],
                type: 'line',
                smooth: true,
                symbol: 'none',
                lineStyle: { width: 4, color: '#6366f1' },
                areaStyle: {
                    color: {
                        type: 'linear',
                        x: 0, y: 0, x2: 0, y2: 1,
                        colorStops: [
                            { offset: 0, color: 'rgba(99, 102, 241, 0.4)' },
                            { offset: 1, color: 'rgba(99, 102, 241, 0.0)' }
                        ]
                    }
                }
            }
        ]
    };
};

export const ReplayPanel = ({ selectedId }: { selectedId: string | null }) => {
    if (!selectedId) {
        return (
            <div className="flex-1 flex items-center justify-center text-zinc-400 bg-zinc-50/50 rounded-2xl border border-dashed border-zinc-200">
                请从左侧选择内容查看复盘
            </div>
        );
    }

    return (
        <div className="flex-1 bg-white rounded-2xl border border-zinc-200 h-full flex flex-col p-6 space-y-6 overflow-y-auto">
            {/* 1. One-Liner Insight */}
            <div className="bg-green-50 rounded-xl p-4 border border-green-100 flex items-start gap-4">
                <CheckCircleFilled className="text-green-500 text-xl mt-1" />
                <div>
                    <h3 className="font-bold text-green-800 text-lg mb-1">这条内容表现好：开头抓人 + 结构清晰</h3>
                    <p className="text-green-600">❗ 下次建议：标题尝试加入 具体数字，冲击力会更强。</p>
                </div>
            </div>

            {/* 2. Charts */}
            <div>
                <h4 className="font-bold text-zinc-800 mb-4 flex items-center gap-2">
                    <span className="w-1 h-4 bg-indigo-500 rounded-full" /> 播放趋势复盘
                </h4>
                <div className="h-[240px] w-full">
                    <ReactECharts option={getOption()} style={{ height: '100%', width: '100%' }} opts={{ renderer: 'svg' }} />
                </div>
            </div>

            {/* 3. Explosion Breakdown */}
            <div className="grid grid-cols-3 gap-4">
                <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-100 text-center">
                    <div className="text-xs text-zinc-400 mb-2">Hook 类型</div>
                    <div className="font-bold text-indigo-600 mb-1">反常识 (命中✅)</div>
                    <Tag color="green">优秀</Tag>
                </div>
                <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-100 text-center">
                    <div className="text-xs text-zinc-400 mb-2">内容节奏</div>
                    <div className="font-bold text-indigo-600 mb-1">快 (推荐✅)</div>
                    <Tag color="green">完美</Tag>
                </div>
                <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-100 text-center">
                    <div className="text-xs text-zinc-400 mb-2">结尾 CTA</div>
                    <div className="font-bold text-zinc-800 mb-1">弱 (需优化)</div>
                    <Tag color="orange">建议复用强引导</Tag>
                </div>
            </div>

            <div className="p-4 rounded-xl border border-dashed border-indigo-200 bg-indigo-50/30 flex items-center justify-between">
                <span className="text-sm text-indigo-900 font-medium flex items-center gap-2">
                    <BulbFilled className="text-indigo-500" />
                    觉得这个结构好用？
                </span>
                <Button type="primary" icon={<CopyOutlined className="text-xs" />} size="small" className="bg-indigo-600">一键复刻结构</Button>
            </div>

            {/* 4. Next Actions */}
            <div>
                <h4 className="font-bold text-zinc-800 mb-4 flex items-center gap-2">
                    <span className="w-1 h-4 bg-indigo-500 rounded-full" /> 为你生成的下一条建议
                </h4>
                <div className="space-y-2">
                    {['如何利用 AI 快速产出 (复用反常识开头)', '3个职场提效工具 (复用快节奏)'].map((title, i) => (
                        <div key={i} className="flex justify-between items-center p-3 rounded-lg border border-zinc-100 hover:border-indigo-200 hover:bg-zinc-50 transition-all group">
                            <div className="flex items-center gap-2">
                                <span className="bg-zinc-200 text-zinc-500 text-[10px] px-1.5 rounded">推荐 {i + 1}</span>
                                <span className="text-sm font-medium text-zinc-700 group-hover:text-zinc-900">{title}</span>
                            </div>
                            <Button size="small" type="link" icon={<ThunderboltFilled />}>生成</Button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
