import type { NextRequest } from 'next/server';

/** 需要原样带给后端的请求头（小写）。其余一律不转发，避免把客户端伪造的内部头带进去。
 *  用法与原因见 src/app/api/v1/[...path]/route.ts。 */
export const FORWARDED_REQUEST_HEADERS = [
  'content-type',
  'accept',
  'accept-language',
  'user-agent',
  'x-forwarded-for',
  'x-request-id',
  'idempotency-key',
  // 微信支付 V3 异步通知的平台签名
  'wechatpay-timestamp',
  'wechatpay-nonce',
  'wechatpay-signature',
  'wechatpay-serial',
  'wechatpay-signature-type',
  // 支付适配器的可信回调（HMAC）
  'x-payment-timestamp',
  'x-payment-signature',
];

export const FORWARDED_RESPONSE_HEADERS = ['content-type', 'content-disposition', 'retry-after', 'cache-control'];

export function apiOrigin(): string {
  return (process.env.API_INTERNAL_URL || 'http://api:4000').replace(/\/$/, '');
}

export function buildUpstreamHeaders(request: Pick<NextRequest, 'headers' | 'cookies'>): Headers {
  const headers = new Headers();
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const token = request.cookies.get('ff_token')?.value;
  if (token) headers.set('authorization', `Bearer ${token}`);
  return headers;
}
