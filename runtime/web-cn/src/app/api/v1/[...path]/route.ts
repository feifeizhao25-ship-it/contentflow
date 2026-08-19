import { NextRequest, NextResponse } from 'next/server';

const apiOrigin = process.env.API_INTERNAL_URL || 'http://api:4000';

async function proxy(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  const token = request.cookies.get('ff_token')?.value;
  if (!token) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const target = new URL(`${apiOrigin}/api/v1/${path.join('/')}`);
  request.nextUrl.searchParams.forEach((value, key) => target.searchParams.append(key, value));
  const headers = new Headers();
  headers.set('authorization', `Bearer ${token}`);
  const contentType = request.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);

  const upstream = await fetch(target, {
    method: request.method,
    headers,
    body: ['GET', 'HEAD'].includes(request.method) ? undefined : await request.arrayBuffer(),
    cache: 'no-store',
  });
  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: {
      'content-type': upstream.headers.get('content-type') || 'application/json',
    },
  });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
