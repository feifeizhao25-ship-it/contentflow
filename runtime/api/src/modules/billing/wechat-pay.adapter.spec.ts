import { createCipheriv, createSign, createVerify, generateKeyPairSync } from 'crypto';
import { createWeChatNativePay, decryptWeChatNotify, verifyWeChatNotifySignature } from './wechat-pay.adapter';

describe('WeChat Pay V3 adapter', () => {
  const merchant = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const platform = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const apiKey = '12345678901234567890123456789012';

  beforeEach(() => {
    process.env.WECHAT_PAY_MCH_ID = '1900000109';
    process.env.WECHAT_PAY_APP_ID = 'wx2026000000000000';
    process.env.WECHAT_PAY_PRIVATE_KEY = merchant.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    process.env.WECHAT_PAY_SERIAL_NO = 'MERCHANTSERIAL';
    process.env.WECHAT_PAY_API_V3_KEY = apiKey;
    process.env.WECHAT_PAY_NOTIFY_URL = 'https://api.example.cn/api/v1/billing/callbacks/wechat';
    process.env.WECHAT_PAY_PLATFORM_PUBLIC_KEY = platform.publicKey.export({ type: 'spki', format: 'pem' }).toString();
    process.env.WECHAT_PAY_PLATFORM_SERIAL_NO = 'PLATFORMSERIAL';
  });

  it('signs a native-payment request and returns the official code_url', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true, json: async () => ({ code_url: 'weixin://wxpay/bizpayurl?pr=test' }),
    } as Response);
    const result = await createWeChatNativePay({ orderNo: 'CF1001', amount: 128, description: '专业版' });
    expect(result.paymentUrl).toBe('weixin://wxpay/bizpayurl?pr=test');
    const [, init] = fetchMock.mock.calls[0];
    const auth = String((init!.headers as any).authorization);
    const fields = Object.fromEntries([...auth.matchAll(/(mchid|nonce_str|signature|timestamp|serial_no)="([^"]+)"/g)].map((m) => [m[1], m[2]]));
    const body = String(init!.body);
    const verifier = createVerify('RSA-SHA256');
    verifier.update(`POST\n/v3/pay/transactions/native\n${fields.timestamp}\n${fields.nonce_str}\n${body}\n`); verifier.end();
    expect(verifier.verify(merchant.publicKey, fields.signature, 'base64')).toBe(true);
    expect(JSON.parse(body).amount).toEqual({ total: 12800, currency: 'CNY' });
    fetchMock.mockRestore();
  });

  it('verifies platform signature and decrypts AEAD_AES_256_GCM notification', () => {
    const transaction = {
      mchid: process.env.WECHAT_PAY_MCH_ID, appid: process.env.WECHAT_PAY_APP_ID,
      out_trade_no: 'CF1001', transaction_id: 'WX1001', trade_state: 'SUCCESS',
      amount: { total: 12800, currency: 'CNY' },
    };
    const nonce = Buffer.from('notifyNonce1');
    const aad = Buffer.from('transaction');
    const cipher = createCipheriv('aes-256-gcm', Buffer.from(apiKey), nonce);
    cipher.setAAD(aad);
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(transaction)), cipher.final(), cipher.getAuthTag()]);
    const body = {
      id: 'evt-1', resource: {
        algorithm: 'AEAD_AES_256_GCM', ciphertext: encrypted.toString('base64'),
        nonce: nonce.toString(), associated_data: aad.toString(),
      },
    };
    const raw = Buffer.from(JSON.stringify(body));
    const timestamp = String(Math.floor(Date.now() / 1000));
    const notifyNonce = 'notify-nonce';
    const signer = createSign('RSA-SHA256');
    signer.update(`${timestamp}\n${notifyNonce}\n${raw.toString()}\n`); signer.end();
    const headers = {
      'wechatpay-serial': 'PLATFORMSERIAL', 'wechatpay-timestamp': timestamp,
      'wechatpay-nonce': notifyNonce, 'wechatpay-signature': signer.sign(platform.privateKey, 'base64'),
    };
    expect(verifyWeChatNotifySignature(raw, headers)).toBe(true);
    expect(decryptWeChatNotify(body)).toEqual(transaction);
    raw[raw.length - 2] ^= 1;
    expect(verifyWeChatNotifySignature(raw, headers)).toBe(false);
  });
});
