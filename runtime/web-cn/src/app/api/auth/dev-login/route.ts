import type { NextRequest } from 'next/server';
import { POST as handle } from 'dev-login-entry';

/** 正式构建解析到 absent.ts，开发 / 测试构建解析到 handler.ts。见 dev-login-build.mjs。 */
export function POST(request: NextRequest) {
  return handle(request);
}
