'use client';

import React, { useEffect, useState } from 'react';
import { Menu, Avatar, Dropdown, Button, Badge, Popover, List, Tag } from 'antd';
import { motion } from 'framer-motion';
import {
    HomeOutlined,
    EditOutlined,
    SendOutlined,
    BarChartOutlined,
    FolderOutlined,
    AppstoreOutlined,
    RiseOutlined,
    FireOutlined,
    ThunderboltOutlined,
    UserOutlined,
    SettingOutlined,
    LogoutOutlined,
    CreditCardOutlined,
    MenuUnfoldOutlined,
    MenuFoldOutlined,
    SearchOutlined,
    PlusOutlined,
    BellOutlined,
    CrownOutlined,
    QuestionCircleOutlined,
    RocketOutlined,
} from '@ant-design/icons';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import clsx from 'clsx';
import { useUserStore, useUIStore } from '@/store/appStore';
import { usePointsStore } from '@/store/pointsStore';
import { apiClient } from '@/lib/api-client';
import { HeaderStats } from '@/components/gamification/HeaderStats';

interface MainLayoutProps {
    children: React.ReactNode;
}

const primaryItems = [
    { key: '/overview', icon: <HomeOutlined />, label: <Link href="/overview">首页</Link> },
    { key: '/studio', icon: <EditOutlined />, label: <Link href="/studio">创作</Link> },
    { key: '/publish', icon: <SendOutlined />, label: <Link href="/publish">排期 / 发布</Link> },
    { key: '/analytics', icon: <BarChartOutlined />, label: <Link href="/analytics">数据</Link> },
    { key: '/materials', icon: <FolderOutlined />, label: <Link href="/materials">素材库</Link> },
];

const aiToolsItems = [
    { key: '/video-studio', icon: <RocketOutlined />, label: <Link href="/video-studio">视频工坊</Link> },
    { key: '/persona', icon: <UserOutlined />, label: <Link href="/persona">人设风格</Link> },
    { key: '/hot', icon: <FireOutlined />, label: <Link href="/hot">热点选题</Link> },
];

const proToolsItems = [
    { key: '/monetization', icon: <RiseOutlined />, label: <Link href="/monetization">变现中心</Link> },
    { key: '/contents', icon: <AppstoreOutlined />, label: <Link href="/contents">内容库</Link> },
    { key: '/team', icon: <UserOutlined />, label: <Link href="/team">团队协作</Link> },
    { key: '/developer', icon: <ThunderboltOutlined />, label: <Link href="/developer">开放平台 (API)</Link> },
];

const menuItems = [
    ...primaryItems,
    { key: 'ai-tools', label: 'AI 工具', type: 'group' as const, children: aiToolsItems },
    { key: 'pro-tools', label: '专业工具', type: 'group' as const, children: proToolsItems },
];

