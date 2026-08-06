"use client";

import { AntdRegistry } from '@ant-design/nextjs-registry';
import { ConfigProvider, theme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import "./globals.css";
import { useThemeStore } from '@/store/themeStore';
import { useEffect, useState, Suspense } from 'react';
import { ErrorBoundary, OfflineIndicator, SlowNetworkIndicator } from '@/components/error/ErrorBoundary';
import { LoadingOutlined } from '@ant-design/icons';

// Loading fallback
function LoadingFallback() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50">
            <div className="text-center">
                <LoadingOutlined className="text-4xl text-indigo-500 animate-spin mb-4" />
                <p className="text-zinc-500">加载中...</p>
            </div>
        </div>
    );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isDarkStore = useThemeStore((state) => state.isDark);
  const [mounted, setMounted] = useState(false);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setMounted(true);
    setIsDark(isDarkStore);
  }, [isDarkStore]);

  // Prevent hydration mismatch
  if (!mounted) {
    return (
      <html lang="zh-CN">
        <head>
          <title>分发侠 - AI驱动的全渠道内容分发平台</title>
          <meta name="description" content="AI生成，一键分发，10倍效率" />
        </head>
        <body className="bg-background text-foreground antialiased min-h-screen">
          <AntdRegistry>
            <ConfigProvider
              locale={zhCN}
              theme={{
                algorithm: theme.defaultAlgorithm,
                token: {
                  colorPrimary: '#6366f1',
                  borderRadius: 12,
                  fontFamily: 'var(--font-inter)',
                  colorBgContainer: '#ffffff',
                  colorBgElevated: '#ffffff',
                  colorText: '#0f172a',
                },
              }}
            >
              <LoadingFallback />
            </ConfigProvider>
          </AntdRegistry>
        </body>
      </html>
    );
  }

  return (
    <html lang="zh-CN" className={isDark ? 'dark' : ''}>
      <head>
        <title>分发侠 - AI驱动的全渠道内容分发平台</title>
        <meta name="description" content="AI生成，一键分发，10倍效率" />
      </head>
      <body className={`${isDark ? 'dark bg-zinc-950 text-zinc-100' : 'bg-background text-foreground'} antialiased min-h-screen selection:bg-primary/30 selection:text-primary-foreground`}>
        <ErrorBoundary>
          <Suspense fallback={<LoadingFallback />}>
            <AntdRegistry>
              <ConfigProvider
                locale={zhCN}
                theme={{
                  algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
                  token: {
                    colorPrimary: '#6366f1',
                    borderRadius: 12,
                    fontFamily: 'var(--font-inter)',
                    colorBgContainer: isDark ? '#18181b' : '#ffffff',
                    colorBgElevated: isDark ? '#27272a' : '#ffffff',
                    colorText: isDark ? '#e4e4e7' : '#0f172a',
                    colorTextSecondary: isDark ? '#a1a1aa' : '#64748b',
                    colorBorder: isDark ? '#3f3f46' : '#e2e8f0',
                    colorBgLayout: isDark ? '#09090b' : '#f8fafc',
                  },
                  components: {
                    Button: {
                      controlHeight: 40,
                      borderRadius: 10,
                      colorBgContainer: isDark ? '#27272a' : '#ffffff',
                    },
                    Card: {
                      borderRadiusLG: 16,
                      colorBgContainer: isDark ? '#18181b' : '#ffffff',
                    },
                    Input: {
                      controlHeight: 40,
                      borderRadius: 10,
                      activeBorderColor: '#6366f1',
                      colorBgContainer: isDark ? '#27272a' : '#ffffff',
                    },
                    Menu: {
                      darkItemBg: '#18181b',
                      darkSubMenuItemBg: '#27272a',
                    },
                  }
                }}
              >
                {/* Network status indicators */}
                <OfflineIndicator />
                <SlowNetworkIndicator />
                {children}
              </ConfigProvider>
            </AntdRegistry>
          </Suspense>
        </ErrorBoundary>
      </body>
    </html>
  );
}
