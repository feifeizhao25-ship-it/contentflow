"use client";

import { AntdRegistry } from '@ant-design/nextjs-registry';
import { ConfigProvider, theme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { useEffect, useState } from 'react';
import { ErrorBoundary, OfflineIndicator, SlowNetworkIndicator } from '@/components/error/ErrorBoundary';
import { useThemeStore } from '@/store/themeStore';

export function ClientProviders({ children }: Readonly<{ children: React.ReactNode }>) {
  const storedDark = useThemeStore((state) => state.isDark);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(storedDark);
    document.documentElement.classList.toggle('dark', storedDark);
  }, [storedDark]);

  return (
    <ErrorBoundary>
      <AntdRegistry>
        <ConfigProvider
          locale={zhCN}
          theme={{
            algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
            token: {
              colorPrimary: '#6366f1', borderRadius: 12, fontFamily: 'var(--font-inter)',
              colorBgContainer: isDark ? '#18181b' : '#ffffff',
              colorBgElevated: isDark ? '#27272a' : '#ffffff',
              colorText: isDark ? '#e4e4e7' : '#0f172a',
              colorTextSecondary: isDark ? '#a1a1aa' : '#64748b',
              colorBorder: isDark ? '#3f3f46' : '#e2e8f0',
              colorBgLayout: isDark ? '#09090b' : '#f8fafc',
            },
            components: {
              Button: { controlHeight: 40, borderRadius: 10, colorBgContainer: isDark ? '#27272a' : '#ffffff' },
              Card: { borderRadiusLG: 16, colorBgContainer: isDark ? '#18181b' : '#ffffff' },
              Input: { controlHeight: 40, borderRadius: 10, activeBorderColor: '#6366f1', colorBgContainer: isDark ? '#27272a' : '#ffffff' },
              Menu: { darkItemBg: '#18181b', darkSubMenuItemBg: '#27272a' },
            },
          }}
        >
          <OfflineIndicator />
          <SlowNetworkIndicator />
          {children}
        </ConfigProvider>
      </AntdRegistry>
    </ErrorBoundary>
  );
}
