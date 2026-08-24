'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, Row, Col, Input, Button, Upload, Tag, Space, Tabs, Empty, Progress, message, Modal, List, Typography, Tooltip, Divider } from 'antd';
import {
    UploadOutlined,
    SearchOutlined,
    FolderOpenOutlined,
    PictureOutlined,
    VideoCameraOutlined,
    StarOutlined,
    StarFilled,
    DeleteOutlined,
    DownloadOutlined,
    PlusOutlined,
    GlobalOutlined,
    GithubOutlined,
    LinkOutlined,
    InfoCircleOutlined,
    CloudOutlined,
    CrownFilled,
} from '@ant-design/icons';
import type { UploadProps } from 'antd';
import { supabase } from '@/lib/supabase';
import { getUserMaterials, getStorageUsage, Material } from '@/lib/materials-service';
import { usePermissions } from '@/hooks/usePermissions';
import clsx from 'clsx';

const { Search } = Input;
const { Title, Text, Paragraph } = Typography;

const EXTERNAL_RESOURCES = [
    { name: 'Unsplash', description: '全球知名的超高质量无版权图片库', url: 'https://unsplash.com', tags: ['图片', '高清', '摄影'], icon: <PictureOutlined /> },
    { name: 'Pexels', description: '优秀的免费高清视频与图片共享社区', url: 'https://www.pexels.com', tags: ['图片', '视频', 'CC0'], icon: <VideoCameraOutlined /> },
    { name: 'Pixabay', description: '不仅有图文视频，还有矢量图和音乐素材', url: 'https://pixabay.com', tags: ['文案', '音乐', '插画'], icon: <GlobalOutlined /> },
    { name: 'Mixkit', description: '由 Envato 提供的免费视频片段、音乐和模版', url: 'https://mixkit.co', tags: ['视频模板', '音效', '转场'], icon: <VideoCameraOutlined /> },
    { name: 'Awesome Stock Resources', description: 'GitHub 上最全的开源素材聚合项目', url: 'https://github.com/neutraltone/awesome-stock-resources', tags: ['GitHub', '聚合', '开源'], icon: <GithubOutlined /> },
];

