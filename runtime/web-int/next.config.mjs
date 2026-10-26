/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  // No /api/v1 rewrite. It would run before src/app/api/v1/[...path]/route.ts,
  // skip cookie-to-Bearer handling, and turn every signed-in call into 401.
};
export default nextConfig;
