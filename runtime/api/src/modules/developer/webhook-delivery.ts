import * as crypto from 'crypto';
import * as https from 'https';
import { lookup as dnsLookup } from 'dns/promises';

const BLOCKED_WEBHOOK_HOSTS = new Set(['localhost', 'localhost.localdomain', 'metadata.google.internal']);

export function isBlockedWebhookHost(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase().replace(/\.+$/, '');
  if (!host || BLOCKED_WEBHOOK_HOSTS.has(host) || host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.localhost')) return true;
  if (host.includes(':')) return isBlockedWebhookAddress(host);
  const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!v4) return false;
  const parts = v4.slice(1).map(Number);
  if (parts.some((n) => n > 255)) return true;
  return isBlockedIpv4(parts);
}

/**
 * 非公网 IPv4：本网、私网、运营商 NAT、回环、链路本地、IETF 保留、文档示例、基准测试、6to4 中继、组播和保留段。
 * 参照 IANA IPv4 Special-Purpose Address Registry。
 */
function isBlockedIpv4([a, b, c]: number[]): boolean {
  if (a === 0 || a === 10 || a === 127 || a >= 224) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return true;
  if (a === 192 && b === 88 && c === 99) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a === 198 && b === 51 && c === 100) return true;
  if (a === 203 && b === 0 && c === 113) return true;
  return false;
}

