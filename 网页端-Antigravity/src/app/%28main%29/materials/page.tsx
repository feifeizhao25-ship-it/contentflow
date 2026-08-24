'use client';

import React, { useState, useEffect } from 'react';
import { Card, Input, Button, Upload, Tag, Tabs, Empty, Progress, message, Modal, Typography } from 'antd';
import {
    UploadOutlined,
    VideoCameraOutlined,
    StarOutlined,
    StarFilled,
    DeleteOutlined,
    DownloadOutlined,
    CrownFilled,
    PlusOutlined
} from '@ant-design/icons';
import { motion, AnimatePresence } from 'framer-motion';
import { getUserMaterials, getStorageUsage, Material } from '@/lib/materials-service';
import { usePermissions } from '@/hooks/usePermissions';
import { useSearchParams } from 'next/navigation';
import dayjs from 'dayjs';
import { PLACEHOLDER_IMAGES } from '@/lib/placeholders';

const { Search } = Input;
const { Text } = Typography;

function MaterialsContent() {
    const { isPremium } = usePermissions();
    const searchParams = useSearchParams();
    const initialTab = searchParams.get('tab') || 'all';
    const [materials, setMaterials] = useState<Material[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [activeTab, setActiveTab] = useState(initialTab);
    const [storageUsage, setStorageUsage] = useState({ used: 0, limit: 10 * 1024 * 1024 * 1024, percentage: 0 });

    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab && tab !== activeTab) {
            setActiveTab(tab);
        }
    }, [searchParams, activeTab]);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const userId = 'me'; // Use backend auth
            const data = await getUserMaterials(userId);
            setMaterials(data);
            const usage = await getStorageUsage(userId);
            setStorageUsage(usage);
        } catch (error) {
            console.error('加载素材失败:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleUpload = async (file: File) => {
        setLoading(true);
        try {
            const { uploadMaterial } = await import('@/lib/materials-service');
            const result = await uploadMaterial('me', file);
            if (result) {
                message.success('素材上传成功');
                loadData();
            }
        } catch (error) {
            message.error('上传失败');
        } finally {
            setLoading(false);
        }
        return false;
    };

    const handleDelete = async (material: Material) => {
        Modal.confirm({
            title: '确认删除',
            content: `确定要删除"${material.name}"吗？`,
            onOk: async () => {
                try {
                    const { deleteMaterial } = await import('@/lib/materials-service');
                    await deleteMaterial(material.id!, 'me');
                    setMaterials(prev => prev.filter(m => m.id !== material.id));
                    message.success('已删除');
                } catch { message.error('删除失败'); }
            },
        });
    };

    const filteredMaterials = materials.filter(item => {
        const matchesSearch = (item.name || '').toLowerCase().includes(searchText.toLowerCase());
        const matchesTab = activeTab === 'all' ||
            (activeTab === 'image' && item.type === 'image') ||
            (activeTab === 'video' && item.type === 'video') ||
            (activeTab === 'favorite' && item.is_favorite);
        return matchesSearch && matchesTab;
    });

    return (
        <div className="max-w-[1400px] mx-auto p-4 space-y-6">
            <header className="flex items-center justify-between bg-zinc-900 p-8 rounded-3xl text-white relative overflow-hidden shadow-xl">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                <div className="relative z-10">
                    <h1 className="text-3xl font-bold mb-2">资产管理</h1>
                    <p className="text-white/60">管理您的创作素材，云端存储，全端同步。</p>
                </div>
                <div className="relative z-10 flex gap-4">
                    <Upload showUploadList={false} beforeUpload={handleUpload} accept="image/*,video/*">
                        <Button type="primary" size="large" icon={<UploadOutlined />} className="h-12 px-8 rounded-xl bg-indigo-600 border-none">上传素材</Button>
                    </Upload>
                </div>
            </header>

            <div className="grid grid-cols-12 gap-8">
                <div className="col-span-9 space-y-6">
                    <Card className="rounded-2xl shadow-sm border-zinc-100" bodyStyle={{ padding: '24px' }}>
                        <div className="flex flex-col sm:flex-row justify-between gap-4 mb-8">
                            <Tabs activeKey={activeTab} onChange={setActiveTab} items={[
                                { key: 'all', label: '全部素材' },
                                { key: 'image', label: '图片库' },
                                { key: 'video', label: '视频库' },
                                { key: 'favorite', label: '我的收藏' },
                            ]} className="flex-1 custom-tabs" />
                            <Search placeholder="搜索素材名称..." onSearch={setSearchText} onChange={e => setSearchText(e.target.value)} style={{ width: 300 }} className="rounded-xl overflow-hidden h-10" />
                        </div>

                        {loading ? (
                            <div className="grid grid-cols-4 gap-4">
                                {[1, 2, 3, 4, 5, 6, 7, 8].map(i => <div key={i} className="aspect-square bg-zinc-100 animate-pulse rounded-xl" />)}
                            </div>
                        ) : filteredMaterials.length > 0 ? (
                            <motion.div layout className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
                                <AnimatePresence>
                                    {filteredMaterials.map((item) => (
                                        <motion.div key={item.id} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}>
                                            <Card hoverable className="rounded-xl overflow-hidden group border-zinc-100" styles={{ body: { padding: 12 } }} cover={
                                                <div className="h-44 overflow-hidden bg-zinc-50 relative flex items-center justify-center">
                                                    {item.type === 'image' ? (
                                                        <img
                                                            src={item.url || PLACEHOLDER_IMAGES.material}
                                                            alt={item.name}
                                                            className="w-full h-full object-cover transition-transform group-hover:scale-110"
                                                            onError={(e) => {
                                                                const target = e.currentTarget;
                                                                if (target.src !== PLACEHOLDER_IMAGES.material) {
                                                                    target.src = PLACEHOLDER_IMAGES.material;
                                                                }
                                                            }}
                                                        />
                                                    ) : (
                                                        <div className="relative w-full h-full">
                                                            <img
                                                                src={PLACEHOLDER_IMAGES.video}
                                                                alt="video-placeholder"
                                                                className="w-full h-full object-cover"
                                                            />
                                                            <div className="absolute inset-0 flex items-center justify-center">
                                                                <VideoCameraOutlined className="text-4xl text-white/90" />
                                                            </div>
                                                        </div>
                                                    )}
                                                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <Button shape="circle" size="small" icon={item.is_favorite ? <StarFilled className="text-amber-500" /> : <StarOutlined />} className="glass-btn" />
                                                    </div>
                                                    {item.type === 'video' && <Tag color="blue" className="absolute bottom-2 left-2 rounded-md">视频</Tag>}
                                                </div>
                                            }>
                                                <div className="flex flex-col gap-1">
                                                    <Text className="text-xs font-bold truncate">{item.name}</Text>
                                                    <Text className="text-[10px] text-zinc-400">{dayjs(item.created_at).format('YYYY-MM-DD')}</Text>
                                                    <div className="flex justify-between mt-2">
                                                        <Button type="text" size="small" icon={<DownloadOutlined />} className="text-zinc-400 hover:text-indigo-600 p-0" />
                                                        <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(item)} className="p-0" />
                                                    </div>
                                                </div>
                                            </Card>
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                            </motion.div>
                        ) : <Empty description="暂无素材，点击上方按钮开始上传" className="py-20" />}
                    </Card>
                </div>

                <div className="col-span-3 space-y-6">
                    <Card title="存储空间" className="rounded-2xl shadow-sm border-zinc-100">
                        <div className="text-center py-4">
                            <Progress type="dashboard" percent={Math.round(storageUsage.percentage)} strokeColor={{ '0%': '#6366f1', '100%': '#a855f7' }} strokeWidth={10} width={140} />
                            <div className="mt-4">
                                <Text strong className="text-lg">已使用 {Math.round(storageUsage.percentage)}%</Text>
                                <div className="text-xs text-zinc-400 mt-1">云端存储总量: {isPremium ? '10GB' : '1GB'}</div>
                            </div>
                        </div>
                        {!isPremium && <Button type="primary" block className="mt-4 bg-gradient-to-r from-amber-500 to-orange-500 border-none h-10 rounded-xl" icon={<CrownFilled />}>升级扩容</Button>}
                    </Card>

                    <Card title="分类标签" className="rounded-2xl shadow-sm border-zinc-100">
                        <div className="flex flex-wrap gap-2">
                            {['风景', '人像', '科技', '美食', '职场', '萌宠'].map(tag => (
                                <Tag key={tag} className="m-0 rounded-full px-3 py-0.5 border-zinc-100 bg-zinc-50 text-zinc-600 cursor-pointer hover:bg-indigo-50 hover:text-indigo-600 transition-colors">{tag}</Tag>
                            ))}
                            <Tag icon={<PlusOutlined />} className="m-0 rounded-full border-dashed">新建</Tag>
                        </div>
                    </Card>
                </div>
            </div>

            <style jsx global>{`
                .glass-btn { background: rgba(255,255,255,0.7) !important; backdrop-filter: blur(8px); border: none !important; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
                .custom-tabs .ant-tabs-nav::before { border: none !important; }
                .custom-tabs .ant-tabs-tab-btn { font-size: 13px; font-weight: 600; color: #71717a; }
                .custom-tabs .ant-tabs-tab-active .ant-tabs-tab-btn { color: #6366f1 !important; }
                .custom-tabs .ant-tabs-ink-bar { background: #6366f1 !important; height: 3px !important; border-radius: 3px; }
            `}</style>
        </div>
    );
}

export default function MaterialsPage() {
    return (
        <React.Suspense fallback={<div>Loading materials...</div>}>
            <MaterialsContent />
        </React.Suspense>
    );
}
