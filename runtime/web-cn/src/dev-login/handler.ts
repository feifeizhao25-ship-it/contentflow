import { NextRequest, NextResponse } from 'next/server';

/**
 * 开发 / 测试构建里的测试登录。
 * 固定标记只写在这个文件里。正式构建会改用 absent.ts，构建结果里不能出现这个标记。
 * 口令来自环境变量 DEV_LOGIN_PASSWORD，不写进源码。
 */
export const DEV_LOGIN_MARKER = 'contentflow-dev-login-channel-v1';

export function GET(_request: NextRequest) {
  return new NextResponse(null, { status: 404 });
}

export async function POST(request: NextRequest) {
  if (request.headers.get('x-dev-login') !== DEV_LOGIN_MARKER) {
    return new NextResponse(null, { status: 404 });
  }
  const password = process.env.DEV_LOGIN_PASSWORD || '';
  if (password.length < 8) {
    return NextResponse.json({ message: '开发登录未配置' }, { status: 404 });
  }
  let email = '';
  try {
    const body = await request.json();
    email = typeof body?.email === 'string' ? body.email : '';
  } catch {
    email = '';
  }
  if (!email.includes('@')) {
    return NextResponse.json({ message: '请提供测试账号邮箱' }, { status: 400 });
  }
  const origin = process.env.API_INTERNAL_URL || 'http://127.0.0.1:4000';
  let upstream: Response;
  try {
    upstream = await fetch(`${origin}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
      cache: 'no-store',
    });
  } catch {
    return NextResponse.json({ message: '开发登录连不上本地接口' }, { status: 502 });
  }
  const payload = await upstream.json().catch(() => null);
  const auth = payload?.data ?? payload;
  if (!upstream.ok || typeof auth?.token !== 'string' || !auth.token.trim()) {
    return NextResponse.json({ message: '开发登录没有成功' }, { status: upstream.ok ? 502 : upstream.status });
  }
  const name = typeof auth?.user?.name === 'string' ? auth.user.name : '';
  const response = NextResponse.json({ user: { name } });
  response.cookies.set('ff_token', auth.token, {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}
