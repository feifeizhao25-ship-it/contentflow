'use client';

import React, { useState } from 'react';
import { Card, Table, Button, Space, Tag, Input, Select, Modal, message, Typography, Checkbox, Alert } from 'antd';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
const { Text } = Typography;
import {
    PlusOutlined,
    EditOutlined,
    DeleteOutlined,
    SearchOutlined,
    EyeOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { apiClient } from '@/lib/api-client';
import { parseContentList } from '@/lib/page-data';
import { PLACEHOLDER_IMAGES } from '@/lib/placeholders';
import { safeErrorText } from '@/lib/api-error';
import { CONTENT_STATUS_COLORS, contentStatusText, contentTypeText } from '@/lib/status-labels';
import { MANUAL_PLATFORMS, PUBLISH_CHANNEL_NOTICE } from '@/lib/manual-publish';

const { Search } = Input;
const { Option } = Select;

interface ContentItem {
    key: string;
    title: string;
    type: 'article' | 'video' | 'image';
    status: 'draft' | 'pending' | 'approved' | 'published';
    platforms: string[];
    created_at: string;
    views?: number;
}

interface ContentAsset {
    type: string;
    url: string;
    label?: string;
    meta?: any;
}

function ContentsContent() {
    const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<any[]>([]);
    const [assetOpen, setAssetOpen] = useState(false);
    const [assetLoading, setAssetLoading] = useState(false);
    const [assetTitle, setAssetTitle] = useState('');
    const [assetItems, setAssetItems] = useState<ContentAsset[]>([]);
    const [reviewReport, setReviewReport] = useState<any>(null);
    const [activeContentId, setActiveContentId] = useState<string>('');
    const [versionItems, setVersionItems] = useState<any[]>([]);
    const [diffOpen, setDiffOpen] = useState(false);
    const [diffLoading, setDiffLoading] = useState(false);
    const [diffData, setDiffData] = useState<any>(null);
    const [diffTitle, setDiffTitle] = useState('');

    const renderInlineDiff = (fromValue: any, toValue: any) => {
        const fromText = typeof fromValue === 'string' ? fromValue : JSON.stringify(fromValue || '');
        const toText = typeof toValue === 'string' ? toValue : JSON.stringify(toValue || '');
        const maxLen = 360;

        const a = fromText.slice(0, maxLen);
        const b = toText.slice(0, maxLen);

        let start = 0;
        while (start < a.length && start < b.length && a[start] === b[start]) start += 1;

        let endA = a.length - 1;
        let endB = b.length - 1;
        while (endA >= start && endB >= start && a[endA] === b[endB]) {
            endA -= 1;
            endB -= 1;
        }

        const prefix = a.slice(0, start);
        const aDiff = a.slice(start, endA + 1);
        const bDiff = b.slice(start, endB + 1);
        const suffix = a.slice(endA + 1);

        return (
            <div className="space-y-1">
                <div className="text-xs text-zinc-500">从：</div>
                <div className="text-sm text-zinc-700 whitespace-pre-wrap">
                    {prefix}
                    {aDiff ? <span className="bg-red-100 text-red-700 px-1 rounded">{aDiff}</span> : null}
                    {suffix}
                </div>
                <div className="text-xs text-zinc-500">到：</div>
                <div className="text-sm text-zinc-700 whitespace-pre-wrap">
                    {prefix}
                    {bDiff ? <span className="bg-emerald-100 text-emerald-700 px-1 rounded">{bDiff}</span> : null}
                    {suffix}
                </div>
            </div>
        );
    };

    const fetchContents = async () => {
        setLoading(true);
        try {
            const result: any = await apiClient.get('/contents');
            // apiClient 已解开 { success, data } 信封，拿到的就是 { contents, pagination }
            setData(parseContentList(result) as any);
        } catch {
            message.error('获取内容列表失败');
        } finally {
            setLoading(false);
        }
    };

    React.useEffect(() => {
        fetchContents();
    }, []);

    // Sync tab with URL
    const searchParams = useSearchParams();
    React.useEffect(() => {
        const status = searchParams.get('status');
        if (status) {
            setStatusFilter(status);
        }
    }, [searchParams]);

    const statusColors = CONTENT_STATUS_COLORS;

    // 人工确认发布（小红书 / 视频号 / 公众号）：只对已通过审核的内容开放
    const [manualFor, setManualFor] = useState<any>(null);
    const [manualPlatforms, setManualPlatforms] = useState<string[]>(['xhs']);
    const [creatingManual, setCreatingManual] = useState(false);
    const canPublish = (record: any) => record.status === 'approved' || record.status === 'published';
    const createManualTasks = async () => {
        if (!manualFor || !manualPlatforms.length) return;
        setCreatingManual(true);
        try {
            await apiClient.post('/publish/manual-tasks', { contentId: manualFor.id, platforms: manualPlatforms });
            message.success('已创建人工发布任务，去发布中心复制文案、下载封面');
            setManualFor(null);
            window.location.href = '/publish';
        } catch (error: any) {
            message.error(safeErrorText(error, '创建失败，请稍后重试'));
        } finally {
            setCreatingManual(false);
        }
    };

    const filteredData = statusFilter === 'all'
        ? data
        : data.filter(item => item.status === statusFilter);

    const handleDelete = async (id: string) => {
        try {
            // 失败会抛出（apiClient 对非 2xx 抛错），走到这里就是删除成功
            await apiClient.delete(`/contents/${id}`);
            message.success('内容已删除');
            fetchContents();
        } catch (error: any) {
            message.error('删除失败：' + safeErrorText(error, '请稍后重试'));
        }
    };

    const handleOpenAssets = async (record: any) => {
        setAssetOpen(true);
        setAssetTitle(record.title || '内容资产');
        setActiveContentId(record.id);
        setAssetLoading(true);
        setReviewReport(null);
        setVersionItems([]);
        try {
            const res: any = await apiClient.get(`/contents/${record.id}/assets`);
            const assets = res?.data?.assets || res?.assets || [];
            setAssetItems(assets);

            const versionRes: any = await apiClient.get(`/contents/${record.id}/versions`);
            const versions = versionRes?.data?.items || versionRes?.items || [];
            setVersionItems(versions);
        } catch (e) {
            setAssetItems([]);
        } finally {
            setAssetLoading(false);
        }
    };

    const handleCloneToStudio = async () => {
        if (!activeContentId) return;
        setAssetLoading(true);
        try {
            const res: any = await apiClient.post(`/contents/${activeContentId}/clone`, {});
            const clonedId = res?.data?.id || res?.id;
            const targetId = clonedId || activeContentId;
            window.location.href = `/studio?contentId=${targetId}`;
        } catch (e: any) {
            message.error(safeErrorText(e, '复用失败'));
        } finally {
            setAssetLoading(false);
        }
    };

    const handleCompareVersion = async (targetId: string, title?: string) => {
        if (!activeContentId || !targetId) return;
        setDiffOpen(true);
        setDiffLoading(true);
        setDiffTitle(title || '版本对比');
        try {
            const res: any = await apiClient.get(`/contents/${activeContentId}/compare?targetId=${targetId}`);
            const payload = res?.data || res;
            setDiffData(payload);
        } catch (e: any) {
            setDiffData({ error: safeErrorText(e, '对比失败') });
        } finally {
            setDiffLoading(false);
        }
    };

    const handleRollbackVersion = async (targetId: string) => {
        if (!activeContentId || !targetId) return;
        setAssetLoading(true);
        try {
            const res: any = await apiClient.post(`/contents/${activeContentId}/rollback`, { targetId });
            const rollbackId = res?.data?.id || res?.id;
            if (rollbackId) {
                window.location.href = `/studio?contentId=${rollbackId}`;
            }
        } catch (e: any) {
            message.error(safeErrorText(e, '回滚失败'));
        } finally {
            setAssetLoading(false);
        }
    };

    const handleGenerateReview = async (record: any) => {
        setAssetLoading(true);
        try {
            const res: any = await apiClient.post(`/contents/${record.id}/review/generate`, {});
            const report = res?.data?.report || res?.report;
            setReviewReport(report);
        } catch (e: any) {
            setReviewReport({ raw: safeErrorText(e, '复盘生成失败') });
        } finally {
            setAssetLoading(false);
        }
    };

    const columns: ColumnsType<ContentItem> = [
        {
            title: '预览',
            dataIndex: 'media_urls',
            key: 'preview',
            width: 80,
            render: (media: string[]) => {
                const mediaUrl = media && media[0] ? media[0] : '';
                if (mediaUrl.endsWith('.mp4')) {
                    return (
                        <div style={{ width: 40, height: 40, background: '#000', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <EyeOutlined style={{ color: '#fff' }} />
                        </div>
                    );
                }
                return (
                    <Image
                        src={mediaUrl || PLACEHOLDER_IMAGES.content}
                        alt="内容预览"
                        width={40}
                        height={40}
                        unoptimized
                        style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4 }}
                        onError={(e) => {
                            const target = e.currentTarget;
                            if (target.src !== PLACEHOLDER_IMAGES.content) {
                                target.src = PLACEHOLDER_IMAGES.content;
                            }
                        }}
                    />
                );
            }
        },
        {
            title: '内容标题',
            dataIndex: 'title',
            key: 'title',
            width: '25%',
            render: (text) => <Text strong>{text}</Text>,
        },
        {
            title: '类型',
            dataIndex: 'type',
            key: 'type',
            render: (type) => <Tag>{contentTypeText(type)}</Tag>,
        },
        {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            render: (status) => (
                <Tag color={statusColors[status] || 'default'}>{contentStatusText(status)}</Tag>
            ),
        },
        {
            title: '创建渠道',
            dataIndex: 'source',
            key: 'source',
            render: (source) => source === 'ai' ? <Tag color="purple">AI 生成</Tag> : <Tag>手动创建</Tag>,
        },
        {
            title: '创建时间',
            dataIndex: 'created_at',
            key: 'created_at',
        },
        {
            title: '操作',
            key: 'action',
            width: 200,
            render: (_, record: any) => (
                <Space size="small">
                    <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => window.open(record.media_urls?.[0] || PLACEHOLDER_IMAGES.content, '_blank')}>预览</Button>
                    <Button type="link" size="small" onClick={() => handleOpenAssets(record)}>资产</Button>
                    {canPublish(record) && <Button type="link" size="small" onClick={() => setManualFor(record)}>发布</Button>}
                    <Button type="link" size="small" icon={<EditOutlined />}>编辑</Button>
                    <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record.id)}>删除</Button>
                </Space>
            ),
        },
    ];

    const rowSelection = {
        selectedRowKeys,
        onChange: (newSelectedRowKeys: React.Key[]) => {
            setSelectedRowKeys(newSelectedRowKeys);
        },
    };

    const handleBatchDelete = () => {
        Modal.confirm({
            title: '确认一键清理',
            content: `确定要删除选中的 ${selectedRowKeys.length} 条内容吗？此操作不可撤销。`,
            onOk: async () => {
                for (const key of selectedRowKeys) {
                    await apiClient.delete(`/contents/${String(key)}`);
                }
                message.success('批量删除完成');
                setSelectedRowKeys([]);
                fetchContents();
            },
        });
    };

    // 手机（<768px）上表格横向溢出、标题一字一行：窄屏改为卡片列表，标题区单列。
    const renderCard = (record: any) => (
        <div key={record.key} className="min-w-0 rounded-xl border border-zinc-200 bg-white p-4">
            <div className="flex items-start gap-3">
                <input
                    type="checkbox"
                    aria-label="选择这条内容"
                    className="mt-1 h-4 w-4 shrink-0"
                    checked={selectedRowKeys.includes(record.key)}
                    onChange={(e) => setSelectedRowKeys(e.target.checked
                        ? [...selectedRowKeys, record.key]
                        : selectedRowKeys.filter((k) => k !== record.key))}
                />
                <div className="min-w-0 flex-1">
                    <p className="break-words text-base font-bold leading-6 text-zinc-900">{record.title || '未命名内容'}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                        <Tag>{contentTypeText(record.type)}</Tag>
                        <Tag color={statusColors[record.status] || 'default'}>{contentStatusText(record.status)}</Tag>
                        {record.source === 'ai' ? <Tag color="purple">AI 生成</Tag> : <Tag>手动创建</Tag>}
                    </div>
                    <p className="mt-2 text-xs text-zinc-400">{record.created_at}</p>
                </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-1 border-t border-zinc-100 pt-2">
                <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => window.open(record.media_urls?.[0] || PLACEHOLDER_IMAGES.content, '_blank')}>预览</Button>
                <Button type="link" size="small" onClick={() => handleOpenAssets(record)}>资产</Button>
                {canPublish(record) && <Button type="link" size="small" onClick={() => setManualFor(record)}>发布</Button>}
                <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record.id)}>删除</Button>
            </div>
        </div>
    );

    return (
        <div className="min-w-0 px-0 sm:px-6">
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                    <h1 className="m-0 whitespace-nowrap text-2xl font-bold">内容库管理</h1>
                    <Text type="secondary">管理您的所有 AI 创作与手动上传的内容</Text>
                </div>
                <Button type="primary" icon={<PlusOutlined />} size="large" className="self-start sm:self-auto" style={{ borderRadius: 8 }}>
                    手动上传内容
                </Button>
            </div>

            <Card style={{ borderRadius: 12, border: '1px solid #f1f5f9' }} styles={{ body: { padding: 16 } }}>
                <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="flex min-w-0 flex-col gap-3 sm:flex-row">
                        <Search
                            placeholder="全量搜索标题、关键词..."
                            allowClear
                            className="w-full sm:w-80"
                            prefix={<SearchOutlined />}
                            size="large"
                        />
                        <Select
                            className="w-full sm:w-40"
                            value={statusFilter}
                            onChange={setStatusFilter}
                            size="large"
                        >
                            <Option value="all">全部内容状态</Option>
                            <Option value="draft">草稿</Option>
                            <Option value="pending_review">待审核</Option>
                            <Option value="approved">已通过</Option>
                            <Option value="rejected">已驳回</Option>
                            <Option value="published">已发布</Option>
                        </Select>
                    </div>

                    {selectedRowKeys.length > 0 && (
                        <Space wrap>
                            <Tag color="blue">已选中 {selectedRowKeys.length} 项</Tag>
                            <Button danger onClick={handleBatchDelete}>批量永久删除</Button>
                        </Space>
                    )}
                </div>

                <div className="space-y-3 md:hidden">
                    {loading ? (
                        <p className="text-sm text-zinc-500">内容加载中…</p>
                    ) : filteredData.length === 0 ? (
                        <p className="text-sm text-zinc-500">暂无内容</p>
                    ) : (
                        filteredData.map(renderCard)
                    )}
                    {!loading && filteredData.length > 0 && <p className="text-center text-xs text-zinc-400">共 {filteredData.length} 条内容</p>}
                </div>

                <div className="hidden md:block">
                <Table
                    rowSelection={rowSelection}
                    columns={columns}
                    dataSource={filteredData}
                    loading={loading}
                    pagination={{
                        total: filteredData.length,
                        pageSize: 10,
                        showSizeChanger: true,
                        showTotal: (total) => `共 ${total} 条内容`,
                    }}
                    style={{ background: '#fff' }}
                    scroll={{ x: 'max-content' }}
                />
                </div>
            </Card>

            <Modal
                open={manualFor !== null}
                title={`发布：${manualFor?.title || '未命名内容'}`}
                okText="创建人工发布任务"
                cancelText="取消"
                confirmLoading={creatingManual}
                okButtonProps={{ disabled: manualPlatforms.length === 0 }}
                onOk={() => void createManualTasks()}
                onCancel={() => setManualFor(null)}
                style={{ maxWidth: 'calc(100vw - 32px)' }}
            >
                <Alert type="info" showIcon className="mb-4" message={PUBLISH_CHANNEL_NOTICE} />
                <Checkbox.Group
                    value={manualPlatforms}
                    onChange={(v) => setManualPlatforms(v as string[])}
                    options={MANUAL_PLATFORMS.map((p) => ({ label: `${p.icon} ${p.name}`, value: p.id }))}
                />
            </Modal>

            <Modal
                open={assetOpen}
                title={assetTitle || '内容资产'}
                onCancel={() => setAssetOpen(false)}
                footer={null}
                width={820}
                style={{ maxWidth: 'calc(100vw - 32px)' }}
            >
                <div className="space-y-4">
                    <div className="flex items-center gap-3">
                        <Button size="small" loading={assetLoading} onClick={() => handleGenerateReview({ id: activeContentId })}>
                            生成复盘
                        </Button>
                        <Button size="small" onClick={handleCloneToStudio}>
                            复用为内容包
                        </Button>
                    </div>

                    {assetLoading ? (
                        <div className="text-sm text-zinc-500">加载中...</div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {assetItems.length === 0 ? (
                                <div className="text-sm text-zinc-500">暂无资产</div>
                            ) : (
                                assetItems.map((asset, index) => (
                                    <div key={`${asset.type}-${index}`} className="border border-zinc-200 rounded-lg p-3 bg-zinc-50">
                                        <div className="text-xs text-zinc-500 mb-1">{asset.label || asset.type}</div>
                                        {asset.url ? (
                                            <a className="text-sm text-emerald-700" href={asset.url} target="_blank" rel="noreferrer">{asset.url}</a>
                                        ) : (
                                            <div className="text-sm text-zinc-700 whitespace-pre-wrap">{asset.meta?.content || '无内容'}</div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {reviewReport ? (
                        <div className="border border-amber-200 bg-amber-50/60 rounded-lg p-4 text-sm text-zinc-700 whitespace-pre-wrap">
                            {reviewReport.raw || JSON.stringify(reviewReport, null, 2)}
                        </div>
                    ) : null}

                    {versionItems.length > 0 ? (
                        <div className="border border-zinc-200 rounded-lg p-4 bg-white/70">
                            <div className="text-sm font-semibold text-zinc-700 mb-2">版本链</div>
                            <div className="space-y-2 text-sm text-zinc-600">
                                {versionItems.map((item) => (
                                    <div key={item.id} className="flex items-center justify-between">
                                        <div>
                                            <span className="font-semibold">{item.is_root ? '源' : `V${item.version}`}</span>
                                            <span className="ml-2">{item.title || '未命名内容'}</span>
                                            <span className="ml-2 text-xs text-zinc-400">{new Date(item.created_at).toLocaleString()}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button size="small" onClick={() => handleCompareVersion(item.id, item.title)}>
                                                对比
                                            </Button>
                                            <Button size="small" onClick={() => window.location.href = `/studio?contentId=${item.id}`}>复用</Button>
                                            <Button size="small" onClick={() => handleRollbackVersion(item.id)}>回滚</Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : null}
                </div>
            </Modal>

            <Modal
                open={diffOpen}
                title={diffTitle || '版本对比'}
                onCancel={() => setDiffOpen(false)}
                footer={null}
                width={920}
                style={{ maxWidth: 'calc(100vw - 32px)' }}
            >
                {diffLoading ? (
                    <div className="text-sm text-zinc-500">对比中...</div>
                ) : diffData?.error ? (
                    <div className="text-sm text-red-500">{diffData.error}</div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-zinc-700">
                        <div className="border border-zinc-200 rounded-lg p-3 bg-white/70">
                            <div className="font-semibold mb-2">当前版本</div>
                            <div className="text-xs text-zinc-500 mb-2">标题：{diffData?.base?.title || '未命名'}</div>
                            <div className="text-xs text-zinc-500 mb-2">封面：{diffData?.base?.cover_url || '无'}</div>
                            <div className="whitespace-pre-wrap">{diffData?.base?.body || '无正文'}</div>
                        </div>
                        <div className="border border-zinc-200 rounded-lg p-3 bg-white/70">
                            <div className="font-semibold mb-2">目标版本</div>
                            <div className="text-xs text-zinc-500 mb-2">标题：{diffData?.target?.title || '未命名'}</div>
                            <div className="text-xs text-zinc-500 mb-2">封面：{diffData?.target?.cover_url || '无'}</div>
                            <div className="whitespace-pre-wrap">{diffData?.target?.body || '无正文'}</div>
                        </div>
                        {Array.isArray(diffData?.changes) && diffData.changes.length > 0 ? (
                            <div className="md:col-span-2 border border-amber-200 rounded-lg p-3 bg-amber-50/60">
                                <div className="font-semibold mb-2">差异摘要</div>
                                <div className="space-y-2">
                                    {diffData.changes.map((change: any, idx: number) => (
                                        <div key={`${change.field}-${idx}`}>
                                            <div className="text-xs text-zinc-500 mb-1">{change.field}</div>
                                            {renderInlineDiff(change.from || '', change.to || '')}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : null}
                    </div>
                )}
            </Modal>
        </div>
    );
}

export default function ContentsPage() {
    return (
        <React.Suspense fallback={<div>内容加载中…</div>}>
            <ContentsContent />
        </React.Suspense>
    );
}
