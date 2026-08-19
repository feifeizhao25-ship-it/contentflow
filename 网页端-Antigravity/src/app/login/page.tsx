'use client';

import React, { useState } from 'react';
import { Form, Input, Button, Card, Tabs, message, Typography } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined, TeamOutlined, RocketOutlined } from '@ant-design/icons';
import { apiClient } from '@/lib/api-client';
import { trackEvent } from '@/lib/analytics';
import { motion } from 'framer-motion';

const { Title, Text } = Typography;

export default function LoginPage() {
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('login');

    const handleLogin = async (values: any) => {
        setLoading(true);
        try {
            const res = await apiClient.post<any>('/auth/login', values);
            // Backend wraps response in { success, data: { token, user, ... } }
            const token = res.data?.token || res.token || res.access_token;
            if (token) {
                localStorage.setItem('auth_token', token);
            }
            message.success('登录成功，欢迎回来！');
            trackEvent('auth_login_success', { method: 'password' });
            window.location.href = '/overview';
        } catch (error: any) {
            message.error(error.message || '登录失败');
        } finally {
            setLoading(false);
        }
    };

    const handleRegister = async (values: any) => {
        setLoading(true);
        try {
            const res = await apiClient.post<any>('/auth/register', values);
            const token = res.data?.token || res.token || res.access_token;
            if (token) {
                localStorage.setItem('auth_token', token);
            }
            message.success('注册成功，正在为您配置工作台...');
            trackEvent('auth_register_success', { method: 'password' });
            setTimeout(() => {
                window.location.href = '/overview';
            }, 1000);
        } catch (error: any) {
            message.error(error.message || '注册失败');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#f7f2e9] flex items-center justify-center p-4 relative overflow-hidden">
            {/* Ambient Background */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
                <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-amber-200/40 rounded-full blur-[140px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-200/30 rounded-full blur-[120px]" />
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="relative z-10 w-full max-w-md"
            >
                <div className="text-center mb-8">
                    <RocketOutlined className="text-5xl text-[#1f4d4f] mb-4" />
                    <Title level={2} style={{ color: '#1c1b1a', marginBottom: 0, fontFamily: 'var(--font-serif)' }}>分发侠</Title>
                    <Text className="text-zinc-500">个人创作者的内容工作室</Text>
                </div>

                <Card className="rounded-3xl border border-amber-100 shadow-2xl bg-white/80 backdrop-blur-xl" styles={{ body: { padding: '32px' } }}>
                    <Tabs
                        activeKey={activeTab}
                        onChange={setActiveTab}
                        centered
                        className="custom-tabs mb-6"
                        items={[
                            { key: 'login', label: '登录账号' },
                            { key: 'register', label: '注册新租户' },
                        ]}
                    />

                    {activeTab === 'login' ? (
                        <Form
                            name="login"
                            onFinish={handleLogin}
                            layout="vertical"
                            size="large"
                            initialValues={{ email: 'demo@test.com', password: 'password' }}
                        >
                            <Form.Item name="email" rules={[{ required: true, message: '请输入邮箱' }, { type: 'email', message: '邮箱格式不正确' }]}>
                                <Input prefix={<MailOutlined className="text-zinc-500" />} placeholder="邮箱地址" className="rounded-xl bg-white border-amber-200 text-zinc-800 placeholder-zinc-400 hover:border-[#1f4d4f] focus:border-[#1f4d4f]" />
                            </Form.Item>
                            <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
                                <Input.Password prefix={<LockOutlined className="text-zinc-500" />} placeholder="密码" className="rounded-xl bg-white border-amber-200 text-zinc-800 placeholder-zinc-400 hover:border-[#1f4d4f] focus:border-[#1f4d4f]" />
                            </Form.Item>
                            <Form.Item>
                                <Button type="primary" htmlType="submit" block loading={loading} className="h-12 rounded-xl bg-[#1f4d4f] border-none font-bold text-lg hover:bg-[#2f6d6a] shadow-lg shadow-emerald-900/10">
                                    立即登录
                                </Button>
                                <Button
                                    type="default"
                                    block
                                    onClick={() => handleLogin({ email: 'demo@test.com', password: 'password' })}
                                    className="mt-4 h-10 rounded-xl border-amber-200 text-[#1f4d4f] font-medium"
                                >
                                    一键体验演示账号
                                </Button>
                            </Form.Item>
                        </Form>
                    ) : (
                        <Form name="register" onFinish={handleRegister} layout="vertical" size="large">
                            <Form.Item name="email" rules={[{ required: true, message: '请输入邮箱' }, { type: 'email', message: '邮箱格式不正确' }]}>
                                <Input prefix={<MailOutlined className="text-zinc-500" />} placeholder="设定邮箱" className="rounded-xl bg-white border-amber-200 text-zinc-800 placeholder-zinc-400" />
                            </Form.Item>
                            <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }, { min: 6, message: '密码至少6位' }]}>
                                <Input.Password prefix={<LockOutlined className="text-zinc-500" />} placeholder="设定密码" className="rounded-xl bg-white border-amber-200 text-zinc-800 placeholder-zinc-400" />
                            </Form.Item>
                            <Form.Item name="name" rules={[{ required: true, message: '请输入您的昵称' }]}>
                                <Input prefix={<UserOutlined className="text-zinc-500" />} placeholder="您的昵称" className="rounded-xl bg-white border-amber-200 text-zinc-800 placeholder-zinc-400" />
                            </Form.Item>
                            <Form.Item name="tenantName" rules={[{ required: true, message: '请输入工作室/公司名称' }]}>
                                <Input prefix={<TeamOutlined className="text-zinc-500" />} placeholder="工作室名称" className="rounded-xl bg-white border-amber-200 text-zinc-800 placeholder-zinc-400" />
                            </Form.Item>
                            <Form.Item>
                                <Button type="primary" htmlType="submit" block loading={loading} className="h-12 rounded-xl bg-[#1f4d4f] border-none font-bold text-lg hover:bg-[#2f6d6a] shadow-lg shadow-emerald-900/10">
                                    创建账户
                                </Button>
                            </Form.Item>
                        </Form>
                    )}
                </Card>

                <div className="text-center mt-8 text-zinc-500 text-xs">
                    安全登录 · 数据仅用于创作与发布
                </div>
            </motion.div>

            <style jsx global>{`
                .custom-tabs .ant-tabs-nav::before { border-bottom: 1px solid #f0e8db !important; }
                .custom-tabs .ant-tabs-tab { color: #7a7267; transition: all 0.3s; }
                .custom-tabs .ant-tabs-tab-active .ant-tabs-tab-btn { color: #1f4d4f !important; font-weight: bold; }
                .custom-tabs .ant-tabs-ink-bar { background: #1f4d4f !important; }
                input:-webkit-autofill,
                input:-webkit-autofill:hover, 
                input:-webkit-autofill:focus, 
                input:-webkit-autofill:active {
                    -webkit-box-shadow: 0 0 0 30px #fffdf7 inset !important;
                    -webkit-text-fill-color: #1c1b1a !important;
                }
            `}</style>
        </div>
    );
}
