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
      { protocol: 'https', hostname: 'fal.media' },
      { protocol: 'https', hostname: 'fal-cdn.com' },
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

export default withSentryConfig(nextConfig, {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
});
