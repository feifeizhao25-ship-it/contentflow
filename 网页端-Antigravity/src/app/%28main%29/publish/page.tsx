'use client';

import React from 'react';
import { TaskFilterBar } from '@/components/publish/TaskFilterBar';
import { PublishTaskList } from '@/components/publish/PublishTaskList';

export default function PublishPage() {
    return (
        <div className="min-h-screen p-4 md:p-8 max-w-7xl mx-auto space-y-6 pb-20">
            {/* Page Header */}
            <div>
                <h1 className="text-3xl font-black text-zinc-900 mb-2">发布中心</h1>
                <p className="text-zinc-500 font-medium">统一管理发布任务与失败修复</p>
            </div>

            {/* Filter Bar */}
            <TaskFilterBar />

            {/* Task List */}
            <PublishTaskList />
        </div>
    );
}
