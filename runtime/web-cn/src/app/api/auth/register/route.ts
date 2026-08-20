import { NextRequest, NextResponse } from 'next/server';

const apiOrigin = process.env.API_INTERNAL_URL || 'http://api:4000';

export async function POST(request: NextRequest) {
  const upstream = await fetch(`${apiOrigin}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: await request.text(),
    cache: 'no-store',
  });
  const payload = await upstream.json().catch(() => ({}));
  const auth = payload?.data ?? payload;
  if (!upstream.ok || !auth?.token) {
    return NextResponse.json(payload, { status: upstream.status });
  }

  const response = NextResponse.json({ user: auth.user }, { status: 201 });
  response.cookies.set('ff_token', auth.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
  if (auth.refreshToken) {
    response.cookies.set('ff_refresh_token', auth.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api/auth',
      maxAge: 60 * 60 * 24 * 30,
    });
  }
  return response;
}
