import { NextRequest, NextResponse } from 'next/server';

/**
 * Test login for development and test builds only.
 * The fixed marker lives only in this file. Production builds resolve absent.ts instead,
 * and the production output must not contain this marker.
 * The password comes from DEV_LOGIN_PASSWORD and is not stored in source.
 */
export const DEV_LOGIN_MARKER = 'contentflow-dev-login-channel-v1';

export async function POST(request: NextRequest) {
  if (request.headers.get('x-dev-login') !== DEV_LOGIN_MARKER) {
    return new NextResponse(null, { status: 404 });
  }
  const password = process.env.DEV_LOGIN_PASSWORD || '';
  if (password.length < 8) {
    return NextResponse.json({ message: 'Dev login is not configured' }, { status: 404 });
  }
  let email = '';
  try {
    const body = await request.json();
    email = typeof body?.email === 'string' ? body.email : '';
  } catch {
    email = '';
  }
  if (!email.includes('@')) {
    return NextResponse.json({ message: 'A test account email is required' }, { status: 400 });
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
    return NextResponse.json({ message: 'Dev login could not reach the local API' }, { status: 502 });
  }
  const payload = await upstream.json().catch(() => null);
  const auth = payload?.data ?? payload;
  if (!upstream.ok || typeof auth?.token !== 'string' || !auth.token.trim()) {
    return NextResponse.json({ message: 'Dev login did not succeed' }, { status: upstream.ok ? 502 : upstream.status });
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