export default function MainLayout({ children }: MainLayoutProps) {
    const router = useRouter();
    const pathname = usePathname();
    const { sidebarCollapsed, toggleSidebar, setSidebarCollapsed } = useUIStore();
    const { user, setUser, logout } = useUserStore();
    const { balance, setBalance } = usePointsStore();

    const [scrolled, setScrolled] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const [notifications, setNotifications] = useState<any[]>([]);
    const [notificationsOpen, setNotificationsOpen] = useState(false);
    const [notificationsLoading, setNotificationsLoading] = useState(false);
    const [lastSeenAt, setLastSeenAt] = useState<number>(0);
    const [hasUnread, setHasUnread] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const stored = window.localStorage.getItem('ff_last_seen_at');
        if (stored) {
            setLastSeenAt(Number(stored));
        }
    }, []);

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 10);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();

        if (window.innerWidth < 768) {
            setSidebarCollapsed(true);
        }

        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, [setSidebarCollapsed]);

    useEffect(() => {
        let mounted = true;
        const fetchProfile = async () => {
            try {
                const res: any = await apiClient.get('/auth/profile');
                const profile = res?.data?.user || res?.user;
                if (!profile || !mounted) return;

                setUser({
                    id: profile.id,
                    email: profile.email,
                    name: profile.name || '创作者',
                    avatar: profile.avatar_url,
                    plan: profile.tenant?.plan || 'free',
                    exp: 0,
                    level: 1,
                });
            } catch {
                // Silent: profile optional
            }
        };

        const fetchBalance = async () => {
            try {
                const res: any = await apiClient.get('/points/balance');
                const nextBalance = res?.data?.balance ?? res?.balance;
                if (typeof nextBalance === 'number' && mounted) {
                    setBalance(nextBalance);
                }
            } catch {
                // Silent: balance optional
            }
        };

        fetchProfile();
        fetchBalance();

        return () => {
            mounted = false;
        };
    }, [setUser, setBalance]);

    const fetchNotifications = async () => {
        setNotificationsLoading(true);
        try {
            const res: any = await apiClient.get('/notifications');
            const items = res?.data?.items || res?.items || [];
            setNotifications(items);
            if (items.length > 0) {
                const latestTime = new Date(items[0].created_at).getTime();
                setHasUnread(latestTime > lastSeenAt);
            } else {
                setHasUnread(false);
            }
        } catch {
            setNotifications([]);
        } finally {
            setNotificationsLoading(false);
        }
    };

    const getActiveKey = (path: string) => {
        const keys = [
            '/overview',
            '/contentos',
            '/studio',
            '/publish',
            '/analytics',
            '/materials',
            '/agent-studio',
            '/agent-network',
            '/agent-market',
            '/agent-insight',
            '/agent-platform',
            '/community',
            '/competitor',
            '/traffic-sandwich',
            '/developer',
        ];
        const match = keys.find((key) => path === key || path.startsWith(`${key}/`));
        return match || path;
    };

    const activeKey = getActiveKey(pathname);

    const handleLogout = async () => {
        try {
            await apiClient.post('/auth/logout', {});
        } catch {
            // Ignore logout errors
        } finally {
            if (typeof window !== 'undefined') {
                localStorage.removeItem('auth_token');
            }
            logout();
            window.location.href = '/login';
        }
    };

    const userMenuItems = [
        { key: 'profile', icon: <UserOutlined />, label: '个人资料' },
        { key: 'settings', icon: <SettingOutlined />, label: '账号设置' },
        { key: 'pricing', icon: <CreditCardOutlined />, label: <Link href="/pricing" className="text-inherit">升级会员</Link> },
        { type: 'divider' as const },
        {
            key: 'logout',
            icon: <LogoutOutlined />,
            label: '退出登录',
            danger: true,
            onClick: handleLogout,
        },
    ];

    const SidebarContent = () => (
        <>
            <div className="h-20 flex items-center justify-center">
                <motion.div
                    whileHover={{ scale: 1.02 }}
                    className={clsx(
                        "flex items-center gap-3 cursor-pointer",
                        (sidebarCollapsed && !isMobile) ? "px-0" : "px-4"
                    )}
                    onClick={() => {
                        router.push('/overview');
                        if (isMobile) toggleSidebar();
                    }}
                >
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#1f4d4f] via-[#2f6d6a] to-[#d28b3f] flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-emerald-900/10">
                        F
                    </div>
                    {(!sidebarCollapsed || isMobile) && (
                        <motion.span
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="text-xl font-bold text-zinc-900"
                        >
                            分发侠
                        </motion.span>
                    )}
                </motion.div>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-4">
                <Menu
                    mode="inline"
                    selectedKeys={[activeKey]}
                    items={menuItems}
                    inlineCollapsed={sidebarCollapsed && !isMobile}
                    style={{ border: 'none', background: 'transparent' }}
                    className="font-medium"
                    onClick={() => isMobile && toggleSidebar()}
                />
            </div>

            <div className="p-4">
                {(!sidebarCollapsed || isMobile) ? (
                    <div className="rounded-2xl p-4 border border-amber-100 bg-white/70 shadow-sm">
                        <div className="flex items-center gap-3 mb-3">
                            <Avatar
                                src={user?.avatar}
                                icon={<UserOutlined />}
                                className="bg-amber-100 text-amber-600"
                            />
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-semibold truncate">{user?.name || '创作者'}</div>
                                <div className="text-xs text-zinc-500 truncate">{user?.plan ? `${user.plan.toUpperCase()} Plan` : 'Free Plan'}</div>
                            </div>
                        </div>
                        <Button
                            type="primary"
                            block
                            className="bg-gradient-to-r from-[#1f4d4f] to-[#d28b3f] border-none shadow-md shadow-amber-200/40"
                            onClick={() => router.push('/pricing')}
                        >
                            <CrownOutlined /> 升级 Pro
                        </Button>
                    </div>
                ) : (
                    <div className="flex justify-center">
                        <Avatar src={user?.avatar} icon={<UserOutlined />} className="cursor-pointer hover:scale-110 transition-transform" />
                    </div>
                )}
            </div>
        </>
    );

    return (
        <div className="min-h-screen flex bg-background text-foreground transition-colors duration-300">
            <motion.aside
                initial={false}
                animate={{ width: sidebarCollapsed ? 88 : 260 }}
                className={clsx(
                    "fixed left-0 top-0 bottom-0 z-50 h-screen hidden md:flex flex-col",
                    "border-r border-amber-100",
                    "bg-white/80",
                    "backdrop-blur-xl"
                )}
            >
                <SidebarContent />
            </motion.aside>

            {isMobile && !sidebarCollapsed && (
                <div className="fixed inset-0 z-50 flex md:hidden">
                    <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={toggleSidebar}></div>
                    <motion.div
                        initial={{ x: -280 }}
                        animate={{ x: 0 }}
                        className="relative bg-white w-[280px] h-full shadow-2xl flex flex-col"
                    >
                        <SidebarContent />
                    </motion.div>
                </div>
            )}

            <main
                className={clsx(
                    "flex-1 flex flex-col min-h-screen relative transition-all duration-300",
                    "ml-0",
                    sidebarCollapsed ? "md:ml-[88px]" : "md:ml-[260px]"
                )}
            >
                <header
                    className={clsx(
                        "sticky top-0 z-40 h-20 px-4 md:px-8 flex items-center justify-between transition-all duration-300",
                        scrolled
                            ? "bg-white/70 backdrop-blur-xl border-b border-amber-100 shadow-sm"
                            : "bg-transparent"
                    )}
                >
                    <div className="flex items-center gap-4">
                        <button
                            onClick={toggleSidebar}
                            className="p-2 rounded-xl hover:bg-amber-50 hover:text-[#1f4d4f] transition-colors text-zinc-500"
                        >
                            {sidebarCollapsed || isMobile ? <MenuUnfoldOutlined className="text-xl" /> : <MenuFoldOutlined className="text-xl" />}
                        </button>

                        <div className="hidden md:flex items-center gap-2 px-4 py-2.5 rounded-full border border-amber-100 bg-white/70 shadow-sm w-64">
                            <SearchOutlined className="text-zinc-400" />
                            <input
                                type="text"
                                placeholder="搜索主题、草稿..."
                                className="bg-transparent border-none outline-none text-sm w-full placeholder:text-zinc-400"
                            />
                        </div>

                        <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={() => router.push('/studio')}
                            className="hidden md:flex items-center bg-gradient-to-r from-[#1f4d4f] to-[#2f6d6a] border-none shadow-md shadow-emerald-900/10 rounded-full px-5"
                        >
                            新建内容包
                        </Button>
                    </div>

                    <div className="flex items-center gap-2 md:gap-3">
                        <div className="hidden md:block">
                            <HeaderStats />
                        </div>

                        <div className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-full border border-amber-200 bg-white/70 text-amber-700">
                            <ThunderboltOutlined className="text-lg" />
                            <span className="font-bold font-mono text-base">{balance}</span>
                            <span className="text-xs opacity-70 font-medium">积分</span>
                        </div>

                        <div className="relative">
                            <Popover
                                placement="bottomRight"
                                open={notificationsOpen}
                                onOpenChange={async (open) => {
                                    setNotificationsOpen(open);
                                    if (open) {
                                        await fetchNotifications();
                                        const now = Date.now();
                                        setLastSeenAt(now);
                                        if (typeof window !== 'undefined') {
                                            window.localStorage.setItem('ff_last_seen_at', String(now));
                                        }
                                        setHasUnread(false);
                                    }
                                }}
                                content={(
                                    <div className="w-80">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="text-sm font-semibold">通知中心</div>
                                            <Tag color="gold">发布 / 复盘</Tag>
                                        </div>
                                        <List
                                            size="small"
                                            loading={notificationsLoading}
                                            dataSource={notifications}
                                            locale={{ emptyText: '暂无通知' }}
                                            renderItem={(item: any) => (
                                                <List.Item
                                                    className="cursor-pointer"
                                                    onClick={() => {
                                                        if (item.link) {
                                                            router.push(item.link);
                                                            setNotificationsOpen(false);
                                                        }
                                                    }}
                                                >
                                                    <List.Item.Meta
                                                        title={(
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-sm font-semibold">{item.title}</span>
                                                                <Tag color={item.type === 'publish' ? 'blue' : 'purple'}>
                                                                    {item.type === 'publish' ? '发布' : '复盘'}
                                                                </Tag>
                                                            </div>
                                                        )}
                                                        description={(
                                                            <div className="text-xs text-zinc-500">
                                                                <div>{item.message}</div>
                                                                <div>{new Date(item.created_at).toLocaleString()}</div>
                                                            </div>
                                                        )}
                                                    />
                                                </List.Item>
                                            )}
                                        />
                                    </div>
                                )}
                            >
                                <button className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-amber-50 hover:text-[#1f4d4f] transition-colors text-zinc-500">
                                    <Badge dot={hasUnread}>
                                        <BellOutlined className="text-lg" />
                                    </Badge>
                                </button>
                            </Popover>
                        </div>

                        <div className="w-px h-8 bg-amber-100 mx-1"></div>

                        <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
                            <div className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity">
                                <Avatar
                                    src={user?.avatar}
                                    icon={<UserOutlined />}
                                    size={40}
                                    className="ring-2 ring-amber-100"
                                />
                            </div>
                        </Dropdown>
                    </div>
                </header>

                <div className="flex-1 p-4 md:p-8 overflow-x-hidden relative">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4 }}
                    >
                        {children}
                    </motion.div>
                </div>
            </main>
        </div>
    );
}
