'use client';

import React, { useState } from 'react';
import { Card, Form, Input, Button, Divider, Tabs } from 'antd';
import { message } from '@/lib/antd-app';
import { LockOutlined, MailOutlined, MobileOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { safeRedirectTarget } from '@/lib/safe-redirect';
import { isValidChinaMobile, loginWithPassword, loginWithSms, sendSmsCode } from '@/lib/auth-service';
import { SmsCodeInput } from '@/components/auth/SmsCodeInput';
import { safeErrorText } from '@/lib/api-error';

export default function LoginPage() {
    const [loading, setLoading] = useState(false);
    const [mode, setMode] = useState<'sms' | 'password'>('sms');
    const [smsForm] = Form.useForm();
    const router = useRouter();

    const finish = (user: unknown) => {
        localStorage.setItem('user_info', JSON.stringify(user));
        message.success('登录成功！');
        router.push(safeRedirectTarget(new URLSearchParams(window.location.search).get('redirect')));
    };

    const onPassword = async (values: { email: string; password: string }) => {
        setLoading(true);
        try {
            finish(await loginWithPassword({ email: values.email, password: values.password }));
        } catch (error) {
            message.error(safeErrorText(error, '登录失败，请检查邮箱和密码'));
        } finally {
            setLoading(false);
        }
    };

    const onSms = async (values: { phone: string; code: string }) => {
        setLoading(true);
        try {
            finish(await loginWithSms({ phone: values.phone, code: values.code }));
        } catch (error) {
            message.error(safeErrorText(error, '登录失败，请检查验证码'));
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

                <Tabs
                    activeKey={mode}
                    onChange={(key) => setMode(key as 'sms' | 'password')}
                    centered
                    items={[
                        {
                            key: 'sms',
                            label: '手机验证码登录',
                            children: (
                                <Form form={smsForm} name="login-sms" onFinish={onSms} autoComplete="off" layout="vertical" size="large">
                                    <Form.Item
                                        name="phone"
                                        rules={[
                                            { required: true, message: '请输入手机号' },
                                            { validator: (_, value) => (!value || isValidChinaMobile(value) ? Promise.resolve() : Promise.reject(new Error('请输入正确的 11 位手机号'))) },
                                        ]}
                                    >
                                        <Input prefix={<MobileOutlined />} placeholder="手机号" inputMode="tel" maxLength={16} />
                                    </Form.Item>
                                    <Form.Item name="code" rules={[{ required: true, message: '请输入验证码' }, { pattern: /^\d{6}$/, message: '验证码为 6 位数字' }]}>
                                        <SmsCodeInput
                                            getPhone={() => String(smsForm.getFieldValue('phone') ?? '')}
                                            send={(phone) => sendSmsCode({ phone, purpose: 'login' })}
                                        />
                                    </Form.Item>
                                    <Form.Item>
                                        <Button type="primary" htmlType="submit" block loading={loading}>
                                            登录
                                        </Button>
                                    </Form.Item>
                                </Form>
                            ),
                        },
                        {
                            key: 'password',
                            label: '邮箱密码登录',
                            children: (
                                <Form name="login" onFinish={onPassword} autoComplete="off" layout="vertical" size="large">
                                    <Form.Item
                                        name="email"
                                        rules={[
                                            { required: true, message: '请输入邮箱' },
                                            { type: 'email', message: '请输入有效的邮箱地址' },
                                        ]}
                                    >
                                        <Input prefix={<MailOutlined />} placeholder="邮箱地址" />
                                    </Form.Item>
                                    <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
                                        <Input.Password prefix={<LockOutlined />} placeholder="密码" />
                                    </Form.Item>
                                    <Form.Item>
                                        <Button type="primary" htmlType="submit" block loading={loading}>
                                            登录
                                        </Button>
                                        <div style={{ marginTop: 8, textAlign: 'right' }}>
                                            <Button type="link" size="small" onClick={() => setMode('sms')} style={{ padding: 0 }}>
                                                忘记密码？已绑定手机号的账号可用验证码登录
                                            </Button>
                                        </div>
                                    </Form.Item>
                                </Form>
                            ),
                        },
                    ]}
                />

                <Divider plain>或</Divider>

                <div style={{ textAlign: 'center' }}>
                    <span style={{ color: '#6b7280' }}>还没有账号？</span>
                    <Link href="/register" style={{ marginLeft: 8, color: '#6366f1', fontWeight: 500 }}>
                        立即注册
                    </Link>
                </div>
            </Card>
        </div>
    );
}
