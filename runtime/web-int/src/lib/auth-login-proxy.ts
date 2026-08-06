import { NextResponse } from 'next/server';
import { setAuthTokenCookie } from '@/lib/server-cookies';

const GATEWAY_URL =
  process.env.GATEWAY_URL ||
  process.env.NEXT_PUBLIC_GATEWAY_URL ||
  'http://localhost:8080/api/v1';

function buildGatewayPath(path: string) {
  const base = GATEWAY_URL.replace(/\/$/, '');
  const cleanPath = path.replace(/^\//, '');
  const finalPath = base.endsWith('/api/v1') && cleanPath.startsWith('v1/')
    ? cleanPath.slice(3)
    : cleanPath;
  return `${base}/${finalPath}`;
}

export async function proxyLogin(
  request: Request,
  options: { exposeToken?: boolean } = {},
): Promise<Response> {
  const body = await request.text();
  const upstreamRes = await fetch(buildGatewayPath('v1/auth/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });

  const contentType = upstreamRes.headers.get('content-type') || '';
  if (!contentType.includes('application/json') || !upstreamRes.ok) {
    return new Response(upstreamRes.body, {
      status: upstreamRes.status,
      statusText: upstreamRes.statusText,
      headers: { 'Content-Type': contentType },
    });
  }

  const data = await upstreamRes.json();
  const token = data?.data?.access_token || data?.data?.token || data?.access_token || data?.token;

  if (token && typeof token === 'string') {
    await setAuthTokenCookie(token);
  }

  if (options.exposeToken) {
    return NextResponse.json(
      {
        success: true,
        data: {
          ...data,
          ...(data?.data || {}),
          access_token: token,
          token,
        },
      },
      { status: upstreamRes.status },
    );
  }

  const { access_token, token: _token, ...rest } = data;
  if (rest.data && typeof rest.data === 'object') {
    const { access_token: _innerAccessToken, token: _innerToken, ...safeData } = rest.data;
    rest.data = safeData;
  }

  return NextResponse.json({ ...rest, success: true }, { status: upstreamRes.status });
}