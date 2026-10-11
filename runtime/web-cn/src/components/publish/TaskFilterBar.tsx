'use client';

import React, { useEffect, useState } from 'react';
import { Button, Input, Select, DatePicker, Tooltip } from 'antd';
import { ReloadOutlined, ExportOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import {
    EMPTY_PUBLISH_FILTER,
    PUBLISH_FILTER_PLATFORMS,
    PUBLISH_FILTER_STATUSES,
    isFilterActive,
    type PublishFilter,
} from '@/lib/publish-filter';

const { RangePicker } = DatePicker;

interface Props {
    value: PublishFilter;
    onChange: (next: PublishFilter) => void;
    /** 当前列表这一页里失败任务的数量；为 0 时「批量重试」置灰并说明原因 */
    failedCount: number;
    onBatchRetry: () => void;
    onExport: () => void;
    retrying?: boolean;
    exporting?: boolean;
}

/**
 * 发布中心筛选栏。原来所有控件都没有绑定事件（点了没反应），现在：
 * - 搜索（回车或点放大镜）、平台、状态、日期 → 立即重新查询后端；
 * - 「批量重试」重试当前列表里的失败任务，逐条返回结果；
 * - 「导出日志」按当前筛选条件导出本工作区的发布记录（CSV，中文表头）。
 */
export const TaskFilterBar = ({ value, onChange, failedCount, onBatchRetry, onExport, retrying, exporting }: Props) => {
    const [keyword, setKeyword] = useState(value.keyword);
    useEffect(() => setKeyword(value.keyword), [value.keyword]);

    return (
        // 手机上：搜索、日期各占一行，平台 / 状态两列，按钮两列；sm 以上恢复横排（原来挤在一行，按钮压住筛选框）
        <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between min-w-0">
            <div className="grid grid-cols-2 gap-3 min-w-0 sm:flex sm:flex-wrap sm:items-center sm:flex-1">
                <Input.Search
                    placeholder="搜索内容标题"
                    allowClear
                    value={keyword}
                    onChange={(e) => {
                        setKeyword(e.target.value);
                        // 点清除按钮时立即恢复全部
                        if (!e.target.value && value.keyword) onChange({ ...value, keyword: '' });
                    }}
                    onSearch={(text) => onChange({ ...value, keyword: text.trim() })}
                    className="col-span-2 w-full sm:w-64"
                    maxLength={100}
                />

                <Select
                    placeholder="全部平台"
                    mode="multiple"
                    className="w-full min-w-0 sm:w-auto sm:min-w-[160px]"
                    allowClear
                    maxTagCount={1}
                    value={value.platforms}
                    onChange={(platforms: string[]) => onChange({ ...value, platforms })}
                    options={PUBLISH_FILTER_PLATFORMS}
                    aria-label="按平台筛选"
                />

                <Select
                    className="w-full min-w-0 sm:w-auto sm:min-w-[150px]"
                    value={value.status}
                    onChange={(status: string) => onChange({ ...value, status })}
                    options={PUBLISH_FILTER_STATUSES}
                    aria-label="按状态筛选"
                />

                <RangePicker
                    className="col-span-2 w-full rounded-xl sm:w-auto"
                    placeholder={['开始日期', '结束日期']}
                    value={value.from && value.to ? [dayjs(value.from), dayjs(value.to)] : null}
                    onChange={(range) => onChange({
                        ...value,
                        from: range?.[0] ? range[0].format('YYYY-MM-DD') : undefined,
                        to: range?.[1] ? range[1].format('YYYY-MM-DD') : undefined,
                    })}
                />

                {isFilterActive(value) && (
                    <Button type="link" className="col-span-2 justify-self-start px-0 sm:px-2" onClick={() => onChange(EMPTY_PUBLISH_FILTER)}>清除筛选</Button>
                )}
            </div>

            <div className="grid grid-cols-2 gap-3 sm:flex sm:items-center sm:justify-end">
                <Tooltip title={failedCount === 0 ? '当前列表没有失败的任务' : `重试当前列表中的 ${failedCount} 条失败任务`}>
                    <Button className="w-full sm:w-auto" icon={<ReloadOutlined />} disabled={failedCount === 0} loading={retrying} onClick={onBatchRetry}>
                        批量重试{failedCount > 0 ? `（${failedCount}）` : ''}
                    </Button>
                </Tooltip>
                <Tooltip title="按当前筛选条件导出本工作区的发布记录（CSV，可用 Excel / WPS 打开）">
                    <Button className="w-full sm:w-auto" icon={<ExportOutlined />} loading={exporting} onClick={onExport}>导出日志</Button>
                </Tooltip>
            </div>
        </div>
    );
};
