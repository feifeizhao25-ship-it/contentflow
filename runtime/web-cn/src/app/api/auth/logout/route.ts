import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.set('ff_token', '', { httpOnly: true, path: '/', maxAge: 0 });
  response.cookies.set('ff_refresh_token', '', {
    httpOnly: true,
    path: '/api/auth',
    maxAge: 0,
  });
  return response;
}
