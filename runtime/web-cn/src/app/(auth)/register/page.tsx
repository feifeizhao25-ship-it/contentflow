'use client';

import React, { useState } from 'react';
import { Card, Form, Input, Button, message, Divider, Checkbox } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined, TeamOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { useRouter } from 'next/navigation';



export default function RegisterPage() {
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    // 注册只走自己的后端（/api/auth/register → NestJS），成功后服务端写入登录 cookie。
    //
    // 此前：直接调 /api/v1/auth/register 并多带一个 plan 字段——后端校验管道
    // forbidNonWhitelisted，**任何注册都是 400**；失败后本应「回退到 Supabase」
    // 注册到境外数据库。套餐也不该在注册时选（下拉里的价格与服务端套餐不一致），
    // 注册一律是免费版，付费在「会员方案」页下单。
    const onFinish = async (values: any) => {
        setLoading(true);
        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    email: values.email,
                    password: values.password,
                    name: values.name,
                    tenantName: values.tenantName,
                }),
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                const reason = Array.isArray(payload?.message) ? payload.message[0] : payload?.message;
                throw new Error(typeof reason === 'string' && /[一-鿿]/.test(reason) ? reason : '注册失败，请稍后重试');
            }
            message.success('注册成功');
            router.push('/studio');
        } catch (error: any) {
            message.error(error?.message || '注册失败，请重试');
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
                    maxWidth: 500,
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
                    <h1 style={{ fontSize: 28, fontWeight: 600, margin: 0 }}>创建账号</h1>
                    <p style={{ color: '#6b7280', marginTop: 8 }}>开始您的内容分发之旅</p>
                </div>

                <Form
                    name="register"
                    onFinish={onFinish}
                    autoComplete="off"
                    layout="vertical"
                    size="large"
                >
                    <Form.Item
                        name="name"
                        rules={[{ required: true, message: '请输入您的姓名' }]}
                    >
                        <Input
                            prefix={<UserOutlined />}
                            placeholder="姓名"
                        />
                    </Form.Item>

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
                        name="tenantName"
                        rules={[{ required: true, message: '请输入团队/公司名称' }]}
                    >
                        <Input
                            prefix={<TeamOutlined />}
                            placeholder="团队/公司名称"
                        />
                    </Form.Item>

                    <Form.Item
                        name="password"
                        rules={[
                            { required: true, message: '请输入密码' },
                            { min: 6, message: '密码至少6位' },
                            { max: 20, message: '密码最多20位' },
                        ]}
                    >
                        <Input.Password
                            prefix={<LockOutlined />}
                            placeholder="密码（至少6位）"
                        />
                    </Form.Item>

                    <Form.Item
                        name="confirmPassword"
                        dependencies={['password']}
                        rules={[
                            { required: true, message: '请确认密码' },
                            ({ getFieldValue }) => ({
                                validator(_, value) {
                                    if (!value || getFieldValue('password') === value) {
                                        return Promise.resolve();
                                    }
                                    return Promise.reject(new Error('两次输入的密码不一致'));
                                },
                            }),
                        ]}
                    >
                        <Input.Password
                            prefix={<LockOutlined />}
                            placeholder="确认密码"
                        />
                    </Form.Item>

                    <Form.Item
                        name="agreement"
                        valuePropName="checked"
                        rules={[{
                            validator: (_, value) => value
                                ? Promise.resolve()
                                : Promise.reject(new Error('请先阅读并同意用户协议和隐私政策')),
                        }]}
                    >
                        <Checkbox>
                            我已阅读并同意 <Link href="/terms" target="_blank">《用户协议》</Link> 和 <Link href="/privacy" target="_blank">《隐私政策》</Link>
                        </Checkbox>
                    </Form.Item>

                    <Form.Item>
                        <Button type="primary" htmlType="submit" block loading={loading}>
                            注册
                        </Button>
                    </Form.Item>

                    <Divider plain>或</Divider>

                    <div style={{ textAlign: 'center' }}>
                        <span style={{ color: '#6b7280' }}>已有账号？</span>
                        <Link href="/login" style={{ marginLeft: 8, color: '#6366f1', fontWeight: 500 }}>
                            立即登录
                        </Link>
                    </div>
                </Form>
            </Card>
        </div>
    );
}
