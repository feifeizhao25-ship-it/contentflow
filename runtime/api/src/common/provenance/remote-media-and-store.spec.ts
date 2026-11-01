import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { MediaStore } from './media-store';
import { fetchRemoteMedia, isPrivateAddress, RemoteMediaError, sniffMediaType } from './remote-media';
import { body, fixture } from './test-fixtures';

describe('isPrivateAddress', () => {
  it.each(['127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', 'fd00::1', 'fe80::1', '::ffff:10.0.0.1'])('%s is private', (ip) => {
    expect(isPrivateAddress(ip)).toBe(true);
  });
  it.each(['8.8.8.8', '93.184.216.34', '172.32.0.1', '2606:4700:4700::1111'])('%s is public', (ip) => {
    expect(isPrivateAddress(ip)).toBe(false);
  });
});

describe('sniffMediaType', () => {
  it.each(['image/jpeg', 'image/png', 'image/webp', 'video/mp4'])('recognises %s from its bytes', (mime) => {
    expect(sniffMediaType(fixture(mime))).toBe(mime);
  });
  it('rejects html / svg / empty', () => {
    expect(sniffMediaType(Buffer.from('<svg></svg>'))).toBeNull();
    expect(sniffMediaType(Buffer.alloc(0))).toBeNull();
  });
});

describe('fetchRemoteMedia', () => {
  const opts = (fetchImpl: any, extra: object = {}) => ({ maxBytes: 1000, fetchImpl, lookup: async () => ['93.184.216.34'], ...extra });
  const png = fixture('image/png');

  it('downloads a public https image and decides the type from the bytes, not the header', async () => {
    const f = jest.fn(async () => new Response(body(png), { headers: { 'content-type': 'text/html' } }));
    await expect(fetchRemoteMedia('https://cdn.example.com/a', opts(f))).resolves.toMatchObject({ mimeType: 'image/png' });
  });
  it('resolves hostnames and refuses ones that point at private addresses', async () => {
    const f = jest.fn();
    await expect(fetchRemoteMedia('https://evil.example.com/a.png', opts(f, { lookup: async () => ['10.0.0.1'] }))).rejects.toThrow(/not public/);
    await expect(fetchRemoteMedia('https://evil.example.com/a.png', opts(f, { lookup: async () => [] }))).rejects.toThrow(/does not resolve/);
    expect(f).not.toHaveBeenCalled();
  });
  it('re-validates every redirect hop', async () => {
    const f = jest
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: 'https://169.254.169.254/latest/meta-data' } }));
    await expect(fetchRemoteMedia('https://cdn.example.com/a.png', opts(f))).rejects.toThrow(/not public/);
    const ok = jest
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 301, headers: { location: '/b.png' } }))
      .mockResolvedValueOnce(new Response(body(png)));
    await expect(fetchRemoteMedia('https://cdn.example.com/a.png', opts(ok))).resolves.toMatchObject({ mimeType: 'image/png' });
    const loop = jest.fn(async () => new Response(null, { status: 302, headers: { location: '/again' } }));
    await expect(fetchRemoteMedia('https://cdn.example.com/a.png', opts(loop))).rejects.toThrow(/too many redirects/);
  });
  it('enforces the size cap (declared and actual) and http errors', async () => {
    await expect(fetchRemoteMedia('https://cdn.example.com/a.png', opts(async () => new Response(body(png), { headers: { 'content-length': '5000' } })))).rejects.toThrow(/too large/);
    await expect(fetchRemoteMedia('https://cdn.example.com/a.png', opts(async () => new Response(body(png)), { maxBytes: 10 }))).rejects.toThrow(/too large/);
    await expect(fetchRemoteMedia('https://cdn.example.com/a.png', opts(async () => new Response('x', { status: 404 })))).rejects.toThrow(/404/);
    await expect(fetchRemoteMedia('not a url', opts(jest.fn()))).rejects.toBeInstanceOf(RemoteMediaError);
  });
});

describe('MediaStore', () => {
  let dir: string;
  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-store-')); });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('stores under an unguessable name and reads it back with the right type', async () => {
    const store = new MediaStore(dir, 30);
    const a = await store.put(fixture('image/jpeg'), 'image/jpeg');
    const b = await store.put(fixture('image/jpeg'), 'image/jpeg');
    expect(a.file).toMatch(/^[a-f0-9]{32}\.jpg$/);
    expect(a.id).not.toBe(b.id);
    expect(await store.get(a.file)).toMatchObject({ mimeType: 'image/jpeg', buffer: fixture('image/jpeg') });
    expect(fs.readdirSync(dir).filter((n) => n.endsWith('.tmp'))).toHaveLength(0);
  });
  it('rejects path traversal and malformed names', async () => {
    const store = new MediaStore(dir, 30);
    for (const bad of ['../etc/passwd', '..%2f..%2fetc', 'a.png', `${'a'.repeat(32)}.exe`, `${'A'.repeat(32)}.png`, '', `${'a'.repeat(32)}.png/../x`]) {
      expect(await store.get(bad)).toBeNull();
    }
    await expect(store.put(Buffer.from('x'), 'text/html')).rejects.toThrow(/unsupported/);
  });
  it('expires files after the TTL and sweeps them', async () => {
    const store = new MediaStore(dir, 1);
    const a = await store.put(fixture('image/png'), 'image/png');
    const old = new Date(Date.now() - 2 * 86_400_000);
    fs.utimesSync(path.join(dir, a.file), old, old);
    expect(await store.get(a.file)).toBeNull();
    await store.sweep(Date.now() + 7_200_000);
    expect(fs.existsSync(path.join(dir, a.file))).toBe(false);
  });
});
