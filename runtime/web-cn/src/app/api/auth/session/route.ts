import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * 只回答本浏览器有没有登录 cookie。
 * 没有 cookie 时不访问后端，公开页因此不会出现 401。令牌本身不返回。
 */
export async function GET(request: NextRequest) {
  const token = request.cookies.get('ff_token')?.value;
  return NextResponse.json({ signedIn: Boolean(token) });
}
