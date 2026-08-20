'use client';

import { FileImageOutlined, FileTextOutlined, VideoCameraOutlined } from '@ant-design/icons';
import { Alert, Card, Empty, Input, Segmented, Skeleton, Tag } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiClient } from '@/lib/api-client';

interface Material {
  id: string;
  material_type: 'image' | 'video' | 'script' | string;
  name?: string;
  file_url: string;
  file_size?: number;
  created_at: string;
}

function unwrapMaterials(payload: any): Material[] {
  const value = payload?.data ?? payload;
  return Array.isArray(value) ? value : Array.isArray(value?.items) ? value.items : [];
}

export default function MaterialsPage() {
  const [items, setItems] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [type, setType] = useState('全部');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setItems(unwrapMaterials(await apiClient.get('/materials')));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '素材加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => items.filter((item) => {
    const typeMatches = type === '全部' || item.material_type === ({ 图片: 'image', 视频: 'video', 脚本: 'script' } as Record<string, string>)[type];
    const textMatches = (item.name || '').toLowerCase().includes(query.trim().toLowerCase());
    return typeMatches && textMatches;
  }), [items, query, type]);

  const icon = (value: string) => value === 'video'
    ? <VideoCameraOutlined />
    : value === 'script'
      ? <FileTextOutlined />
      : <FileImageOutlined />;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">素材库</h1>
        <p className="text-zinc-500 mt-1">仅展示已写入产品对象存储并登记到当前工作区的真实素材。</p>
      </div>
      <Alert
        type="info"
        showIcon
        message="上传功能暂未开放"
        description="完成对象存储签名上传、病毒扫描、文件类型校验和租户配额后才会启用；当前不会把本地选择文件误报为上传成功。"
      />
      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <Segmented value={type} onChange={(value) => setType(String(value))} options={['全部', '图片', '视频', '脚本']} />
        <Input.Search allowClear placeholder="按素材名称搜索" className="sm:max-w-xs" onChange={(event) => setQuery(event.target.value)} />
      </div>
      {error && <Alert type="error" showIcon message="素材加载失败" description={error} action={<a onClick={() => void load()}>重试</a>} />}
      {loading ? <Skeleton active /> : filtered.length === 0 ? <Empty description="暂无已验证素材" /> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((item) => (
            <Card key={item.id} hoverable>
              <div className="flex items-start gap-3">
                <div className="text-2xl text-indigo-600">{icon(item.material_type)}</div>
                <div className="min-w-0">
                  <div className="font-semibold truncate">{item.name || '未命名素材'}</div>
                  <div className="text-xs text-zinc-500 mt-1">{new Date(item.created_at).toLocaleString('zh-CN')}</div>
                  <Tag className="mt-3">{item.material_type}</Tag>
                </div>
              </div>
              {item.file_url?.startsWith('https://') && <a className="block mt-4" href={item.file_url} target="_blank" rel="noreferrer">打开素材</a>}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
