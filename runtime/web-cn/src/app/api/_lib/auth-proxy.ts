import { NextRequest, NextResponse } from 'next/server';
import { apiOrigin, buildUpstreamHeaders } from '../../../lib/api-proxy';

/**
 * 登录 / 注册类路由：转给后端，成功后把令牌写进 httpOnly cookie（浏览器脚本读不到令牌）。
 *
 * - 客户端地址（X-Forwarded-For）必须转给后端：后端按地址限流，转不过去就是全站共用一个额度。
 * - 失败（含限流 429、验证码错误）原样透传状态码与后端的中文错误，不写 cookie。
 * - 后端不可达时给中文提示。
 */
export async function proxyAuth(request: NextRequest, upstreamPath: string, successStatus = 200): Promise<NextResponse> {
  const headers = buildUpstreamHeaders(request);
  headers.delete('authorization'); // 登录 / 注册不应带着旧令牌去后端
  headers.set('content-type', 'application/json');

  let upstream: Response;
  try {
    upstream = await fetch(`${apiOrigin()}${upstreamPath}`, {
      method: 'POST',
      headers,
      body: await request.text(),
      cache: 'no-store',
    });
  } catch {
    return NextResponse.json(
      { success: false, error: { code: 'UPSTREAM_UNAVAILABLE', message: '服务暂时不可用，请稍后重试' } },
      { status: 502 },
    );
  }

  const payload = await upstream.json().catch(() => ({}));
  const auth = payload?.data ?? payload;
  if (!upstream.ok || !auth?.token) {
    const headersOut = new Headers({ 'content-type': 'application/json' });
    const retryAfter = upstream.headers.get('retry-after');
    if (retryAfter) headersOut.set('retry-after', retryAfter);
    return new NextResponse(JSON.stringify(payload), { status: upstream.ok ? 502 : upstream.status, headers: headersOut });
  }

  const response = NextResponse.json({ user: auth.user }, { status: successStatus });
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
