'use client';

import React, { useState } from 'react';
import { Card, Form, Input, Button, message, Divider, Select } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined, TeamOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

const { Option } = Select;

import { apiClient } from '@/lib/api-client';

export default function RegisterPage() {
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const onFinish = async (values: any) => {
        setLoading(true);
        try {
            // 尝试通过 NestJS 后端注册
            const res = await apiClient.post<any>('/auth/register', {
                email: values.email,
                password: values.password,
                name: values.name,
                tenantName: values.tenantName,
                plan: values.plan
            });

            if (res.token) {
                message.success('注册成功！');
                router.push('/login');
                return;
            }

            // 回退到 Supabase
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: values.email,
                password: values.password,
                options: {
                    data: {
                        name: values.name,
                        tenant_name: values.tenantName,
                        plan: values.plan,
                    },
                },
            });

            if (authError) throw authError;
            message.success('注册成功！请查收验证邮件');
            router.push('/login');
        } catch (error: any) {
            console.error('Register error:', error);
            message.error(error.message || '注册失败，请重试');
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
                        name="plan"
                        initialValue="free"
                        rules={[{ required: true, message: '请选择套餐' }]}
                    >
                        <Select placeholder="选择套餐">
                            <Option value="free">免费版 - ¥0/月</Option>
                            <Option value="pro">专业版 - ¥99/月</Option>
                            <Option value="team">团队版 - ¥299/月</Option>
                            <Option value="enterprise">企业版 - ¥899/月</Option>
                        </Select>
                    </Form.Item>

                    <Form.Item
                        name="password"
                        rules={[
                            { required: true, message: '请输入密码' },
                            { min: 6, message: '密码至少6位' },
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
