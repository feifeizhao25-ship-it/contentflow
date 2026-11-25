import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { devLoginEntry } from './dev-login-build.mjs';

const appRoot = path.dirname(fileURLToPath(import.meta.url));
const devLoginRelative = devLoginEntry(process.env.NODE_ENV);
const devLoginFile = path.resolve(appRoot, devLoginRelative);

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  turbopack: {
    resolveAlias: { 'dev-login-entry': devLoginRelative },
  },
  // No /api/v1 rewrite. It would run before src/app/api/v1/[...path]/route.ts,
  // skip cookie-to-Bearer handling, and turn every signed-in call into 401.
  webpack(config) {
    config.resolve.alias = { ...config.resolve.alias, 'dev-login-entry': devLoginFile };
    return config;
  },
};
export default nextConfig;