/** 把 IPv6 文本展开成 8 个 16 位段；带 IPv4 尾巴（::ffff:127.0.0.1）的也展开。格式不对返回 null。 */
export function parseIpv6(text: string): number[] | null {
  let raw = text.replace(/^\[|\]$/g, '').toLowerCase();
  const zone = raw.indexOf('%');
  if (zone >= 0) raw = raw.slice(0, zone);
  const tail = raw.match(/^(.*:)(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (tail) {
    const v4 = tail[2].split('.').map(Number);
    if (v4.some((n) => n > 255)) return null;
    raw = `${tail[1]}${((v4[0] << 8) | v4[1]).toString(16)}:${((v4[2] << 8) | v4[3]).toString(16)}`;
  }
  const halves = raw.split('::');
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(':') : [];
  const rest = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  if (halves.length === 1 && head.length !== 8) return null;
  if (halves.length === 2 && head.length + rest.length > 7) return null;
  const fill = halves.length === 2 ? new Array(8 - head.length - rest.length).fill('0') : [];
  const groups = [...head, ...fill, ...rest];
  if (groups.length !== 8 || groups.some((g) => !/^[0-9a-f]{1,4}$/.test(g))) return null;
  return groups.map((g) => parseInt(g, 16));
}

function embeddedIpv4(hi: number, lo: number): number[] {
  return [hi >> 8, hi & 0xff, lo >> 8, lo & 0xff];
}

/** 任一解析结果落在本机、内网、链路本地、元数据、保留段或组播，整次投递都拒绝。 */
export function isBlockedWebhookAddress(address: string): boolean {
  const raw = address.replace(/^\[|\]$/g, '').toLowerCase();
  if (!raw.includes(':')) return isBlockedWebhookHost(raw);
  const g = parseIpv6(raw);
  if (!g) return true; // 认不出来的地址按不安全处理
  const [g0, g1, g2, g3, g4, g5, g6, g7] = g;
  // ::/96（含 :: 和 ::1，以及已废弃的 IPv4 兼容地址）
  if (g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0) return true;
  // ::ffff:0:0/96 IPv4 映射：按里面的 IPv4 判断（URL 会把 ::ffff:127.0.0.1 写成 ::ffff:7f00:1）
  if (g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0xffff) return isBlockedIpv4(embeddedIpv4(g6, g7));
  // ::ffff:0:0:0/96 IPv4 转换地址
  if (g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0xffff && g5 === 0) return true;
  // 64:ff9b::/96 与 64:ff9b:1::/48 NAT64：可能转到任意 IPv4，包括内网
  if (g0 === 0x64 && g1 === 0xff9b) return true;
  // 100::/64 丢弃前缀
  if (g0 === 0x100 && g1 === 0 && g2 === 0 && g3 === 0) return true;
  // 2001::/23 IETF 协议分配（含 Teredo 2001::/32、基准测试 2001:2::/48、ORCHID），2001:db8::/32 文档示例
  if (g0 === 0x2001 && g1 < 0x200) return true;
  if (g0 === 0x2001 && g1 === 0xdb8) return true;
  // 2002::/16 6to4：按里面的 IPv4 判断
  if (g0 === 0x2002) return isBlockedIpv4(embeddedIpv4(g1, g2));
  // 3fff::/20 文档示例
  if (g0 === 0x3fff && g1 < 0x1000) return true;
  // fc00::/7 唯一本地，fe80::/10 链路本地，fec0::/10 站点本地（已废弃），ff00::/8 组播
  if ((g0 & 0xfe00) === 0xfc00 || (g0 & 0xffc0) === 0xfe80 || (g0 & 0xffc0) === 0xfec0 || (g0 & 0xff00) === 0xff00) return true;
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

function isIpLiteral(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, '');
  return host.includes(':') || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host);
}

/**
 * 创建订阅时就解析域名：解析不出、或任一地址不是公网（如 localtest.me → 127.0.0.1），直接拒绝保存。
 * 投递时 deliverWebhook 仍会重新解析并只连已校验的 IP，防止创建后把域名改指到内网。
 */
export async function assertPublicWebhookDestination(
  raw: string,
  lookup: WebhookDeliveryDeps['lookup'] = lookupPublicAddresses,
): Promise<URL> {
  const url = assertPublicHttpsWebhookUrl(raw);
  if (isIpLiteral(url.hostname)) return url;
  const addresses = await resolveWebhookAddresses(url.hostname, lookup);
  if (!addresses.length) throw new Error('Webhook 域名无法解析：没有 DNS 记录，请确认域名拼写正确');
  if (addresses.some((item) => isBlockedWebhookAddress(item.address))) {
    throw new Error('Webhook 域名解析到本机、内网或保留地址，不能使用');
  }
  return url;
}

/** 暂时性的 DNS 故障（SERVFAIL / EAI_AGAIN / 超时）。创建接口会返回 503，调用方可稍后重试。 */
export class RetryableWebhookDnsError extends Error {
  readonly retryable = true;
  constructor() {
    super('Webhook DNS 暂时不可用，已短暂重试；请稍后重试（域名尚未保存）');
    this.name = 'RetryableWebhookDnsError';
  }
}

export function isTransientDnsError(error: any): boolean {
  return ['SERVFAIL', 'ESERVFAIL', 'EAI_AGAIN', 'EAI_FAIL', 'ETIMEOUT', 'ETIMEDOUT', 'EWEBHOOKDNSTIMEOUT'].includes(String(error?.code || '').toUpperCase());
}

async function lookupWithTimeout(hostname: string, lookup: NonNullable<WebhookDeliveryDeps['lookup']>) {
  let timer: ReturnType<typeof setTimeout>;
  try {
    return await Promise.race([
      lookup(hostname),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(Object.assign(new Error('DNS timeout'), { code: 'EWEBHOOKDNSTIMEOUT' })), 1000);
      }),
    ]);
  } finally {
    clearTimeout(timer!);
  }
}

/** 最多两次，每次 1 秒超时，间隔 150ms。NXDOMAIN / ENOTFOUND / ENODATA 不重试；任何非公网 IP 也不会进入重试。 */
export async function resolveWebhookAddresses(
  hostname: string,
  lookup: NonNullable<WebhookDeliveryDeps['lookup']> = lookupPublicAddresses,
): Promise<Array<{ address: string; family: number }>> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await lookupWithTimeout(hostname, lookup);
    } catch (error: any) {
      if (!isTransientDnsError(error)) throw new Error('Webhook 域名无法解析，请确认域名拼写正确且存在 DNS 记录');
      if (attempt === 1) throw new RetryableWebhookDnsError();
      await new Promise<void>((resolve) => setTimeout(resolve, 150));
    }
  }
  throw new RetryableWebhookDnsError();
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
