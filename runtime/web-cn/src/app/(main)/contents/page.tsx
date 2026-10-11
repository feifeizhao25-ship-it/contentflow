'use client';

import React, { useState } from 'react';
import { Card, Table, Button, Space, Tag, Input, Select, Modal, Typography, Checkbox, Alert } from 'antd';
import { message, modal } from '@/lib/antd-app';
import { useRouter, useSearchParams } from 'next/navigation';
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
import { contentCoverUrl, parseContentList } from '@/lib/page-data';
import { safeErrorText } from '@/lib/api-error';
import { CONTENT_STATUS_COLORS, contentStatusText, contentTypeText } from '@/lib/status-labels';
import { MANUAL_PLATFORMS, PUBLISH_CHANNEL_NOTICE } from '@/lib/manual-publish';
import { contentReviewState, parseReviewPolicy, reviewNote, validateRejectReason, type ReviewPolicy } from '@/lib/content-review';

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
    const [keyword, setKeyword] = useState('');
    // 预览：原来「预览」打开的是封面地址，没有封面时打开一张示例图；现在在弹窗里看标题、正文与封面
    const [previewFor, setPreviewFor] = useState<any>(null);

    const fetchContents = async (kw: string = keyword) => {
        setLoading(true);
        try {
            const query = kw.trim() ? `&keyword=${encodeURIComponent(kw.trim())}` : '';
            const result: any = await apiClient.get(`/contents?pageSize=100${query}`);
            // apiClient 已解开 { success, data } 信封，拿到的就是 { contents, pagination }
            setData(parseContentList(result) as any);
        } catch {
            message.error('获取内容列表失败');
        } finally {
            setLoading(false);
        }
    };

    // 审核权限：能否审核、能否自行确认（单人工作区）。读不到就不给审核按钮（只少给，不多给）。
    const [policy, setPolicy] = useState<ReviewPolicy | null>(null);
    React.useEffect(() => {
        fetchContents();
        apiClient.get('/contents/review-policy').then((r) => setPolicy(parseReviewPolicy(r))).catch(() => setPolicy(null));
    }, []);

    // ── 新建 / 编辑（只有草稿和已驳回的内容能改，后端同样限制）──
    const [editor, setEditor] = useState<{ mode: 'create' | 'edit'; record?: any } | null>(null);
    const [draftTitle, setDraftTitle] = useState('');
    const [draftBody, setDraftBody] = useState('');
    const [saving, setSaving] = useState(false);
    const editorError = !draftTitle.trim() ? '请填写标题' : draftTitle.trim().length > 200 ? '标题不能超过 200 字' : !draftBody.trim() ? '请填写正文' : null;
    const openEditor = (mode: 'create' | 'edit', record?: any) => {
        setEditor({ mode, record });
        setDraftTitle(record?.title ?? '');
        setDraftBody(record?.body ?? '');
    };
    const saveEditor = async () => {
        if (!editor || editorError) return;
        const values = { title: draftTitle, body: draftBody };
        setSaving(true);
        try {
            if (editor.mode === 'create') {
                await apiClient.post('/contents', { content_type: 'article', title: values.title.trim(), body: values.body, source: 'manual' });
                message.success('已保存为草稿，确认无误后点「提交审核」');
            } else {
                await apiClient.put(`/contents/${editor.record.id}`, { title: values.title.trim(), body: values.body });
                message.success('已保存修改');
            }
            setEditor(null);
            fetchContents();
        } catch (error: any) {
            message.error(safeErrorText(error, '保存失败，请稍后重试'));
        } finally {
            setSaving(false);
        }
    };

    // ── 审核流：提交审核 / 通过 / 驳回（附原因）/ 所有者自行确认（二次确认）──
    const submitForReview = (record: any) => {
        modal.confirm({
            title: '提交审核？',
            content: '提交后进入「待审核」，审核期间不能修改。审核通过后才能发布；被驳回可以按原因修改后再提交。',
            okText: '提交审核',
            cancelText: '取消',
            onOk: async () => {
                try {
                    await apiClient.post(`/contents/${record.id}/submit`, {});
                    message.success('已提交审核');
                    fetchContents();
                } catch (error: any) {
                    message.error(safeErrorText(error, '提交失败，请稍后重试'));
                }
            },
        });
    };
    const approve = (record: any) => {
        modal.confirm({
            title: `通过「${record.title || '未命名内容'}」？`,
            content: '通过后作者即可创建发布任务。',
            okText: '通过',
            cancelText: '取消',
            onOk: async () => {
                try {
                    await apiClient.post(`/contents/${record.id}/review`, { action: 'approve' });
                    message.success('已通过审核');
                    fetchContents();
                } catch (error: any) {
                    message.error(safeErrorText(error, '操作失败，请稍后重试'));
                }
            },
        });
    };
    const [rejectFor, setRejectFor] = useState<any>(null);
    const [rejectReason, setRejectReason] = useState('');
    const [rejecting, setRejecting] = useState(false);
    const rejectError = rejectFor ? validateRejectReason(rejectReason) : null;
    const submitReject = async () => {
        if (!rejectFor || rejectError) return;
        setRejecting(true);
        try {
            await apiClient.post(`/contents/${rejectFor.id}/review`, { action: 'reject', comment: rejectReason.trim() });
            message.success('已驳回，作者会看到原因');
            setRejectFor(null);
            setRejectReason('');
            fetchContents();
        } catch (error: any) {
            message.error(safeErrorText(error, '操作失败，请稍后重试'));
        } finally {
            setRejecting(false);
        }
    };
    const [selfConfirmFor, setSelfConfirmFor] = useState<any>(null);
    const [selfChecked, setSelfChecked] = useState(false);
    const [selfNote, setSelfNote] = useState('');
    const [selfConfirming, setSelfConfirming] = useState(false);
    const submitSelfConfirm = async () => {
        if (!selfConfirmFor || !selfChecked) return;
        setSelfConfirming(true);
        try {
            await apiClient.post(`/contents/${selfConfirmFor.id}/self-confirm`, { confirm: true, note: selfNote.trim() || undefined });
            message.success('已记录为「所有者自行确认」，现在可以发布了');
            setSelfConfirmFor(null);
            fetchContents();
        } catch (error: any) {
            message.error(safeErrorText(error, '确认失败，请稍后重试'));
        } finally {
            setSelfConfirming(false);
        }
    };

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
    const router = useRouter();
    const canPublish = (record: any) => record.status === 'approved' || record.status === 'published';
    const createManualTasks = async () => {
        if (!manualFor || !manualPlatforms.length) return;
        setCreatingManual(true);
        try {
            await apiClient.post('/publish/manual-tasks', { contentId: manualFor.id, platforms: manualPlatforms });
            message.success('已创建人工发布任务，去发布中心复制文案、下载封面');
            setManualFor(null);
            router.push('/publish');
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

    /** 每条内容按状态与审核权限给出可做的事；做不了时说明在等谁。 */
    const renderReviewActions = (record: any) => {
        const state = contentReviewState(record, policy);
        return (
            <>
                {state.actions.includes('edit') && <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEditor('edit', record)}>编辑</Button>}
                {state.actions.includes('submit') && <Button type="link" size="small" onClick={() => submitForReview(record)}>提交审核</Button>}
                {state.actions.includes('review') && (
                    <>
                        <Button type="link" size="small" onClick={() => approve(record)}>通过</Button>
                        <Button type="link" size="small" danger onClick={() => { setRejectFor(record); setRejectReason(''); }}>驳回</Button>
                    </>
                )}
                {state.actions.includes('self_confirm') && (
                    <Button type="link" size="small" onClick={() => { setSelfConfirmFor(record); setSelfChecked(false); setSelfNote(''); }}>确认可发布</Button>
                )}
                {state.actions.includes('publish') && canPublish(record) && <Button type="link" size="small" onClick={() => setManualFor(record)}>发布</Button>}
            </>
        );
    };
    const renderStatus = (record: any) => {
        const state = contentReviewState(record, policy);
        const note = reviewNote(record);
        const status = record.status;
        return (
            <div className="min-w-0">
                <Tag color={statusColors[status] || 'default'}>{contentStatusText(status)}</Tag>
                {note && <div className={note.kind === 'rejected' ? 'mt-1 text-xs text-red-600 break-words' : 'mt-1 text-xs text-zinc-500 break-words'}>{note.text}</div>}
                {!note && state.hint && <div className="mt-1 text-xs text-zinc-400">{state.hint}</div>}
            </div>
        );
    };

    // 桌面表格：原来 7 列总宽约 1217px，可见区只有约 910px，「操作」列被挤到可视区外。
    // 现在类型与来源合并成一列、标题与时间限宽换行，「操作」固定在右侧，始终可见。
    const columns: ColumnsType<ContentItem> = [
        {
            title: '封面',
            key: 'cover',
            width: 64,
            // 有封面才显示；没有就留空，不再用通用示例图冒充内容封面
            render: (_: unknown, record: any) => {
                const cover = contentCoverUrl(record);
                return cover ? (
                    <Image
                        src={cover}
                        alt="封面"
                        width={40}
                        height={40}
                        unoptimized
                        style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4 }}
                        onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
                    />
                ) : <span className="text-xs text-zinc-300">无</span>;
            },
        },
        {
            title: '内容标题',
            dataIndex: 'title',
            key: 'title',
            width: 220,
            render: (text) => <Text strong className="line-clamp-2 break-words">{text || '未命名内容'}</Text>,
        },
        {
            title: '类型',
            key: 'type',
            width: 100,
            render: (_: unknown, record: any) => (
                <div className="flex flex-col items-start gap-1">
                    <Tag className="m-0">{contentTypeText(record.type)}</Tag>
                    {record.source === 'ai' ? <Tag className="m-0" color="purple">AI 生成</Tag> : <Tag className="m-0">手动创建</Tag>}
                </div>
            ),
        },
        {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            width: 200,
            render: (_status, record: any) => renderStatus(record),
        },
        {
            title: '创建时间',
            dataIndex: 'created_at',
            key: 'created_at',
            width: 110,
            render: (text: string) => <span className="text-xs text-zinc-500 whitespace-pre-line">{String(text || '').replace(' ', '\n')}</span>,
        },
        {
            title: '操作',
            key: 'action',
            width: 190,
            fixed: 'right',
            render: (_, record: any) => (
                <Space size={[4, 0]} wrap>
                    <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => setPreviewFor(record)}>预览</Button>
                    {renderReviewActions(record)}
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
        modal.confirm({
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
                        {record.source === 'ai' ? <Tag color="purple">AI 生成</Tag> : <Tag>手动创建</Tag>}
                    </div>
                    <div className="mt-2">{renderStatus(record)}</div>
                    <p className="mt-2 text-xs text-zinc-400">{record.created_at}</p>
                </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-1 border-t border-zinc-100 pt-2">
                <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => setPreviewFor(record)}>预览</Button>
                {renderReviewActions(record)}
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
                <Button type="primary" icon={<PlusOutlined />} size="large" className="self-start sm:self-auto" style={{ borderRadius: 8 }} onClick={() => openEditor('create')}>
                    新建内容
                </Button>
            </div>

            <Card style={{ borderRadius: 12, border: '1px solid #f1f5f9' }} styles={{ body: { padding: 16 } }}>
                <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="flex min-w-0 flex-col gap-3 sm:flex-row">
                        <Search
                            placeholder="搜索标题或正文"
                            allowClear
                            value={keyword}
                            onChange={(e) => setKeyword(e.target.value)}
                            onSearch={(value) => fetchContents(value)}
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
                open={editor !== null}
                title={editor?.mode === 'create' ? '新建内容' : '编辑内容'}
                okText="保存"
                cancelText="取消"
                confirmLoading={saving}
                okButtonProps={{ disabled: Boolean(editorError) }}
                onOk={() => void saveEditor()}
                onCancel={() => setEditor(null)}
                width={720}
                style={{ maxWidth: 'calc(100vw - 32px)' }}
                destroyOnHidden
            >
                {editor?.record?.status === 'rejected' && reviewNote(editor.record) && (
                    <Alert type="error" showIcon className="mb-4" message={reviewNote(editor.record)!.text} />
                )}
                {editor?.record?.source === 'ai' && (
                    <Alert type="info" showIcon className="mb-4" message="这是 AI 生成的内容，保存时会自动保留开头的「AI 生成」标识。" />
                )}
                <label className="mb-1 block text-sm text-zinc-600" htmlFor="content-editor-title">标题</label>
                <Input id="content-editor-title" className="mb-4" maxLength={200} value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)} placeholder="内容标题" />
                <label className="mb-1 block text-sm text-zinc-600" htmlFor="content-editor-body">正文</label>
                <Input.TextArea id="content-editor-body" rows={10} value={draftBody} onChange={(e) => setDraftBody(e.target.value)} placeholder="正文内容" />
                <p className="mt-2 text-xs text-zinc-400">{editorError && (draftTitle || draftBody) ? editorError : '保存后是草稿，点「提交审核」，审核通过后才能发布。'}</p>
            </Modal>

            <Modal
                open={rejectFor !== null}
                title={`驳回：${rejectFor?.title || '未命名内容'}`}
                okText="驳回"
                okButtonProps={{ danger: true, disabled: Boolean(rejectError) }}
                cancelText="取消"
                confirmLoading={rejecting}
                onOk={() => void submitReject()}
                onCancel={() => setRejectFor(null)}
                style={{ maxWidth: 'calc(100vw - 32px)' }}
            >
                <p className="mb-2 text-sm text-zinc-600">请写明需要修改的地方，作者会在内容库看到这段原因。</p>
                <Input.TextArea rows={4} maxLength={500} showCount value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="例如：标题里的「最好」属于绝对化用语，请改为具体描述" />
                {rejectReason && rejectError && <p className="mt-1 text-xs text-red-600">{rejectError}</p>}
            </Modal>

            <Modal
                open={selfConfirmFor !== null}
                title="自行确认后发布"
                okText="确认可以发布"
                cancelText="取消"
                okButtonProps={{ disabled: !selfChecked }}
                confirmLoading={selfConfirming}
                onOk={() => void submitSelfConfirm()}
                onCancel={() => setSelfConfirmFor(null)}
                style={{ maxWidth: 'calc(100vw - 32px)' }}
            >
                <Alert
                    type="warning"
                    showIcon
                    className="mb-4"
                    message="你的工作区里没有其他所有者或管理员，没有人能替你审核"
                    description="确认后这条内容会标记为「所有者自行确认」，并记录确认人和时间，以后添加的团队成员也能在内容库看到。如需他人把关，可以在团队页邀请管理员后再由对方审核。"
                />
                <p className="mb-2 text-sm font-medium text-zinc-800">「{selfConfirmFor?.title || '未命名内容'}」</p>
                <Checkbox checked={selfChecked} onChange={(e) => setSelfChecked(e.target.checked)}>
                    我已自行检查：没有违禁词和「最好」「第一」之类的绝对化用语；AI 生成的内容保留了「AI 生成」标识；图文不侵犯他人权利。
                </Checkbox>
                <Input className="mt-3" maxLength={200} value={selfNote} onChange={(e) => setSelfNote(e.target.value)} placeholder="备注（选填），例如：已核对产品功效描述" />
            </Modal>

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
                open={previewFor !== null}
                title={previewFor?.title || '未命名内容'}
                footer={null}
                onCancel={() => setPreviewFor(null)}
                width={720}
                style={{ maxWidth: 'calc(100vw - 32px)' }}
            >
                <div className="space-y-3">
                    <div className="flex flex-wrap gap-1">
                        <Tag>{contentTypeText(previewFor?.type)}</Tag>
                        <Tag color={statusColors[previewFor?.status] || 'default'}>{contentStatusText(previewFor?.status)}</Tag>
                        {previewFor?.source === 'ai' ? <Tag color="purple">AI 生成</Tag> : <Tag>手动创建</Tag>}
                    </div>
                    {previewFor?.cover_url && (
                        <div className="relative aspect-video w-full max-w-md overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100">
                            <Image src={previewFor.cover_url} alt="封面" fill unoptimized className="object-cover" sizes="448px" />
                            {previewFor.source === 'ai' && <div className="absolute left-2 top-2 rounded bg-black/60 px-2 py-0.5 text-[11px] text-white">AI 生成</div>}
                        </div>
                    )}
                    <div className="max-h-[50vh] overflow-y-auto whitespace-pre-wrap break-words rounded-lg bg-zinc-50 p-3 text-sm leading-7 text-zinc-700">
                        {previewFor?.body || '这条内容还没有正文'}
                    </div>
                </div>
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
