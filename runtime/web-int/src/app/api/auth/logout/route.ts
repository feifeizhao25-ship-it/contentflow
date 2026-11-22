import { NextResponse } from 'next/server';

/** Sign out of this browser: clear the HTTP-only session cookie. */
export async function POST() {
  const response = NextResponse.json({ signedIn: false });
  response.cookies.set('ff_token', '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 0 });
  return response;
}
