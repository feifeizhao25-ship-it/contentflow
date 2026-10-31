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
    TeamOutlined,
    AppstoreOutlined
} from '@ant-design/icons';
import { useAppStore } from '@/store/appStore';
import { useThemeStore } from '@/store/themeStore';
import { apiClient } from '@/lib/api-client';
import { planBadge } from '@/lib/page-data';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import clsx from 'clsx';

const { Content } = Layout;

interface MainLayoutProps {
    children: React.ReactNode;
}

// 简化后的导航结构
// 核心价值：AI 生成 → 发布（授权平台自动发布，其余人工确认发布）→ 查看效果

export default function MainLayout({ children }: MainLayoutProps) {
    const router = useRouter();
    const { sidebarCollapsed, toggleSidebar, user, initializeAuth } = useAppStore();
    const { isDark, toggleTheme } = useThemeStore();
    const pathname = usePathname();
    const [scrolled, setScrolled] = useState(false);
    // 侧栏套餐卡：读真实套餐（原来写死「免费版」）
    const [plan, setPlan] = useState(() => planBadge(null));
    useEffect(() => {
        apiClient.get('/billing/subscription', { redirectOn401: false }).then((r) => setPlan(planBadge(r))).catch(() => setPlan(planBadge(null)));
    }, []);
    const [isMobile, setIsMobile] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    useEffect(() => {
        const media = window.matchMedia('(max-width: 767px)');
        const updateViewport = () => {
            setIsMobile(media.matches);
            if (!media.matches) setMobileMenuOpen(false);
        };
        updateViewport();
        media.addEventListener('change', updateViewport);
        return () => media.removeEventListener('change', updateViewport);
    }, []);

    // 登录身份：initializeAuth 原来没有任何地方调用，store 里的 user 永远是 null，
    // 设置页「个人资料」的姓名因此为空（注册时明明填了）。进入工作台时从 /auth/profile 读一次。
    useEffect(() => {
        if (!user) void initializeAuth();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 处理滚动效果
    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 20);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // 核心创作功能
    const creationItems = [
        { key: '/ai-create', icon: <EditOutlined />, label: <Link href="/ai-create">AI创作</Link>, desc: '快速生成内容' },
        { key: '/contents', icon: <FileTextOutlined />, label: <Link href="/contents">内容管理</Link>, desc: '管理所有作品' },
    ];

    // 分发功能
    const publishItems = [
        { key: '/publish', icon: <SendOutlined />, label: <Link href="/publish">发布中心</Link>, desc: '授权平台自动发，其余人工确认发' },
        { key: '/accounts', icon: <UserOutlined />, label: <Link href="/accounts">账号管理</Link>, desc: '连接社交账号' },
        { key: '/calendar', icon: <HomeOutlined />, label: <Link href="/calendar">发布日历</Link>, desc: '规划发布时间' },
    ];

    // 数据与素材
    const dataItems = [
        { key: '/analytics', icon: <BarChartOutlined />, label: <Link href="/analytics">数据分析</Link>, desc: '查看发布效果' },
        { key: '/materials', icon: <FolderOutlined />, label: <Link href="/materials">素材库</Link>, desc: '管理图片素材' },
        { key: '/hot', icon: <FireOutlined />, label: <Link href="/hot">热点追踪</Link>, desc: '发现热门话题' },
        { key: '/rules', icon: <FileTextOutlined />, label: <Link href="/rules">规则库</Link>, desc: '平台与法规规则' },
    ];

    // 设置与其他
    const settingsItems = [
        { key: '/team', icon: <TeamOutlined />, label: <Link href="/team">团队协作</Link> },
        { key: '/community', icon: <AppstoreOutlined />, label: <Link href="/community">创作者社区</Link> },
        { type: 'divider' as const },
        { key: '/settings', icon: <SettingOutlined />, label: <Link href="/settings">系统设置</Link> },
        { key: '/settings/developer', icon: <SettingOutlined />, label: <Link href="/settings/developer">对外通知</Link> },
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
                // 登录态是 httpOnly 的 ff_token，只有服务端能清（原来调的是 Supabase 退出，cookie 还在）。
                const { logout } = await import('@/lib/session');
                await logout();
            }
        },
    ];

    const sidebarWidth = isMobile ? 240 : (sidebarCollapsed ? 80 : 240);
    const isDarkMode = isDark;

    return (
        <div className={clsx(
            "min-h-screen flex",
            isDarkMode ? "bg-zinc-950" : "bg-background"
        )}>
            {isMobile && mobileMenuOpen && (
                <button
                    type="button"
                    aria-label="关闭导航菜单"
                    className="fixed inset-0 z-40 bg-zinc-950/40 backdrop-blur-sm"
                    onClick={() => setMobileMenuOpen(false)}
                />
            )}
            {/* 侧边栏 */}
            <motion.aside
                initial={false}
                animate={{ width: sidebarWidth }}
                className={clsx(
                    "fixed left-0 z-50 h-screen transition-all duration-300 flex flex-col safe-sidebar",
                    isMobile && (mobileMenuOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"),
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
                                )}>{plan.name}</span>
                            </div>
                            <div className={clsx(
                                "text-[11px]",
                                isDarkMode ? "text-zinc-300" : "text-amber-900"
                            )}>
                                {plan.detail}
                            </div>
                        </div>
                    </div>
                )}
            </motion.aside>

            {/* 主内容区 */}
            <main
                className={clsx(
                    "flex-1 transition-all duration-300 flex flex-col min-h-screen relative min-w-0 ml-0",
                    sidebarCollapsed ? "md:ml-20" : "md:ml-60",
                )}
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
                            type="button"
                            aria-label={isMobile ? "打开导航菜单" : "折叠导航菜单"}
                            onClick={() => isMobile ? setMobileMenuOpen(true) : toggleSidebar()}
                            className={clsx(
                                "w-8 h-8 flex items-center justify-center rounded-lg transition-colors",
                                isDarkMode 
                                    ? "hover:bg-zinc-800 text-zinc-400 hover:text-white" 
                                    : "hover:bg-zinc-100 text-zinc-500 hover:text-zinc-900"
                            )}
                        >
                            {isMobile || sidebarCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
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

                        {/* 签到、积分、通知铃铛已移除：积分不再作为权益展示（「积分中心」只是跳到定价页），
                            铃铛没有通知中心、红点是写死的。 */}

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
                    "flex-1 p-4 sm:p-6 overflow-x-hidden min-w-0",
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
