import { C2paEngine, C2paSignRequest, DIGITAL_SOURCE_TRAINED_ALGORITHMIC_MEDIA } from './c2pa-engine';
import { loadProvenanceConfig } from './provenance.config';
import { ProvenanceService } from './provenance.service';
import { body, fixture } from './test-fixtures';
import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs';

/** Fake engine: "signs" by appending a marker, so the service logic is tested without the native binary. */
class FakeEngine implements C2paEngine {
  calls: C2paSignRequest[] = [];
  reason: string | null = null;
  failWith?: Error;
  unavailableReason() { return this.reason; }
  async sign(req: C2paSignRequest) {
    this.calls.push(req);
    if (this.failWith) throw this.failWith;
    return Buffer.concat([req.buffer, Buffer.from('::C2PA::')]);
  }
  async read(buffer: Buffer) {
    const has = buffer.toString('latin1').endsWith('::C2PA::');
    return {
      hasManifest: has,
      validationErrors: has ? ['signingCredential.untrusted'] : [],
      activeManifest: has ? { claim_generator_info: [{ name: 'ContentFlow' }], signature_info: { issuer: 'X' }, assertions: [{ label: 'c2pa.actions.v2', data: { actions: [{ action: 'c2pa.created', digitalSourceType: DIGITAL_SOURCE_TRAINED_ALGORITHMIC_MEDIA }] } }] } : undefined,
    };
  }
}

describe('C2PA config', () => {
  it('is ON by default for the global edition and OFF for the CN edition', () => {
    expect(loadProvenanceConfig({ MARKET_REGION: 'global' } as any).enabled).toBe(true);
    expect(loadProvenanceConfig({ MARKET_REGION: 'cn' } as any).enabled).toBe(false);
    expect(loadProvenanceConfig({} as any).enabled).toBe(false);
  });
  it('C2PA_ENABLED overrides the default in both directions', () => {
    expect(loadProvenanceConfig({ MARKET_REGION: 'global', C2PA_ENABLED: 'false' } as any).enabled).toBe(false);
    expect(loadProvenanceConfig({ MARKET_REGION: 'global', C2PA_ENABLED: '0' } as any).enabled).toBe(false);
    expect(loadProvenanceConfig({ MARKET_REGION: 'cn', C2PA_ENABLED: 'true' } as any).enabled).toBe(true);
    expect(loadProvenanceConfig({ MARKET_REGION: 'global', C2PA_ENABLED: 'garbage' } as any).enabled).toBe(true);
  });
  it('ephemeral certificates are allowed outside production only, unless explicitly set', () => {
    expect(loadProvenanceConfig({ NODE_ENV: 'development' } as any).allowEphemeral).toBe(true);
    expect(loadProvenanceConfig({ NODE_ENV: 'production' } as any).allowEphemeral).toBe(false);
    expect(loadProvenanceConfig({ NODE_ENV: 'production', C2PA_ALLOW_EPHEMERAL: '1' } as any).allowEphemeral).toBe(true);
  });
  it('reads the signing key only from server config, not from a client-bundled name', () => {
    const cfg = loadProvenanceConfig({ NEXT_PUBLIC_C2PA_SIGNING_KEY: 'client-secret', C2PA_SIGNING_KEY: 'server-key' } as any);
    expect(cfg.keyPem).toBe('server-key');
    expect(JSON.stringify(cfg)).not.toContain('client-secret');
  });
  it('accepts PEMs with escaped newlines, falls back to es256 for an unknown algorithm', () => {
    const cfg = loadProvenanceConfig({ C2PA_SIGNING_CERT: 'A\\nB', C2PA_SIGNING_KEY: 'K\\nL', C2PA_SIGNING_ALG: 'nope' } as any);
    expect(cfg.certPem).toBe('A\nB');
    expect(cfg.keyPem).toBe('K\nL');
    expect(cfg.alg).toBe('es256');
  });
});

