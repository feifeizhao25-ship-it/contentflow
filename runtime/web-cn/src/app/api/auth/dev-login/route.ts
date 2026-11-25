import type { NextRequest } from 'next/server';
import { GET as get, POST as post } from 'dev-login-entry';

/** 正式构建解析到 absent.ts，开发 / 测试构建解析到 handler.ts。见 dev-login-build.mjs。 */
export function GET(request: NextRequest) {
  return get(request);
}
export function POST(request: NextRequest) {
  return post(request);
}
