import { NextRequest, NextResponse } from 'next/server';
import { apiOrigin, buildUpstreamHeaders, FORWARDED_RESPONSE_HEADERS } from '@/lib/api-proxy';

/**
 * 浏览器 → NestJS 的唯一通道。
 *
 * 浏览器只持有 httpOnly 的 `ff_token` cookie，NestJS 只认 `Authorization: Bearer`。
 * 这里负责把前者换成后者。
 *
 * 2026-09-21 之前：next.config.mjs 里还有一条 `/api/v1/:path*` → api 的 rewrite。
 * Next 的 rewrite（afterFiles）**先于动态路由**生效，于是这个文件从来没被调用过：
 * 请求原样转给后端，只带 cookie、不带 Authorization —— **所有需要登录的接口一律 401**，
 * 前端收到 401 就跳回登录页。那条 rewrite 已删除，所有 /api/v1/* 都经过这里。
 *
 * 规则：
 * - 有 cookie 就补 Authorization；没有也照常转发，由后端自己的守卫决定（套餐列表、
 *   支付宝/微信支付的异步通知本来就不带登录态——原来这里一律 401，付款永远确认不了）。
 * - 支付通知的验签依赖原始字节与平台签名头：原样转发请求体与 Wechatpay-* 头。
 * - X-Forwarded-For 原样转发，后端按真实客户端地址限流。
 */

async function proxy(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  const target = new URL(`${apiOrigin()}/api/v1/${path.map(encodeURIComponent).join('/')}`);
  request.nextUrl.searchParams.forEach((value, key) => target.searchParams.append(key, value));

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers: buildUpstreamHeaders(request),
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : await request.arrayBuffer(),
      cache: 'no-store',
      redirect: 'manual',
    });
  } catch {
    return NextResponse.json({ success: false, message: '服务暂时不可用，请稍后重试' }, { status: 502 });
  }

  const headers = new Headers();
  for (const name of FORWARDED_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  if (!headers.has('content-type')) headers.set('content-type', 'application/json');
  return new NextResponse(upstream.body, { status: upstream.status, headers });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
