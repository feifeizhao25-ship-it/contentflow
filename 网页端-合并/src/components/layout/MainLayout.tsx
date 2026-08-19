'use client';

import React, { useState, useEffect } from 'react';
import { Layout, Menu, Avatar, Dropdown, ConfigProvider, theme, Button } from 'antd';
import { motion } from 'framer-motion';
import {
    DashboardOutlined,
    EditOutlined,
    FileTextOutlined,
    SendOutlined,
    UserOutlined,
    FolderOutlined,
    BarChartOutlined,
    SettingOutlined,
    BellOutlined,
    LogoutOutlined,
    CreditCardOutlined,
    FireOutlined,
    MenuUnfoldOutlined,
    MenuFoldOutlined,
    SearchOutlined,
    SunOutlined,
    MoonOutlined,
    HomeOutlined,
    PlusOutlined,
    CrownOutlined,
    ThunderboltOutlined,
    TeamOutlined,
    AppstoreOutlined
} from '@ant-design/icons';
import { useAppStore } from '@/store/appStore';
import { useThemeStore } from '@/store/themeStore';
import { usePointsStore } from '@/store/pointsStore';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import clsx from 'clsx';
import dayjs from 'dayjs';

const { Content } = Layout;

interface MainLayoutProps {
    children: React.ReactNode;
}

// 简化后的导航结构
// 核心价值：AI 生成 → 一键分发 → 查看效果

