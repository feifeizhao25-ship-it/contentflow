import * as crypto from 'crypto';
/** Webhook 签名与投递（批2）：HMAC-SHA256，签名头 X-ContentFlow-Signature: sha256=<hex>，事件头 X-ContentFlow-Event。 */
export const WEBHOOK_EVENTS = ['content.generated', 'publish.task.success'] as const;
export function signWebhookPayload(secret: string, rawBody: string): string {
  return 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
}
export async function deliverWebhook(fetchFn: typeof fetch, sub: { url: string; secret: string }, event: string, payload: unknown): Promise<{ ok: boolean; status?: number; error?: string }> {
  const raw = JSON.stringify({ event, data: payload, sent_at: new Date().toISOString() });
  try {
    const res = await fetchFn(sub.url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-ContentFlow-Event': event, 'X-ContentFlow-Signature': signWebhookPayload(sub.secret, raw) }, body: raw, signal: AbortSignal.timeout(5000) });
    return { ok: res.ok, status: res.status, error: res.ok ? undefined : `webhook endpoint ${res.status}` };
  } catch (e: any) { return { ok: false, error: String(e?.message ?? e).slice(0, 200) }; }
}
/** 订阅密钥加密：AES-256-GCM，密钥来自 WEBHOOK_ENCRYPTION_KEY（64 hex / 32字节），未配置时拒绝创建（不落明文）。 */
export function encryptSecret(secret: string, keyHex = process.env.WEBHOOK_ENCRYPTION_KEY || ''): string {
  if (!/^[0-9a-fA-F]{64}$/.test(keyHex)) throw new Error('WEBHOOK_ENCRYPTION_KEY 未配置或不是 32 字节 hex，拒绝保存 Webhook 密钥明文');
  const iv = crypto.randomBytes(12); const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(keyHex, 'hex'), iv);
  const enc = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return [iv.toString('hex'), cipher.getAuthTag().toString('hex'), enc.toString('hex')].join(':');
}
export function decryptSecret(cipherText: string, keyHex = process.env.WEBHOOK_ENCRYPTION_KEY || ''): string {
  const [iv, tag, data] = cipherText.split(':');
  const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(keyHex, 'hex'), Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(tag, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'hex')), decipher.final()]).toString('utf8');
}
