'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Card, Empty, Progress, Skeleton, Statistic } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { apiClient } from '@/lib/api-client';

interface DashboardData {
    publish: { total: number; success: number; failed: number };
    content: { total: number; byStatus: Record<string, number> };
    accounts: { total: number; totalFollowers: number };
    engagement: { views: number; likes: number; comments: number; shares: number; saves: number; followersGained: number };
}

export default function AnalyticsPage() {
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const response: any = await apiClient.get('/analytics/dashboard');
            setData(response?.data ?? response);
        } catch (loadError) {
            setData(null);
            setError(loadError instanceof Error ? loadError.message : '数据看板加载失败');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void load(); }, [load]);
    if (loading) return <Skeleton active paragraph={{ rows: 8 }} />;
    if (error) return <Alert type="error" showIcon message="无法加载真实分析数据" description={error} action={<Button icon={<ReloadOutlined />} onClick={() => void load()}>重试</Button>} />;
    if (!data) return <Empty description="暂无分析数据" />;

    const successRate = data.publish.total ? Math.round(data.publish.success / data.publish.total * 100) : 0;
    const metrics = [
        ['真实发布', data.publish.success],
        ['发布失败', data.publish.failed],
        ['内容总数', data.content.total],
        ['连接账号', data.accounts.total],
        ['累计播放', data.engagement.views],
        ['累计互动', data.engagement.likes + data.engagement.comments + data.engagement.shares + data.engagement.saves],
        ['净增粉丝', data.engagement.followersGained],
        ['账号粉丝', data.accounts.totalFollowers],
    ];

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div><h1 className="text-3xl font-bold">数据分析</h1><p className="text-zinc-500 mt-1">近 30 天真实数据库汇总，不填充演示成绩</p></div>
                <Button icon={<ReloadOutlined />} onClick={() => void load()}>刷新</Button>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {metrics.map(([label, value]) => <Card key={String(label)}><Statistic title={label} value={Number(value)} /></Card>)}
            </div>
            <Card title="发布成功率">
                <Progress percent={successRate} status={data.publish.failed ? 'exception' : 'normal'} />
                <p className="text-sm text-zinc-500 mt-3">只在存在远端帖子 ID 的任务中计为发布成功。</p>
            </Card>
        </div>
    );
}
