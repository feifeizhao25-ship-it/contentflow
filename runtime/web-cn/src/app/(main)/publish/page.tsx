'use client';

import React, { useCallback, useState } from 'react';
import { Alert, Modal, message } from 'antd';
import { TaskFilterBar } from '@/components/publish/TaskFilterBar';
import { PublishTaskList, type PublishTaskRow } from '@/components/publish/PublishTaskList';
import { ComplianceReviewNotice } from '@/components/compliance/ComplianceReviewNotice';
import { PUBLISH_CHANNEL_NOTICE } from '@/lib/manual-publish';
import { apiClient } from '@/lib/api-client';
import { safeErrorText } from '@/lib/api-error';
import { EMPTY_PUBLISH_FILTER, downloadPublishLog, summarizeRetry, type PublishFilter } from '@/lib/publish-filter';

export default function PublishPage() {
    const [filter, setFilter] = useState<PublishFilter>(EMPTY_PUBLISH_FILTER);
    const [reloadKey, setReloadKey] = useState(0);
    const [failedIds, setFailedIds] = useState<string[]>([]);
    const [retrying, setRetrying] = useState(false);
    const [exporting, setExporting] = useState(false);

    const onLoaded = useCallback((tasks: PublishTaskRow[]) => {
        setFailedIds(tasks.filter((t) => t.status === 'failed').map((t) => t.id));
    }, []);

    const runBatchRetry = async () => {
        if (!failedIds.length) return;
        setRetrying(true);
        try {
            const result = await apiClient.post<any>('/publish/tasks/retry', { taskIds: failedIds });
            const summary = summarizeRetry(result);
            if (summary.failed.length) {
                Modal.info({
                    title: summary.text,
                    content: (
                        <ul className="mt-2 list-disc pl-5 text-sm text-zinc-600">
                            {summary.failed.map((f) => <li key={f.reason}>{f.reason}（{f.count} 条）</li>)}
                        </ul>
                    ),
                    okText: '知道了',
                });
            } else {
                message.success(summary.text);
            }
            setReloadKey((k) => k + 1);
        } catch (error) {
            message.error(safeErrorText(error, '批量重试失败，请稍后再试'));
        } finally {
            setRetrying(false);
        }
    };

    const onBatchRetry = () => {
        Modal.confirm({
            title: `重试当前列表中的 ${failedIds.length} 条失败任务？`,
            content: '每条任务会单独处理：平台通道未接通、授权失效的任务不会被重试，结果会逐条告诉你原因。',
            okText: '开始重试',
            cancelText: '取消',
            onOk: () => runBatchRetry(),
        });
    };

    const onExport = async () => {
        setExporting(true);
        try {
            const { truncated } = await downloadPublishLog(filter);
            if (truncated) message.warning('记录较多，只导出了最新的 5000 条，请缩小日期范围分批导出');
            else message.success('发布日志已导出');
        } catch (error) {
            message.error(safeErrorText(error, '导出失败，请稍后重试'));
        } finally {
            setExporting(false);
        }
    };

    return (
        <div className="min-h-screen p-0 md:p-8 max-w-7xl mx-auto space-y-6 pb-20 min-w-0">
            {/* Page Header */}
            <div>
                <h1 className="text-3xl font-black text-zinc-900 mb-2">发布中心</h1>
                <p className="text-zinc-500 font-medium">管理自动发布与人工确认发布的任务，处理失败原因</p>
            </div>

            {/* 常驻说明：哪些平台能自动发、哪些需要你手动发（如实说明，不再写「一键多平台发布」） */}
            <Alert type="info" showIcon message="各平台的发布方式" description={PUBLISH_CHANNEL_NOTICE} />
            <ComplianceReviewNotice />

            <TaskFilterBar
                value={filter}
                onChange={setFilter}
                failedCount={failedIds.length}
                onBatchRetry={onBatchRetry}
                onExport={() => void onExport()}
                retrying={retrying}
                exporting={exporting}
            />

            <PublishTaskList filter={filter} reloadKey={reloadKey} onLoaded={onLoaded} />
        </div>
    );
}
