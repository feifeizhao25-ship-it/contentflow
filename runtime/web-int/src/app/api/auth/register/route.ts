import { NextRequest, NextResponse } from 'next/server';

const apiOrigin = process.env.API_INTERNAL_URL || 'http://api:4000';

function failure(status: number): { status: number; message: string } {
  if (status === 409) return { status: 409, message: 'An account with this email already exists.' };
  if (status === 400) return { status: 400, message: 'Registration could not be completed. Check your details and try again.' };
  if (status === 429) return { status: 429, message: 'Too many registration attempts. Please try again later.' };
  return { status: 503, message: 'Registration is temporarily unavailable. Please try again later.' };
}

export async function POST(request: NextRequest) {
  try {
    const upstream = await fetch(`${apiOrigin}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: await request.text(),
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    });
    const payload = await upstream.json().catch(() => null);
    if (!upstream.ok) {
      const mapped = failure(upstream.status);
      return NextResponse.json({ message: mapped.message }, { status: mapped.status });
    }
    const auth = payload?.data ?? payload;
    if (typeof auth?.token !== 'string' || !auth.token.trim()) {
      return NextResponse.json({ message: 'Registration could not be confirmed. Please try again.' }, { status: 502 });
    }
    const response = NextResponse.json({ user: auth.user });
    response.cookies.set('ff_token', auth.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 604800,
    });
    return response;
  } catch {
    return NextResponse.json({ message: 'Registration is temporarily unavailable. Please try again later.' }, { status: 503 });
  }
}
