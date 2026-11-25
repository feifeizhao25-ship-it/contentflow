import { NextRequest, NextResponse } from 'next/server';

/** 正式构建使用的入口：没有测试登录，任何请求都是 404。 */
export function POST(_request: NextRequest) {
  return new NextResponse(null, { status: 404 });
}
