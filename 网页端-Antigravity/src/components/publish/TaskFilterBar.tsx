'use client';

import React from 'react';
import { Button, Input, Select, DatePicker } from 'antd';
import { SearchOutlined, ReloadOutlined, ExportOutlined, FilterOutlined } from '@ant-design/icons';

const { RangePicker } = DatePicker;
const { Option } = Select;

export const TaskFilterBar = () => {
    return (
        <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm flex flex-wrap gap-4 items-center justify-between">
            {/* Left: Filters */}
            <div className="flex items-center gap-3 flex-wrap flex-1">
                <Input
                    placeholder="搜索任务标题..."
                    prefix={<SearchOutlined className="text-zinc-400" />}
                    className="w-64 rounded-xl"
                />

                <Select
                    placeholder="平台筛选项"
                    mode="multiple"
                    className="min-w-[160px]"
                    allowClear
                    maxTagCount={1}
                >
                    <Option value="douyin">🎵 抖音</Option>
                    <Option value="xhs">📕 小红书</Option>
                    <Option value="weixin">💬 视频号</Option>
                </Select>

                <Select
                    defaultValue="all"
                    className="min-w-[120px]"
                >
                    <Option value="all">全状态</Option>
                    <Option value="success">✅ 成功</Option>
                    <Option value="publishing">🔄 正在发布</Option>
                    <Option value="failed">❌ 失败</Option>
                </Select>

                <RangePicker className="rounded-xl" />
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-3">
                <Button icon={<ReloadOutlined />}>批量重试</Button>
                <Button icon={<ExportOutlined />}>导出日志</Button>
            </div>
        </div>
    );
};
