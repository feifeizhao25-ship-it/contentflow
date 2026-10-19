/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  // /api/v1 requests must reach the authenticated catch-all route. A rewrite
  // runs before dynamic routes and would bypass cookie-to-Bearer handling.
};
export default nextConfig;