export default function MainLayout({ children }: MainLayoutProps) {
    const router = useRouter();
    const { sidebarCollapsed, toggleSidebar, user } = useAppStore();
    const { isDark, toggleTheme } = useThemeStore();
    const { points } = usePointsStore();
    const pathname = usePathname();
    const [scrolled, setScrolled] = useState(false);
    const [hasCheckedIn, setHasCheckedIn] = useState(false);

    // 处理滚动效果
    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 20);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // 检查今日是否已签到
    useEffect(() => {
        const lastCheckIn = localStorage.getItem('lastCheckIn');
        if (lastCheckIn === dayjs().format('YYYY-MM-DD')) {
            setHasCheckedIn(true);
        }
    }, []);

    // 核心创作功能
    const creationItems = [
        { key: '/ai-create', icon: <EditOutlined />, label: <Link href="/ai-create">AI创作</Link>, desc: '快速生成内容' },
        { key: '/contents', icon: <FileTextOutlined />, label: <Link href="/contents">内容管理</Link>, desc: '管理所有作品' },
    ];

    // 分发功能
    const publishItems = [
        { key: '/publish', icon: <SendOutlined />, label: <Link href="/publish">分发中心</Link>, desc: '一键多平台发布' },
        { key: '/accounts', icon: <UserOutlined />, label: <Link href="/accounts">账号管理</Link>, desc: '连接社交账号' },
        { key: '/calendar', icon: <HomeOutlined />, label: <Link href="/calendar">发布日历</Link>, desc: '规划发布时间' },
    ];

    // 数据与素材
    const dataItems = [
        { key: '/analytics', icon: <BarChartOutlined />, label: <Link href="/analytics">数据分析</Link>, desc: '查看发布效果' },
        { key: '/materials', icon: <FolderOutlined />, label: <Link href="/materials">素材库</Link>, desc: '管理图片素材' },
        { key: '/hot', icon: <FireOutlined />, label: <Link href="/hot">热点追踪</Link>, desc: '发现热门话题' },
    ];

    // 设置与其他
    const settingsItems = [
        { key: '/team', icon: <TeamOutlined />, label: <Link href="/team">团队协作</Link> },
        { key: '/community', icon: <AppstoreOutlined />, label: <Link href="/community">创作者社区</Link> },
        { type: 'divider' as const },
        { key: '/points', icon: <ThunderboltOutlined />, label: <Link href="/points">积分中心</Link> },
        { key: '/settings', icon: <SettingOutlined />, label: <Link href="/settings">系统设置</Link> },
        { key: '/pricing', icon: <CreditCardOutlined />, label: <Link href="/pricing">升级会员</Link> },
    ];

    // 简化的菜单结构
    const menuItems = [
        { key: 'creation', label: '🎨 创作', children: creationItems },
        { key: 'publish', label: '📤 分发', children: publishItems },
        { key: 'data', label: '📊 数据', children: dataItems },
        { key: 'more', label: '更多', children: settingsItems },
    ];

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
            onClick: async () => {
                const { supabase } = await import('@/lib/supabase');
                await supabase.auth.signOut();
                window.location.href = '/login';
            }
        },
    ];

    const sidebarWidth = sidebarCollapsed ? 80 : 240;
    const isDarkMode = isDark;

    return (
        <div className={clsx(
            "min-h-screen flex",
            isDarkMode ? "bg-zinc-950" : "bg-background"
        )}>
            {/* 侧边栏 */}
            <motion.aside
                initial={false}
                animate={{ width: sidebarWidth }}
                className={clsx(
                    "fixed left-0 top-0 bottom-0 z-50 h-screen transition-all duration-300 flex flex-col",
                    isDarkMode 
                        ? "bg-zinc-900/95 backdrop-blur-xl border-r border-zinc-800" 
                        : "bg-white/95 backdrop-blur-xl border-r border-slate-100"
                )}
            >
                {/* Logo */}
                <div className={clsx(
                    "h-16 flex items-center justify-center border-b",
                    isDarkMode ? "border-zinc-800" : "border-zinc-200"
                )}>
                    {!sidebarCollapsed ? (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="flex items-center gap-3"
                        >
                            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white font-bold">
                                F
                            </div>
                            <span className={clsx(
                                "text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r",
                                isDarkMode ? "from-white to-zinc-400" : "from-zinc-900 to-zinc-600"
                            )}>
                                分发侠
                            </span>
                        </motion.div>
                    ) : (
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold">
                            F
                        </div>
                    )}
                </div>

                {/* 菜单 */}
                <div className="flex-1 overflow-y-auto py-4 px-2">
                    <ConfigProvider
                        theme={{
                            algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
                            components: {
                                Menu: {
                                    itemBg: 'transparent',
                                    subMenuItemBg: 'transparent',
                                    itemColor: isDark ? '#a1a1aa' : '#64748b',
                                    itemSelectedColor: '#6366f1',
                                    itemSelectedBg: 'rgba(99, 102, 241, 0.1)',
                                    itemHoverColor: isDark ? '#e4e4e7' : '#0f172a',
                                    itemHoverBg: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0, 0, 0, 0.03)',
                                    itemBorderRadius: 8,
                                    marginXS: 4,
                                }
                            }
                        }}
                    >
                        <Menu
                            mode="inline"
                            selectedKeys={[pathname]}
                            items={menuItems}
                            inlineCollapsed={sidebarCollapsed}
                            style={{ border: 'none', background: 'transparent' }}
                        />
                    </ConfigProvider>
                </div>

                {/* 底部会员信息 */}
                {!sidebarCollapsed && (
                    <div className={clsx(
                        "p-4 border-t",
                        isDarkMode ? "border-zinc-800" : "border-zinc-200"
                    )}>
                        <div 
                            onClick={() => router.push('/pricing')}
                            className={clsx(
                                "rounded-xl p-3 border cursor-pointer transition-all",
                                isDarkMode 
                                    ? "bg-gradient-to-br from-amber-500/20 to-orange-500/10 border-amber-500/30"
                                    : "bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200"
                            )}
                        >
                            <div className="flex items-center gap-2 mb-2">
                                <CrownOutlined className={clsx("text-sm", isDarkMode ? "text-amber-400" : "text-amber-600")} />
                                <span className={clsx(
                                    "text-sm font-bold",
                                    isDarkMode ? "text-amber-400" : "text-amber-600"
                                )}>免费版</span>
                            </div>
                            <div className={clsx(
                                "text-[11px]",
                                isDarkMode ? "text-zinc-500" : "text-zinc-400"
                            )}>
                                升级解锁无限额度
                            </div>
                        </div>
                    </div>
                )}
            </motion.aside>

            {/* 主内容区 */}
            <main
                className="flex-1 transition-all duration-300 flex flex-col min-h-screen relative"
                style={{ marginLeft: sidebarWidth }}
            >
                {/* 顶部栏 */}
                <header
                    className={clsx(
                        "sticky top-0 z-40 transition-all duration-300 px-6 h-16 flex items-center justify-between",
                        scrolled 
                            ? isDarkMode 
                                ? "bg-zinc-900/60 border-b border-zinc-800 backdrop-blur-xl" 
                                : "bg-white/60 border-b border-slate-100 backdrop-blur-xl"
                            : "bg-transparent"
                    )}
                >
                    {/* 左侧：折叠按钮 + 搜索 */}
                    <div className="flex items-center gap-4">
                        <button
                            onClick={toggleSidebar}
                            className={clsx(
                                "w-8 h-8 flex items-center justify-center rounded-lg transition-colors",
                                isDarkMode 
                                    ? "hover:bg-zinc-800 text-zinc-400 hover:text-white" 
                                    : "hover:bg-zinc-100 text-zinc-500 hover:text-zinc-900"
                            )}
                        >
                            {sidebarCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                        </button>

                        {/* 搜索框 */}
                        <div className="relative group hidden md:block w-48">
                            <SearchOutlined className={clsx(
                                "absolute left-3 top-1/2 -translate-y-1/2",
                                isDarkMode ? "text-zinc-500" : "text-slate-400"
                            )} />
                            <input
                                type="text"
                                placeholder="搜索内容..."
                                className={clsx(
                                    "w-full rounded-full pl-10 pr-4 py-1.5 text-sm focus:outline-none focus:ring-1",
                                    isDarkMode
                                        ? "bg-zinc-800/50 text-white placeholder-zinc-500 focus:bg-zinc-800 focus:ring-indigo-500/50"
                                        : "bg-slate-200/50 text-slate-900 focus:bg-white focus:ring-indigo-500/50"
                                )}
                            />
                        </div>
                    </div>

                    {/* 右侧：操作按钮 */}
                    <div className="flex items-center gap-3">
                        {/* 主题切换 */}
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={toggleTheme}
                            className={clsx(
                                "w-8 h-8 flex items-center justify-center rounded-lg",
                                isDarkMode 
                                    ? "bg-zinc-800 text-amber-400 hover:bg-zinc-700" 
                                    : "bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
                            )}
                        >
                            {isDark ? <SunOutlined /> : <MoonOutlined />}
                        </motion.button>

                        {/* 签到 */}
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => router.push('/points')}
                            className={clsx(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium",
                                hasCheckedIn
                                    ? isDarkMode ? "bg-green-500/20 text-green-400" : "bg-green-100 text-green-600"
                                    : isDarkMode ? "bg-amber-500/20 text-amber-400" : "bg-orange-100 text-orange-600"
                            )}
                        >
                            <FireOutlined className={clsx(!hasCheckedIn && "animate-pulse")} />
                            {hasCheckedIn ? '已签到' : '签到'}
                        </motion.button>

                        {/* 积分 */}
                        <div className={clsx(
                            "hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium",
                            isDarkMode ? "bg-zinc-800 text-amber-400" : "bg-amber-50 text-amber-600"
                        )}>
                            <ThunderboltOutlined />
                            <span>{points}</span>
                        </div>

                        {/* 通知 */}
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            className={clsx(
                                "relative p-1.5 rounded-lg transition-colors",
                                isDarkMode ? "text-zinc-400 hover:text-white" : "text-zinc-500 hover:text-zinc-700"
                            )}
                        >
                            <BellOutlined className="text-lg" />
                            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full" />
                        </motion.button>

                        {/* 新建按钮 */}
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => router.push('/ai-create')}
                            className={clsx(
                                "flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium text-white",
                                "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500"
                            )}
                        >
                            <PlusOutlined />
                            <span className="hidden sm:inline">新建</span>
                        </motion.button>

                        {/* 用户菜单 */}
                        <Dropdown menu={{ items: userMenuItems }} placement="bottomRight" trigger={['click']}>
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                className="flex items-center gap-2 group cursor-pointer ml-2"
                            >
                                <div className="text-right hidden md:block">
                                    <div className={clsx(
                                        "text-sm font-medium",
                                        isDarkMode ? "text-zinc-300" : "text-zinc-700"
                                    )}>
                                        {user?.name || '创作者'}
                                    </div>
                                </div>
                                <Avatar
                                    src={user?.avatar_url}
                                    icon={<UserOutlined />}
                                    className={clsx(
                                        "border-2",
                                        isDarkMode 
                                            ? "border-zinc-700 bg-zinc-800" 
                                            : "border-transparent bg-indigo-50"
                                    )}
                                    size={32}
                                />
                            </motion.button>
                        </Dropdown>
                    </div>
                </header>

                {/* 内容区 */}
                <div className={clsx(
                    "flex-1 p-6 overflow-x-hidden",
                    isDarkMode ? "bg-zinc-950" : "bg-background"
                )}>
                    {/* 背景光效 */}
                    <div className="fixed top-0 left-0 w-full h-[500px] bg-indigo-500/5 blur-[120px] pointer-events-none -z-10" />
                    <div className="fixed bottom-0 right-0 w-[500px] h-[500px] bg-purple-500/5 blur-[120px] pointer-events-none -z-10" />

                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                    >
                        {children}
                    </motion.div>
                </div>
            </main>
        </div>
    );
}
