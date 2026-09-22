import { withSentryConfig } from '@sentry/nextjs/config';

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  allowedDevOrigins: ['127.0.0.1'],
  turbopack: { root: process.cwd() },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'v1.siliconflow.cn' },
    ],
  },
  // 不要再加 `/api/v1/:path*` 的 rewrite：它先于 src/app/api/v1/[...path]/route.ts 生效，
  // 请求就不带 Authorization 直接到后端，所有登录后的接口 401（见该文件头部说明）。
  // /api/health 由 src/app/api/health/route.ts 处理。
  webpack(config) {
    if (process.env.NEXT_DISABLE_WEBPACK_CACHE === '1') config.cache = false;
    return config;
  },
};

// 构建期：Sentry 插件默认把 source map 传到 sentry.io，并向 sentry.io 发构建遥测。
// 国内版只允许传到境内自建 Sentry（SENTRY_URL），遥测一律关闭。
const sentryUrl = process.env.SENTRY_URL || '';
const domesticSentry = (() => {
  try {
    const url = new URL(sentryUrl);
    return url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash
      && !/(^|\.)sentry\.io\.?$/i.test(url.hostname);
  } catch {
    return false;
  }
})();

export default withSentryConfig(nextConfig, {
  silent: true,
  telemetry: false,
  sentryUrl: domesticSentry ? sentryUrl : undefined,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: domesticSentry ? process.env.SENTRY_AUTH_TOKEN : undefined,
  sourcemaps: { disable: !(domesticSentry && process.env.SENTRY_AUTH_TOKEN) },
});
