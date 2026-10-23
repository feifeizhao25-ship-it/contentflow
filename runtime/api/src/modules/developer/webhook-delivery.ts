import * as crypto from 'crypto';
const BLOCKED_WEBHOOK_HOSTS = new Set(['localhost', 'localhost.localdomain', 'metadata.google.internal']);

function isBlockedWebhookHost(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (!host || BLOCKED_WEBHOOK_HOSTS.has(host) || host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.localhost')) return true;
  if (host.includes(':')) {
    return host === '::1' || host === '::' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80');
  }
  const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!v4) return false;
  const parts = v4.slice(1).map(Number);
  if (parts.some((n) => n > 255)) return true;
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

/** 只接受公网 HTTPS。拒绝本机、内网、链路本地和云元数据地址，避免 Webhook 被用来探测内网。 */
export function assertPublicHttpsWebhookUrl(raw: string): URL {
  let url: URL;
  try { url = new URL(String(raw || '').trim()); } catch { throw new Error('Webhook 地址格式不正确'); }
  if (url.protocol !== 'https:') throw new Error('Webhook 地址必须以 https:// 开头');
  if (url.username || url.password) throw new Error('Webhook 地址不能包含账号或密码');
  if (isBlockedWebhookHost(url.hostname)) throw new Error('Webhook 地址必须是公网 HTTPS，不能指向本机或内网');
  return url;
}

/** Webhook 签名与投递：HMAC-SHA256，签名头 X-ContentFlow-Signature: sha256=<hex>，事件头 X-ContentFlow-Event。 */
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
