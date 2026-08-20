'use client';

import { SaveOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Descriptions, Form, Input, message, Skeleton } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { useAppStore, type UserProfile } from '@/store/appStore';

function unwrapUser(payload: any): UserProfile | null {
  return payload?.data?.user ?? payload?.user ?? null;
}

export default function SettingsPage() {
  const [form] = Form.useForm<{ name: string }>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const { user, tenant, setUser, initializeAuth } = useAppStore();

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      await initializeAuth();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '个人资料加载失败');
    } finally {
      setLoading(false);
    }
  }, [initializeAuth]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (user) form.setFieldsValue({ name: user.name || '' }); }, [form, user]);

  const save = async ({ name }: { name: string }) => {
    setSaving(true);
    try {
      const updated = unwrapUser(await apiClient.put('/users/me', { name: name.trim() }));
      if (!updated) throw new Error('更新响应无效');
      setUser({ ...(user ?? {}), ...updated } as UserProfile);
      message.success('个人资料已保存');
    } catch (cause) {
      message.error(cause instanceof Error ? cause.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div><h1 className="text-3xl font-bold">系统设置</h1><p className="text-zinc-500 mt-1">资料来自当前登录会话和真实租户记录。</p></div>
      {error && <Alert type="error" showIcon message={error} />}
      {loading ? <Skeleton active /> : (
        <>
          <Card title="个人资料">
            <Form form={form} layout="vertical" onFinish={save}>
              <Form.Item label="姓名" name="name" rules={[{ required: true, message: '请输入姓名' }, { max: 50 }]}><Input /></Form.Item>
              <Form.Item label="邮箱"><Input value={user?.email} disabled /></Form.Item>
              <Button type="primary" htmlType="submit" loading={saving} icon={<SaveOutlined />}>保存修改</Button>
            </Form>
          </Card>
          <Card title="工作区">
            <Descriptions column={1} bordered>
              <Descriptions.Item label="名称">{tenant?.name || '—'}</Descriptions.Item>
              <Descriptions.Item label="套餐">{tenant?.plan || 'free'}</Descriptions.Item>
              <Descriptions.Item label="当前角色">{user?.role || '—'}</Descriptions.Item>
            </Descriptions>
          </Card>
        </>
      )}
    </div>
  );
}
