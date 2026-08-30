import type { Metadata } from 'next';
import './globals.css';
import { ClientProviders } from './client-providers';

export const metadata: Metadata = {
  title: '分发侠 - AI 驱动的全渠道内容分发平台',
  description: '面向中国内容团队的创作、审核、排期与复盘工作台',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased selection:bg-primary/30 selection:text-primary-foreground">
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}
