/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  // No /api/v1 rewrite: it would run before src/app/api/v1/[...path]/route.ts, so requests reached the API
  // without the Authorization header and every signed-in call returned 401 (found in the 2026-10-16 UI test).
};

export default nextConfig;
