'use client';

import React from 'react';
import { Alert } from 'antd';
import { TaskFilterBar } from '@/components/publish/TaskFilterBar';
import { PublishTaskList } from '@/components/publish/PublishTaskList';
import { ComplianceReviewNotice } from '@/components/compliance/ComplianceReviewNotice';
import { PUBLISH_CHANNEL_NOTICE } from '@/lib/manual-publish';

export default function PublishPage() {
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

            {/* Filter Bar */}
            <TaskFilterBar />

            {/* Task List */}
            <PublishTaskList />
        </div>
    );
}