describe('ProvenanceService', () => {
  const saved = { ...process.env };
  let engine: FakeEngine;
  let svc: ProvenanceService;
  let dir: string;
  const realFetch = global.fetch;

  const mockDownload = (bytes: Buffer, status = 200) => {
    global.fetch = jest.fn(async () => new Response(body(bytes), { status, headers: { 'content-type': 'application/octet-stream' } })) as any;
  };

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-prov-'));
    process.env = { ...saved, MARKET_REGION: 'global', NODE_ENV: 'test', MEDIA_STORE_DIR: dir };
    delete process.env.C2PA_ENABLED;
    delete process.env.C2PA_SIGNING_CERT;
    delete process.env.C2PA_SIGNING_KEY;
    delete process.env.C2PA_SIGNING_CERT_FILE;
    delete process.env.C2PA_SIGNING_KEY_FILE;
    delete process.env.C2PA_ALLOW_EPHEMERAL;
    delete process.env.MEDIA_PUBLIC_BASE_URL;
    engine = new FakeEngine();
    svc = new ProvenanceService(engine);
    jest.spyOn((svc as any).logger, 'error').mockImplementation(() => undefined);
    jest.spyOn((svc as any).logger, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => {
    process.env = { ...saved };
    global.fetch = realFetch;
    fs.rmSync(dir, { recursive: true, force: true });
    jest.restoreAllMocks();
  });

  const IMG = 'https://93.184.216.34/a.png';

  it('signs a generated image with the AI digital-source-type, stores it, and points url at the signed copy', async () => {
    mockDownload(fixture('image/png'));
    const out = await svc.attachToGeneratedMedia({ url: IMG, model: 'm' }, { mediaType: 'image', model: 'm', provider: 'fal' });
    expect(out.c2pa).toMatchObject({ standard: 'C2PA', signed: true, digitalSourceType: DIGITAL_SOURCE_TRAINED_ALGORITHMIC_MEDIA, signer: 'ephemeral-dev' });
    expect(out.providerUrl).toBe(IMG);
    expect(out.url).toMatch(/^\/api\/v1\/ai\/media\/[a-f0-9]{32}\.png$/);
    const req = engine.calls[0];
    expect(req.mimeType).toBe('image/png');
    expect(req.digitalSourceType).toBe(DIGITAL_SOURCE_TRAINED_ALGORITHMIC_MEDIA);
    expect(JSON.stringify(req.manifest)).toMatch(/org\.contentflow\.ai-disclosure/);
    expect(JSON.stringify(req.manifest)).toMatch(/\[This content was generated by AI\]/);
    const stored = await svc.mediaStore().get(out.url!.split('/').pop()!);
    expect(stored?.buffer.toString('latin1').endsWith('::C2PA::')).toBe(true);
    expect(stored?.mimeType).toBe('image/png');
  });

  it('uses MEDIA_PUBLIC_BASE_URL when set', async () => {
    process.env.MEDIA_PUBLIC_BASE_URL = 'https://api.example.com/';
    mockDownload(fixture('image/jpeg'));
    const out = await svc.attachToGeneratedMedia({ url: IMG }, { mediaType: 'image' });
    expect(out.url).toMatch(/^https:\/\/api\.example\.com\/api\/v1\/ai\/media\/[a-f0-9]{32}\.jpg$/);
  });

  it('signs video the same way (mp4)', async () => {
    mockDownload(fixture('video/mp4'));
    const out = await svc.attachToGeneratedMedia({ url: 'https://93.184.216.34/v.mp4' }, { mediaType: 'video', model: 'v' });
    expect(out.c2pa?.signed).toBe(true);
    expect(out.url).toMatch(/\.mp4$/);
    expect(engine.calls[0].mimeType).toBe('video/mp4');
  });

  it('does nothing when disabled (CN edition default, or C2PA_ENABLED=false)', async () => {
    process.env.MARKET_REGION = 'cn';
    const r = { url: IMG };
    expect(await svc.attachToGeneratedMedia(r, { mediaType: 'image' })).toBe(r);
    process.env.MARKET_REGION = 'global';
    process.env.C2PA_ENABLED = 'false';
    expect(await svc.attachToGeneratedMedia(r, { mediaType: 'image' })).toBe(r);
    expect(engine.calls).toHaveLength(0);
  });

  it('production without a configured key: returns the original url, c2pa.signed=false, logs once', async () => {
    process.env.NODE_ENV = 'production';
    mockDownload(fixture('image/png'));
    const a = await svc.attachToGeneratedMedia({ url: IMG }, { mediaType: 'image' });
    const b = await svc.attachToGeneratedMedia({ url: IMG }, { mediaType: 'image' });
    expect(a.url).toBe(IMG);
    expect(a.c2pa).toMatchObject({ signed: false, reason: expect.stringMatching(/no C2PA signing certificate/) });
    expect(b.c2pa?.signed).toBe(false);
    expect((svc as any).logger.error).toHaveBeenCalledTimes(1);
    expect(svc.status()).toMatchObject({ enabled: true, signer: 'none' });
  });

  it('uses the configured certificate and key (inline or from files), never the ephemeral one', async () => {
    mockDownload(fixture('image/png'));
    const keyFile = path.join(dir, 'k.pem');
    fs.writeFileSync(keyFile, 'KEYFROMFILE');
    process.env.C2PA_SIGNING_CERT = 'CERT\\nCHAIN';
    process.env.C2PA_SIGNING_KEY_FILE = keyFile;
    process.env.C2PA_SIGNING_ALG = 'ps256';
    process.env.C2PA_TSA_URL = 'https://tsa.example.com';
    const out = await svc.attachToGeneratedMedia({ url: IMG }, { mediaType: 'image' });
    expect(out.c2pa).toMatchObject({ signed: true, signer: 'configured' });
    const req = engine.calls[0];
    expect(req.certChainPem.toString()).toBe('CERT\nCHAIN');
    expect(req.privateKeyPem.toString()).toBe('KEYFROMFILE');
    expect(req.alg).toBe('ps256');
    expect(req.tsaUrl).toBe('https://tsa.example.com');
    expect(svc.status().signer).toBe('configured');
  });

  it('fails open and says why when the engine is unavailable or throws; never leaks the key', async () => {
    mockDownload(fixture('image/png'));
    engine.reason = '@contentauth/c2pa-node could not be loaded (musl)';
    const a = await svc.attachToGeneratedMedia({ url: IMG }, { mediaType: 'image' });
    expect(a.url).toBe(IMG);
    expect(a.c2pa).toMatchObject({ signed: false, reason: expect.stringMatching(/could not be loaded/) });
    engine.reason = null;
    engine.failWith = new Error('boom');
    const b = await svc.attachToGeneratedMedia({ url: IMG }, { mediaType: 'image' });
    expect(b.c2pa).toMatchObject({ signed: false, reason: 'boom' });
    expect(JSON.stringify(b)).not.toMatch(/PRIVATE KEY/);
  });

  it('fails open on download problems: private host, http, wrong format, too large, no url', async () => {
    const cases: Array<[string | undefined, RegExp]> = [
      ['https://10.0.0.5/a.png', /not public/],
      ['https://127.0.0.1/a.png', /not public/],
      ['http://93.184.216.34/a.png', /must be https/],
      [undefined, /no media url/],
    ];
    for (const [url, re] of cases) {
      const out = await svc.attachToGeneratedMedia({ url }, { mediaType: 'image' });
      expect(out.c2pa).toMatchObject({ signed: false, reason: expect.stringMatching(re) });
    }
    mockDownload(Buffer.from('<html>not an image</html>'));
    expect((await svc.attachToGeneratedMedia({ url: IMG }, { mediaType: 'image' })).c2pa?.reason).toMatch(/cannot carry/);
    process.env.C2PA_MAX_MEDIA_BYTES = '10';
    mockDownload(fixture('image/png'));
    expect((await svc.attachToGeneratedMedia({ url: IMG }, { mediaType: 'image' })).c2pa?.reason).toMatch(/too large/);
    expect(engine.calls).toHaveLength(0);
  });

  it('refuses to sign a video as an image (kind mismatch) and unsupported types', async () => {
    await expect(svc.signMedia({ buffer: fixture('video/mp4'), mimeType: 'video/mp4', context: { mediaType: 'image' } })).rejects.toThrow(/expected image/);
    await expect(svc.signMedia({ buffer: Buffer.from('x'), mimeType: 'text/plain', context: { mediaType: 'image' } })).rejects.toThrow(/cannot carry/);
  });

  it('verify(): reports AI-generated and valid, ignoring only the untrusted-signer code', async () => {
    const signed = await svc.signMedia({ buffer: fixture('image/png'), mimeType: 'image/png', context: { mediaType: 'image' } });
    expect(await svc.verify(signed.buffer, 'image/png')).toMatchObject({ hasManifest: true, valid: true, aiGenerated: true, claimGenerator: 'ContentFlow' });
    expect(await svc.verify(fixture('image/png'), 'image/png')).toMatchObject({ hasManifest: false, aiGenerated: false });
  });

  it('startup logs: error when the engine is unavailable, warning for the ephemeral dev cert, silent when disabled', () => {
    engine.reason = 'no binary';
    svc.onModuleInit();
    expect((svc as any).logger.error).toHaveBeenCalledWith(expect.stringContaining('no binary'));
    engine.reason = null;
    svc.onModuleInit();
    expect((svc as any).logger.warn).toHaveBeenCalledWith(expect.stringContaining('ephemeral'));
    process.env.C2PA_ENABLED = 'false';
    (svc as any).logger.error.mockClear();
    (svc as any).logger.warn.mockClear();
    svc.onModuleInit();
    expect((svc as any).logger.error).not.toHaveBeenCalled();
    expect((svc as any).logger.warn).not.toHaveBeenCalled();
  });
});
