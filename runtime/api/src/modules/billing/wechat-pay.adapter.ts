import { createDecipheriv, createSign, createVerify, randomBytes } from 'crypto';

function env(name: string): string {
  const value = (process.env[name] || '').replace(/\\n/g, '\n').trim();
  if (!value) throw new Error(`微信支付配置缺失：${name}`);
  return value;
}

function merchantAuthorization(method: string, urlPath: string, body: string) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonce = randomBytes(16).toString('hex');
  const message = `${method}\n${urlPath}\n${timestamp}\n${nonce}\n${body}\n`;
  const signer = createSign('RSA-SHA256');
  signer.update(message, 'utf8'); signer.end();
  const signature = signer.sign(env('WECHAT_PAY_PRIVATE_KEY'), 'base64');
  return `WECHATPAY2-SHA256-RSA2048 mchid="${env('WECHAT_PAY_MCH_ID')}",nonce_str="${nonce}",signature="${signature}",timestamp="${timestamp}",serial_no="${env('WECHAT_PAY_SERIAL_NO')}"`;
}

export async function createWeChatNativePay(input: {
  orderNo: string; amount: number; description: string;
}): Promise<{ paymentUrl: string }> {
  const notifyUrl = env('WECHAT_PAY_NOTIFY_URL');
  if (new URL(notifyUrl).protocol !== 'https:') throw new Error('微信支付回调地址必须使用 HTTPS');
  const urlPath = '/v3/pay/transactions/native';
  const payload = JSON.stringify({
    appid: env('WECHAT_PAY_APP_ID'), mchid: env('WECHAT_PAY_MCH_ID'),
    description: input.description.slice(0, 127), out_trade_no: input.orderNo,
    notify_url: notifyUrl, amount: { total: Math.round(input.amount * 100), currency: 'CNY' },
  });
  const response = await fetch(`https://api.mch.weixin.qq.com${urlPath}`, {
    method: 'POST',
    headers: {
      authorization: merchantAuthorization('POST', urlPath, payload),
      accept: 'application/json', 'content-type': 'application/json',
      'user-agent': 'ContentFlow/1.0',
    },
    body: payload,
  });
  const result = await response.json() as { code_url?: string; code?: string; message?: string };
  if (!response.ok || !result.code_url) {
    throw new Error(`微信支付下单失败：${result.code || response.status} ${result.message || ''}`.trim());
  }
  return { paymentUrl: result.code_url };
}

export function verifyWeChatNotifySignature(
  rawBody: Buffer, headers: Record<string, string | string[] | undefined>,
): boolean {
  const serial = String(headers['wechatpay-serial'] || '');
  const timestamp = String(headers['wechatpay-timestamp'] || '');
  const nonce = String(headers['wechatpay-nonce'] || '');
  const signature = String(headers['wechatpay-signature'] || '');
  if (!serial || serial !== env('WECHAT_PAY_PLATFORM_SERIAL_NO') || !timestamp || !nonce || !signature) return false;
  const epoch = Number(timestamp);
  if (!Number.isFinite(epoch) || Math.abs(Date.now() / 1000 - epoch) > 300) return false;
  const verifier = createVerify('RSA-SHA256');
  verifier.update(`${timestamp}\n${nonce}\n${rawBody.toString('utf8')}\n`, 'utf8'); verifier.end();
  try { return verifier.verify(env('WECHAT_PAY_PLATFORM_PUBLIC_KEY'), signature, 'base64'); }
  catch { return false; }
}

export function decryptWeChatNotify(body: any): any {
  const resource = body?.resource;
  if (resource?.algorithm !== 'AEAD_AES_256_GCM') throw new Error('微信支付通知加密算法无效');
  const key = Buffer.from(env('WECHAT_PAY_API_V3_KEY'), 'utf8');
  if (key.length !== 32) throw new Error('微信支付 API v3 密钥必须为 32 字节');
  const encrypted = Buffer.from(String(resource.ciphertext || ''), 'base64');
  if (encrypted.length <= 16) throw new Error('微信支付通知密文无效');
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(String(resource.nonce || ''), 'utf8'));
  decipher.setAAD(Buffer.from(String(resource.associated_data || ''), 'utf8'));
  decipher.setAuthTag(encrypted.subarray(encrypted.length - 16));
  const plaintext = Buffer.concat([decipher.update(encrypted.subarray(0, -16)), decipher.final()]);
  const transaction = JSON.parse(plaintext.toString('utf8'));
  if (transaction.mchid !== env('WECHAT_PAY_MCH_ID') || transaction.appid !== env('WECHAT_PAY_APP_ID')) {
    throw new Error('微信支付商户或应用不匹配');
  }
  return transaction;
}
