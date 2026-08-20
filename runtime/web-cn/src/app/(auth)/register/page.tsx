'use client';

import { LockOutlined, MailOutlined, TeamOutlined, UserOutlined } from '@ant-design/icons';
import { Button, Card, Form, Input, message } from 'antd';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface RegisterValues {
  name: string;
  email: string;
  tenantName: string;
  password: string;
  confirmPassword: string;
}

export default function RegisterPage() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const onFinish = async (values: RegisterValues) => {
    setLoading(true);
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: values.email,
          password: values.password,
          name: values.name,
          tenantName: values.tenantName,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.user) {
        throw new Error(payload.message || payload.error || '注册失败');
      }
      message.success('注册成功');
      router.replace('/studio');
    } catch (error) {
      message.error(error instanceof Error ? error.message : '注册失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-600 to-purple-700 p-5">
      <Card className="w-full max-w-lg shadow-2xl">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-indigo-600 text-white text-3xl font-bold flex items-center justify-center mx-auto mb-4">分</div>
          <h1 className="text-3xl font-semibold">创建分发侠账号</h1>
          <p className="text-zinc-500 mt-2">从真实内容生成、审核与发布任务开始</p>
        </div>
        <Form layout="vertical" size="large" onFinish={onFinish}>
          <Form.Item name="name" rules={[{ required: true, message: '请输入姓名' }, { max: 50 }]}>
            <Input prefix={<UserOutlined />} placeholder="姓名" autoComplete="name" />
          </Form.Item>
          <Form.Item name="email" rules={[{ required: true, message: '请输入邮箱' }, { type: 'email', message: '请输入有效邮箱' }]}>
            <Input prefix={<MailOutlined />} placeholder="邮箱" autoComplete="email" />
          </Form.Item>
          <Form.Item name="tenantName" rules={[{ required: true, message: '请输入团队或工作室名称' }, { max: 100 }]}>
            <Input prefix={<TeamOutlined />} placeholder="团队或工作室名称" autoComplete="organization" />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }, { min: 8, message: '密码至少 8 位' }, { max: 20 }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="密码（8–20 位）" autoComplete="new-password" />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            dependencies={['password']}
            rules={[
              { required: true, message: '请再次输入密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  return !value || getFieldValue('password') === value
                    ? Promise.resolve()
                    : Promise.reject(new Error('两次输入的密码不一致'));
                },
              }),
            ]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="确认密码" autoComplete="new-password" />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={loading} block>创建账号</Button>
        </Form>
        <p className="text-center text-zinc-500 mt-6">已有账号？ <Link href="/login">立即登录</Link></p>
      </Card>
    </div>
  );
}
