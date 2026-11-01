import * as dns from 'node:dns';
import * as net from 'node:net';
import { SIGNABLE_MEDIA } from './media-store';

export class RemoteMediaError extends Error {}

/** True for loopback / private / link-local / metadata addresses (IPv4 and IPv6). */
export function isPrivateAddress(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return (
      a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224
    );
  }
  const v = ip.toLowerCase();
  if (v === '::1' || v === '::') return true;
  if (v.startsWith('::ffff:')) return isPrivateAddress(v.slice(7));
  return v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe8') || v.startsWith('fe9') || v.startsWith('fea') || v.startsWith('feb') || v.startsWith('ff');
}

const sniff = (b: Buffer): string | null => {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (b.length >= 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  if (b.length >= 12 && b.toString('ascii', 4, 8) === 'ftyp') {
    const brand = b.toString('ascii', 8, 12);
    if (brand === 'avif' || brand === 'avis') return 'image/avif';
    if (brand === 'qt  ') return 'video/quicktime';
    return 'video/mp4';
  }
  return null;
};
export const sniffMediaType = sniff;

export interface FetchRemoteMediaOptions {
  maxBytes: number;
  timeoutMs?: number;
  /** Test seam. */
  fetchImpl?: typeof fetch;
  lookup?: (host: string) => Promise<string[]>;
}

async function defaultLookup(host: string): Promise<string[]> {
  const res = await dns.promises.lookup(host, { all: true });
  return res.map((r) => r.address);
}

/**
 * Download a provider-generated file so it can be signed. The URL comes from an AI provider's response, not from
 * the user, but we still only follow https (redirects re-checked), refuse private / loopback targets, cap the size and trust the file's
 * bytes (not the Content-Type header) to decide the format.
 */
export async function fetchRemoteMedia(url: string, opts: FetchRemoteMediaOptions): Promise<{ buffer: Buffer; mimeType: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 20_000);
  try {
    let current = url;
    for (let hop = 0; hop <= 3; hop += 1) {
      const parsed = await assertPublicHttps(current, opts);
      const res = await (opts.fetchImpl ?? fetch)(parsed.toString(), { signal: controller.signal, redirect: 'manual' });
      if (res.status >= 300 && res.status < 400) {
        const next = res.headers.get('location');
        if (!next) throw new RemoteMediaError('media redirect without location');
        current = new URL(next, parsed).toString(); // every hop is re-validated above
        continue;
      }
      if (!res.ok) throw new RemoteMediaError(`media download failed (${res.status})`);
      const declared = Number(res.headers.get('content-length') ?? 0);
      if (declared > opts.maxBytes) throw new RemoteMediaError('media is too large to sign');
      const buffer = Buffer.from(await res.arrayBuffer());
      if (buffer.length > opts.maxBytes) throw new RemoteMediaError('media is too large to sign');
      const mimeType = sniff(buffer);
      if (!mimeType || !SIGNABLE_MEDIA[mimeType]) throw new RemoteMediaError('media format cannot carry a C2PA manifest');
      return { buffer, mimeType };
    }
    throw new RemoteMediaError('too many redirects');
  } catch (err) {
    if (err instanceof RemoteMediaError) throw err;
    throw new RemoteMediaError(`media download failed (${err instanceof Error ? err.name : 'error'})`);
  } finally {
    clearTimeout(timer);
  }
}

async function assertPublicHttps(url: string, opts: FetchRemoteMediaOptions): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new RemoteMediaError('invalid media url');
  }
  if (parsed.protocol !== 'https:') throw new RemoteMediaError('media url must be https');
  const host = parsed.hostname.replace(/^\[|\]$/g, '');
  const addresses = net.isIP(host) ? [host] : await (opts.lookup ?? defaultLookup)(host).catch(() => [] as string[]);
  if (!addresses.length) throw new RemoteMediaError('media host does not resolve');
  if (addresses.some(isPrivateAddress)) throw new RemoteMediaError('media host is not public');
  return parsed;
}
