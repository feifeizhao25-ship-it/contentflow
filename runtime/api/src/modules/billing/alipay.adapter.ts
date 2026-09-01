import { createSign, createVerify } from 'crypto';

export type AlipayNotify = Record<string, string | undefined>;

function pem(value: string): string {
  return value.replace(/\\n/g, '\n').trim();
}

export function canonicalAlipayParams(params: AlipayNotify, excludeSignType = true): string {
  return Object.entries(params)
    .filter(([key, value]) => key !== 'sign' && (!excludeSignType || key !== 'sign_type') && value != null && value !== '')
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join('&');
}

export function createAlipayPagePay(input: {
  orderNo: string;
  amount: number;
  subject: string;
}): { paymentUrl: string; signedPayload: string } {
  const appId = process.env.ALIPAY_APP_ID || '';
  const privateKey = process.env.ALIPAY_PRIVATE_KEY || '';
  const notifyUrl = process.env.ALIPAY_NOTIFY_URL || '';
  const returnUrl = process.env.ALIPAY_RETURN_URL || '';
  if (!appId || !privateKey || !notifyUrl || !returnUrl) throw new Error('支付宝下单配置不完整');
  for (const url of [notifyUrl, returnUrl]) {
    if (new URL(url).protocol !== 'https:') throw new Error('支付宝回调与返回地址必须使用 HTTPS');
  }
  const params: Record<string, string> = {
    app_id: appId,
    biz_content: JSON.stringify({
      out_trade_no: input.orderNo,
      product_code: 'FAST_INSTANT_TRADE_PAY',
      total_amount: input.amount.toFixed(2),
      subject: input.subject,
    }),
    charset: 'utf-8',
    format: 'JSON',
    method: 'alipay.trade.page.pay',
    notify_url: notifyUrl,
    return_url: returnUrl,
    sign_type: 'RSA2',
    timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
    version: '1.0',
  };
  // 请求签名包含 sign_type；异步通知验签按支付宝规范排除 sign_type。
  const signedPayload = canonicalAlipayParams(params, false);
  const signer = createSign('RSA-SHA256');
  signer.update(signedPayload, 'utf8');
  signer.end();
  const sign = signer.sign(pem(privateKey), 'base64');
  const gateway = process.env.ALIPAY_GATEWAY_URL || 'https://openapi.alipay.com/gateway.do';
  const query = new URLSearchParams({ ...params, sign }).toString();
  return { paymentUrl: `${gateway}?${query}`, signedPayload };
}

export function verifyAlipayNotify(params: AlipayNotify): boolean {
  const publicKey = process.env.ALIPAY_PUBLIC_KEY || '';
  const signature = params.sign || '';
  if (!publicKey || !signature) return false;
  const verifier = createVerify('RSA-SHA256');
  verifier.update(canonicalAlipayParams(params), 'utf8');
  verifier.end();
  try {
    return verifier.verify(pem(publicKey), signature, 'base64');
  } catch {
    return false;
  }
}
