'use client';

import React, { useState } from 'react';
import { Card, Form, Input, Button, message, Divider, Checkbox } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const onFinish = async (values: { email: string; password: string; remember: boolean }) => {
        setLoading(true);
        try {
            // 首先尝试通过 NestJS 后端登录
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                email: values.email,
                password: values.password
                }),
            });
            const res = await response.json();
            if (!response.ok) throw new Error(res.message || '登录失败');

            if (res.user) {
                localStorage.setItem('user_info', JSON.stringify(res.user));
                message.success('登录成功！');
                router.push('/overview');
                return;
            }

            throw new Error('登录响应无效');
        } catch (error: any) {
            console.error('Login error:', error);
            message.error(error.message || '登录失败，请检查邮箱和密码');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                padding: '20px',
            }}
        >
            <Card
                style={{
                    width: '100%',
                    maxWidth: 450,
                    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
                }}
            >
                <div style={{ textAlign: 'center', marginBottom: 32 }}>
                    <div
                        style={{
                            width: 64,
                            height: 64,
                            borderRadius: 16,
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 16px',
                            fontSize: 32,
                            fontWeight: 'bold',
                            color: '#fff',
                        }}
                    >
                        分
                    </div>
                    <h1 style={{ fontSize: 28, fontWeight: 600, margin: 0 }}>欢迎回来</h1>
                    <p style={{ color: '#6b7280', marginTop: 8 }}>登录到分发侠平台</p>
                </div>

                <Form
                    name="login"
                    onFinish={onFinish}
                    autoComplete="off"
                    layout="vertical"
                    size="large"
                >
                    <Form.Item
                        name="email"
                        rules={[
                            { required: true, message: '请输入邮箱' },
                            { type: 'email', message: '请输入有效的邮箱地址' },
                        ]}
                    >
                        <Input
                            prefix={<MailOutlined />}
                            placeholder="邮箱地址"
                        />
                    </Form.Item>

                    <Form.Item
                        name="password"
                        rules={[{ required: true, message: '请输入密码' }]}
                    >
                        <Input.Password
                            prefix={<LockOutlined />}
                            placeholder="密码"
                        />
                    </Form.Item>

                    <Form.Item>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Form.Item name="remember" valuePropName="checked" noStyle>
                                <Checkbox>记住我</Checkbox>
                            </Form.Item>
                            <Link href="/forgot-password" style={{ color: '#6366f1' }}>
                                忘记密码？
                            </Link>
                        </div>
                    </Form.Item>

                    <Form.Item>
                        <Button type="primary" htmlType="submit" block loading={loading}>
                            登录
                        </Button>
                    </Form.Item>

                    <Divider plain>或</Divider>

                    <div style={{ textAlign: 'center' }}>
                        <span style={{ color: '#6b7280' }}>还没有账号？</span>
                        <Link href="/register" style={{ marginLeft: 8, color: '#6366f1', fontWeight: 500 }}>
                            立即注册
                        </Link>
                    </div>
                </Form>
            </Card>
        </div>
    );
}
