import { createSign, createVerify, generateKeyPairSync } from 'crypto';
import { canonicalAlipayParams, createAlipayPagePay, verifyAlipayNotify } from './alipay.adapter';

describe('支付宝 RSA2 适配器', () => {
  const keys = generateKeyPairSync('rsa', { modulusLength: 2048 });
  beforeEach(() => {
    process.env.ALIPAY_APP_ID = '2026000000000000';
    process.env.ALIPAY_PRIVATE_KEY = keys.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    process.env.ALIPAY_PUBLIC_KEY = keys.publicKey.export({ type: 'spki', format: 'pem' }).toString();
    process.env.ALIPAY_NOTIFY_URL = 'https://api.example.cn/api/v1/billing/callbacks/alipay';
    process.env.ALIPAY_RETURN_URL = 'https://app.example.cn/payment/result';
  });

  it('生成正式网关 RSA2 下单地址且金额来自服务端', () => {
    const result = createAlipayPagePay({ orderNo: 'CF1001', amount: 128, subject: '专业版' });
    const url = new URL(result.paymentUrl);
    expect(url.origin + url.pathname).toBe('https://openapi.alipay.com/gateway.do');
    expect(url.searchParams.get('sign_type')).toBe('RSA2');
    expect(url.searchParams.get('biz_content')).toContain('"total_amount":"128.00"');
    const params = Object.fromEntries(url.searchParams.entries());
    const verifier = createVerify('RSA-SHA256');
    verifier.update(canonicalAlipayParams(params, false)); verifier.end();
    expect(verifier.verify(process.env.ALIPAY_PUBLIC_KEY!, params.sign, 'base64')).toBe(true);
  });

  it('只接受支付宝公钥验证通过的通知', () => {
    const payload: Record<string, string> = { app_id: process.env.ALIPAY_APP_ID!, out_trade_no: 'CF1001', trade_no: 'ALI1', trade_status: 'TRADE_SUCCESS', total_amount: '128.00', seller_id: 'seller-1' };
    const signer = createSign('RSA-SHA256'); signer.update(canonicalAlipayParams(payload)); signer.end();
    payload.sign = signer.sign(process.env.ALIPAY_PRIVATE_KEY!, 'base64');
    expect(verifyAlipayNotify(payload)).toBe(true);
    expect(verifyAlipayNotify({ ...payload, total_amount: '1.00' })).toBe(false);
  });
});