// 格式化文件大小
function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default function MaterialsPage() {
    // 权限系统
    const { isPremium, plan } = usePermissions();

    const [materials, setMaterials] = useState<Material[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [activeTab, setActiveTab] = useState('all');
    const [storageUsage, setStorageUsage] = useState({ used: 0, limit: 10 * 1024 * 1024 * 1024, percentage: 0 });
    const [userId, setUserId] = useState<string | null>(null);

    // 获取用户ID并加载数据
    useEffect(() => {
        const init = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setUserId(user.id);
                await loadMaterials(user.id);
                await loadStorageUsage(user.id);
            }
        };
        init();
    }, []);

    const loadMaterials = async (uid: string) => {
        setLoading(true);
        try {
            const data = await getUserMaterials(uid);
            setMaterials(data);
        } catch (error) {
            console.error('加载素材失败:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadStorageUsage = async (uid: string) => {
        try {
            const usage = await getStorageUsage(uid);
            setStorageUsage(usage);
        } catch (error) {
            console.error('加载存储使用量失败:', error);
        }
    };

    // 处理文件上传
    const handleUpload = async (file: File) => {
        if (!userId) {
            message.error('请先登录');
            return false;
        }

        setLoading(true);
        try {
            // 动态导入素材服务
            const { uploadMaterial } = await import('@/lib/materials-service');
            const result = await uploadMaterial(userId, file);
            
            if (result) {
                message.success('素材上传成功');
                await loadMaterials(userId);
                await loadStorageUsage(userId);
            } else {
                message.error('上传失败');
            }
        } catch (error) {
            console.error('上传失败:', error);
            message.error('上传失败');
        } finally {
            setLoading(false);
        }
        
        return false; // 阻止默认上传行为
    };

    // 删除素材
    const handleDelete = async (material: Material) => {
        if (!userId) return;
        
        Modal.confirm({
            title: '确认删除',
            content: `确定要删除"${material.name}"吗？此操作不可撤销。`,
            onOk: async () => {
                try {
                    const { deleteMaterial } = await import('@/lib/materials-service');
                    const success = await deleteMaterial(material.id!, userId);
                    
                    if (success) {
                        setMaterials(materials.filter(m => m.id !== material.id));
                        message.success('删除成功');
                        await loadStorageUsage(userId);
                    } else {
                        message.error('删除失败');
                    }
                } catch (error) {
                    console.error('删除失败:', error);
                    message.error('删除失败');
                }
            },
        });
    };

    // 切换收藏
    const handleToggleFavorite = async (material: Material) => {
        if (!userId) return;
        
        try {
            const { toggleFavorite } = await import('@/lib/materials-service');
            await toggleFavorite(material.id!, userId);
            
            // 更新本地状态
            setMaterials(materials.map(m => 
                m.id === material.id 
                    ? { ...m, is_favorite: !m.is_favorite } 
                    : m
            ));
        } catch (error) {
            console.error('操作失败:', error);
        }
    };

    // 筛选素材
    const filteredMaterials = materials.filter(item => {
        const matchesSearch = item.name.toLowerCase().includes(searchText.toLowerCase());
        const matchesTab = activeTab === 'all' ||
            (activeTab === 'image' && item.type === 'image') ||
            (activeTab === 'video' && item.type === 'video') ||
            (activeTab === 'favorite' && item.is_favorite);
        return matchesSearch && matchesTab;
    });

    const tabItems = [
        { key: 'all', label: '全部' },
        { key: 'image', label: '图片' },
        { key: 'video', label: '视频' },
        { key: 'favorite', label: '收藏' },
    ];

    return (
        <div className="min-h-screen bg-zinc-50">
            <div className="max-w-7xl mx-auto p-6">
                {/* 页面标题 */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-zinc-900">素材库</h1>
                        <p className="text-zinc-500 text-sm mt-1">管理您的图片和视频素材</p>
                    </div>
                    <Upload
                        showUploadList={false}
                        beforeUpload={handleUpload}
                        accept="image/*,video/*"
                    >
                        <Button type="primary" icon={<UploadOutlined />} className="!rounded-lg">
                            上传素材
                        </Button>
                    </Upload>
                </div>

                <Row gutter={24}>
                    <Col xs={24} lg={16}>
                        <Card style={{ borderRadius: 16 }} className="border-zinc-200">
                            <div className="flex flex-col sm:flex-row justify-between gap-4 mb-6">
                                <Tabs
                                    activeKey={activeTab}
                                    onChange={setActiveTab}
                                    items={tabItems}
                                    className="flex-1"
                                />
                                <Search
                                    placeholder="搜索素材..."
                                    onSearch={setSearchText}
                                    style={{ width: 250 }}
                                    prefix={<SearchOutlined />}
                                    allowClear
                                />
                            </div>

                            {loading && materials.length === 0 ? (
                                <div className="text-center py-20">
                                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
                                    <p className="text-zinc-500 mt-4">加载中...</p>
                                </div>
                            ) : filteredMaterials.length > 0 ? (
                                <Row gutter={[16, 16]}>
                                    {filteredMaterials.map((item) => (
                                        <Col xs={12} sm={8} key={item.id}>
                                            <Card
                                                hoverable
                                                styles={{ body: { padding: 8 } }}
                                                style={{ borderRadius: 12, overflow: 'hidden' }}
                                                cover={
                                                    <div className="h-40 overflow-hidden bg-zinc-100 relative flex items-center justify-center">
                                                        {item.type === 'image' ? (
                                                            <img 
                                                                alt={item.name} 
                                                                src={item.url} 
                                                                className="max-w-full max-h-full object-contain" 
                                                            />
                                                        ) : (
                                                            <VideoCameraOutlined style={{ fontSize: 48, color: '#9ca3af' }} />
                                                        )}
                                                        <div className="absolute top-2 right-2">
                                                            <Button
                                                                shape="circle"
                                                                size="small"
                                                                icon={item.is_favorite ? <StarFilled style={{ color: '#f59e0b' }} /> : <StarOutlined />}
                                                                className="!border-none !bg-white/80 hover:!bg-white"
                                                                onClick={() => handleToggleFavorite(item)}
                                                            />
                                                        </div>
                                                        {item.type === 'video' && (
                                                            <div className="absolute bottom-2 left-2">
                                                                <Tag color="blue" className="rounded">视频</Tag>
                                                            </div>
                                                        )}
                                                    </div>
                                                }
                                            >
                                                <div className="mb-2">
                                                    <div 
                                                        className="text-sm font-medium truncate" 
                                                        title={item.name}
                                                    >
                                                        {item.name}
                                                    </div>
                                                    <div className="text-xs text-zinc-500 mt-1">
                                                        {formatFileSize(item.file_size || 0)} • {new Date(item.created_at || '').toLocaleDateString()}
                                                    </div>
                                                </div>
                                                <Divider style={{ margin: '8px 0' }} />
                                                <div className="flex justify-between">
                                                    <Button 
                                                        type="link" 
                                                        size="small" 
                                                        icon={<DownloadOutlined />} 
                                                        className="!p-0"
                                                        onClick={() => window.open(item.url)}
                                                    >
                                                        下载
                                                    </Button>
                                                    <Button 
                                                        type="link" 
                                                        size="small" 
                                                        danger 
                                                        icon={<DeleteOutlined />} 
                                                        className="!p-0"
                                                        onClick={() => handleDelete(item)}
                                                    >
                                                        删除
                                                    </Button>
                                                </div>
                                            </Card>
                                        </Col>
                                    ))}
                                </Row>
                            ) : (
                                <Empty description="暂无素材" className="py-16">
                                    <Upload
                                        showUploadList={false}
                                        beforeUpload={handleUpload}
                                        accept="image/*,video/*"
                                    >
                                        <Button type="primary" icon={<UploadOutlined />}>
                                            上传第一个素材
                                        </Button>
                                    </Upload>
                                </Empty>
                            )}
                        </Card>
                    </Col>

                    <Col xs={24} lg={8}>
                        {/* 存储概览 */}
                        <Card title="存储概览" style={{ borderRadius: 16 }} className="mb-6 border-zinc-200">
                            <div className="text-center mb-4">
                                <Progress 
                                    type="circle" 
                                    percent={Math.round(storageUsage.percentage)} 
                                    strokeColor={storageUsage.percentage > 80 ? '#ef4444' : { '0%': '#10b981', '100%': '#3b82f6' }}
                                    size={120}
                                />
                                <div className="mt-4">
                                    <div className="text-lg font-semibold text-zinc-900">
                                        {formatFileSize(storageUsage.used)} / {formatFileSize(storageUsage.limit)}
                                    </div>
                                    <div className="text-xs text-zinc-500 mt-1">
                                        {isPremium ? (
                                            <span className="flex items-center justify-center gap-1 text-green-600">
                                                <CrownFilled /> Pro 会员已扩容至 10GB
                                            </span>
                                        ) : (
                                            '升级 Pro 解锁更大存储空间'
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4 mt-4">
                                <div className="text-center p-3 bg-zinc-50 rounded-lg">
                                    <div className="text-xl font-bold text-zinc-900">{materials.filter(m => m.type === 'image').length}</div>
                                    <div className="text-xs text-zinc-500">图片数</div>
                                </div>
                                <div className="text-center p-3 bg-zinc-50 rounded-lg">
                                    <div className="text-xl font-bold text-zinc-900">{materials.filter(m => m.type === 'video').length}</div>
                                    <div className="text-xs text-zinc-500">视频数</div>
                                </div>
                            </div>
                        </Card>

                        {/* 灵感源泉 */}
                        <Card 
                            title={
                                <span className="flex items-center gap-2">
                                    <GlobalOutlined className="text-indigo-600" /> 
                                    灵感源泉：开源素材资源
                                </span>
                            } 
                            style={{ borderRadius: 16 }} 
                            className="border-zinc-200"
                        >
                            <Paragraph className="text-zinc-500 text-sm">
                                除了 AI 生成，您还可以从以下知名的开源/免费资源站寻找灵感。
                            </Paragraph>
                            <List
                                itemLayout="horizontal"
                                dataSource={EXTERNAL_RESOURCES}
                                renderItem={(item) => (
                                    <List.Item
                                        actions={[
                                            <Tooltip title="前往官网" key="link">
                                                <Button 
                                                    type="text" 
                                                    icon={<LinkOutlined />} 
                                                    onClick={() => window.open(item.url)}
                                                />
                                            </Tooltip>
                                        ]}
                                    >
                                        <List.Item.Meta
                                            avatar={
                                                <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600">
                                                    {item.icon}
                                                </div>
                                            }
                                            title={<Text strong className="text-sm">{item.name}</Text>}
                                            description={
                                                <div>
                                                    <div className="text-xs text-zinc-500 mb-1">{item.description}</div>
                                                    <Space size={4}>
                                                        {item.tags.map(t => (
                                                            <Tag key={t} style={{ fontSize: 10, margin: 0 }}>{t}</Tag>
                                                        ))}
                                                    </Space>
                                                </div>
                                            }
                                        />
                                    </List.Item>
                                )}
                            />
                            <Divider dashed />
                            <Card size="small" className="bg-blue-50 border-blue-100">
                                <div className="flex gap-3">
                                    <InfoCircleOutlined className="text-blue-500 mt-1" />
                                    <div>
                                        <Text strong className="text-blue-900 text-sm">使用提示：</Text>
                                        <div className="text-xs text-blue-700 mt-1">
                                            虽然这些资源大部分支持免费商用，但建议在使用时仍核对具体的版权声明（如 CC0 或 Attribution 4.0）。
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        </Card>
                    </Col>
                </Row>
            </div>
        </div>
    );
}
