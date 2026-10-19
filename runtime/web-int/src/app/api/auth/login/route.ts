import { NextRequest, NextResponse } from 'next/server';
const apiOrigin = process.env.API_INTERNAL_URL || 'http://api:4000';
export async function POST(request: NextRequest) {
  try {
    const upstream = await fetch(`${apiOrigin}/api/v1/auth/login`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: await request.text(), cache: 'no-store', signal: AbortSignal.timeout(15000),
    });
    const payload = await upstream.json().catch(() => null);
    if (!upstream.ok) {
      const status = [400, 401, 403, 429].includes(upstream.status) ? upstream.status : 503;
      const message = status === 429 ? 'Too many sign-in attempts. Please try again later.'
        : status === 503 ? 'Sign-in is temporarily unavailable. Please try again later.'
        : 'Sign-in failed. Check your email, password and account access.';
      return NextResponse.json({ message }, { status });
    }
    const auth = payload?.data ?? payload;
    if (typeof auth?.token !== 'string' || !auth.token.trim()) {
      return NextResponse.json({ message: 'Sign-in could not be confirmed. Please try again.' }, { status: 502 });
    }
    const response = NextResponse.json({ user: auth.user });
    response.cookies.set('ff_token', auth.token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 604800 });
    return response;
  } catch {
    return NextResponse.json({ message: 'Sign-in is temporarily unavailable. Please try again later.' }, { status: 503 });
  }
}
