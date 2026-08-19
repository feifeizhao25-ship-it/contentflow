import { withSentryConfig } from '@sentry/nextjs';

const apiBase = (process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'fal.media' },
      { protocol: 'https', hostname: 'fal-cdn.com' },
      { protocol: 'https', hostname: 'plus.google.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'sglrznzdmqrjciypnfpe.supabase.co' },
      { protocol: 'https', hostname: 'v1.siliconflow.cn' },
    ],
  },
  async rewrites() {
    return [
      { source: '/api/v1/:path*', destination: `${apiBase}/api/v1/:path*` },
      { source: '/api/health', destination: `${apiBase}/health` },
    ];
  },
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
