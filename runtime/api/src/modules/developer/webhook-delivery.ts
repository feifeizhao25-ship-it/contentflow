import * as crypto from 'crypto';
import * as https from 'https';
import { lookup as dnsLookup } from 'dns/promises';

const BLOCKED_WEBHOOK_HOSTS = new Set(['localhost', 'localhost.localdomain', 'metadata.google.internal']);

export function isBlockedWebhookHost(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (!host || BLOCKED_WEBHOOK_HOSTS.has(host) || host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.localhost')) return true;
  if (host.includes(':')) return isBlockedWebhookAddress(host);
  const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!v4) return false;
  const parts = v4.slice(1).map(Number);
  if (parts.some((n) => n > 255)) return true;
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127 || a >= 224) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

/** 任一解析结果落在本机、内网、链路本地、元数据或组播，整次投递都拒绝。 */
export function isBlockedWebhookAddress(address: string): boolean {
  const raw = address.replace(/^\[|\]$/g, '').toLowerCase();
  const mapped = raw.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (mapped) return isBlockedWebhookHost(mapped[1]);
  if (!raw.includes(':')) return isBlockedWebhookHost(raw);
  if (raw === '::1' || raw === '::') return true;
  const head = raw.split(':')[0] || '0';
  if (head.startsWith('fc') || head.startsWith('fd') || head.startsWith('ff')) return true;
  if (head.startsWith('fe8') || head.startsWith('fe9') || head.startsWith('fea') || head.startsWith('feb')) return true;
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

export interface PinnedWebhookRequest {
  ip: string;
  family: number;
  hostname: string;
  hostHeader: string;
  port: number;
  path: string;
  headers: Record<string, string>;
  body: string;
  timeoutMs: number;
}

export interface WebhookDeliveryDeps {
  lookup?: (hostname: string) => Promise<Array<{ address: string; family: number }>>;
  request?: (opts: PinnedWebhookRequest) => Promise<{ statusCode: number }>;
}

async function lookupPublicAddresses(hostname: string): Promise<Array<{ address: string; family: number }>> {
  const records = await dnsLookup(hostname, { all: true, verbatim: true });
  return records.map((record) => ({ address: record.address, family: record.family }));
}

/** 连到已经校验过的 IP。SNI 和 Host 仍用原来的域名，不跟随重定向。 */
export function sendPinnedHttps(opts: PinnedWebhookRequest, requestImpl: typeof https.request = https.request): Promise<{ statusCode: number }> {
  return new Promise((resolve, reject) => {
    const req = requestImpl({
      host: opts.ip,
      servername: opts.hostname,
      port: opts.port,
      method: 'POST',
      path: opts.path,
      headers: { ...opts.headers, Host: opts.hostHeader, 'Content-Length': Buffer.byteLength(opts.body) },
      timeout: opts.timeoutMs,
      rejectUnauthorized: true,
      lookup: (_hostname, options, callback) => {
        const done = typeof options === 'function' ? options : callback;
        if (typeof options === 'object' && options?.all) done(null, [{ address: opts.ip, family: opts.family }]);
        else done(null, opts.ip, opts.family);
      },
    }, (res) => {
      res.resume();
      resolve({ statusCode: res.statusCode ?? 0 });
    });
    req.on('timeout', () => req.destroy(new Error('webhook timeout')));
    req.on('error', reject);
    req.write(opts.body);
    req.end();
  });
}

/**
 * 每次投递都重新解析域名。只要有一个地址不是公网，就拒绝连接。
 * 通过校验的地址才作为 TCP 目标，避免创建时是公网、发送时被改指到内网。
 */
export async function deliverWebhook(
  sub: { url: string; secret: string },
  event: string,
  payload: unknown,
  deps: WebhookDeliveryDeps = {},
): Promise<{ ok: boolean; status?: number; error?: string }> {
  const lookup = deps.lookup ?? lookupPublicAddresses;
  const request = deps.request ?? ((opts: PinnedWebhookRequest) => sendPinnedHttps(opts));
  try {
    const url = assertPublicHttpsWebhookUrl(sub.url);
    const addresses = await lookup(url.hostname);
    if (!addresses.length) return { ok: false, error: 'Webhook 域名没有解析结果' };
    if (addresses.some((item) => isBlockedWebhookAddress(item.address))) {
      return { ok: false, error: 'Webhook 域名解析到非公网地址，已拒绝投递' };
    }
    const chosen = addresses[0];
    const raw = JSON.stringify({ event, data: payload, sent_at: new Date().toISOString() });
    const result = await request({
      ip: chosen.address,
      family: chosen.family,
      hostname: url.hostname,
      hostHeader: url.host,
      port: url.port ? Number(url.port) : 443,
      path: `${url.pathname}${url.search}` || '/',
      headers: {
        'Content-Type': 'application/json',
        'X-ContentFlow-Event': event,
        'X-ContentFlow-Signature': signWebhookPayload(sub.secret, raw),
      },
      body: raw,
      timeoutMs: 5000,
    });
    if (result.statusCode >= 300 && result.statusCode < 400) {
      return { ok: false, status: result.statusCode, error: 'Webhook 重定向已拒绝' };
    }
    const ok = result.statusCode >= 200 && result.statusCode < 300;
    return { ok, status: result.statusCode, error: ok ? undefined : `webhook endpoint ${result.statusCode}` };
  } catch (e: any) {
    return { ok: false, error: String(e?.message ?? e).slice(0, 200) };
  }
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
