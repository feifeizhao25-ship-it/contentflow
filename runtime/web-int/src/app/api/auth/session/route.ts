import { NextRequest, NextResponse } from 'next/server';

/**
 * Whether this browser is signed in, for the header. The token is an HTTP-only cookie, so the page
 * cannot read it; the header asks here instead (2026-11-21 test: "Sign in" stayed in the header after
 * signing in, because the layout always rendered it). The token is never returned.
 */
const apiOrigin = process.env.API_INTERNAL_URL || 'http://api:4000';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const token = request.cookies.get('ff_token')?.value;
  if (!token) return NextResponse.json({ signedIn: false });
  try {
    const upstream = await fetch(`${apiOrigin}/api/v1/auth/profile`, {
      headers: { authorization: `Bearer ${token}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    if (upstream.status === 401 || upstream.status === 403) {
      const response = NextResponse.json({ signedIn: false, expired: true });
      response.cookies.delete('ff_token');
      return response;
    }
    if (!upstream.ok) return NextResponse.json({ signedIn: true, confirmed: false });
    const payload = await upstream.json().catch(() => null);
    const user = payload?.data?.user ?? payload?.user ?? null;
    const email = typeof user?.email === 'string' ? user.email : null;
    const name = typeof user?.name === 'string' ? user.name : null;
    return NextResponse.json({ signedIn: true, confirmed: true, email, name });
  } catch {
    // The API is unreachable: the cookie is there, so do not pretend the user is signed out.
    return NextResponse.json({ signedIn: true, confirmed: false });
  }
}
