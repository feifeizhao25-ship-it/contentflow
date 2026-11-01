/**
 * Runs the REAL @contentauth/c2pa-node library through our provenance code and prints one JSON document.
 *
 * Why a separate process: the library is an ES module with a native addon. Node >= 22.12 loads it with require(),
 * but jest's module system cannot, so provenance.real-engine.spec.ts runs this script in plain Node and asserts on
 * the output. Also handy by hand:  npx ts-node -T scripts/c2pa-real-check.ts
 */
import { createPrivateKey } from 'node:crypto';
import { NodeC2paEngine } from '../src/common/provenance/c2pa-engine';
import { getEphemeralSigningIdentity } from '../src/common/provenance/ephemeral-cert';
import { ProvenanceService } from '../src/common/provenance/provenance.service';
import { fixture } from '../src/common/provenance/test-fixtures';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

async function main() {
  const engine = new NodeC2paEngine();
  const reason = engine.unavailableReason();
  if (reason) return { available: false, reason };
  process.env.MARKET_REGION = 'global';
  process.env.NODE_ENV = 'test';
  delete process.env.C2PA_ENABLED;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-c2pa-real-'));
  process.env.MEDIA_STORE_DIR = dir;
  const svc = new ProvenanceService(engine);
  const out: Record<string, any> = { available: true, formats: {} };

  for (const mime of ['image/jpeg', 'image/png', 'image/webp', 'video/mp4']) {
    const kind = mime.startsWith('video') ? 'video' : 'image';
    const original = fixture(mime);
    const before = await svc.verify(original, mime);
    const signed = await svc.signMedia({ buffer: original, mimeType: mime, context: { mediaType: kind, model: 'nano-banana-pro', provider: 'fal' } });
    const after = await svc.verify(signed.buffer, mime);
    const read = await engine.read(signed.buffer, mime);
    const disclosure = read.activeManifest?.assertions?.find((a: any) => a.label === 'org.contentflow.ai-disclosure');
    out.formats[mime] = { before, grew: signed.buffer.length > original.length, after, disclosure: disclosure?.data, rawErrors: read.validationErrors, signer: signed.signer };
  }

  // tampering after signing
  const png = await svc.signMedia({ buffer: fixture('image/png'), mimeType: 'image/png', context: { mediaType: 'image' } });
  const tampered = Buffer.from(png.buffer);
  tampered[20] ^= 0xff;
  out.tampered = await svc.verify(tampered, 'image/png').catch((e) => ({ valid: false, threw: String(e?.message ?? e) }));

  // configured certificate + key (as a CA-issued one would be provided: via env, nothing on disk in the repo)
  const id = await getEphemeralSigningIdentity();
  process.env.C2PA_SIGNING_CERT = id.certChainPem.replace(/\n/g, '\\n');
  process.env.C2PA_SIGNING_KEY = id.privateKeyPem;
  process.env.NODE_ENV = 'production';
  const cfg = await svc.signMedia({ buffer: fixture('image/jpeg'), mimeType: 'image/jpeg', context: { mediaType: 'image' } });
  out.configured = { signer: cfg.signer, verify: await svc.verify(cfg.buffer, 'image/jpeg'), keyType: createPrivateKey(id.privateKeyPem).asymmetricKeyType };
  delete process.env.C2PA_SIGNING_CERT;
  delete process.env.C2PA_SIGNING_KEY;
  process.env.NODE_ENV = 'test';

  // download → sign → store → read the stored bytes
  const realFetch = global.fetch;
  global.fetch = (async () => new Response(new Uint8Array(fixture('image/webp')))) as typeof fetch;
  const attached = await svc.attachToGeneratedMedia({ url: 'https://93.184.216.34/x.webp' }, { mediaType: 'image', model: 'm', provider: 'p' });
  global.fetch = realFetch;
  const stored = attached.url ? await svc.mediaStore().get(attached.url.split('/').pop()!) : null;
  out.attach = { c2pa: attached.c2pa, verify: stored ? await svc.verify(stored.buffer, stored.mimeType) : null };
  fs.rmSync(dir, { recursive: true, force: true });
  return out;
}

main().then(
  (r) => process.stdout.write(`${JSON.stringify(r)}\n`),
  (e) => {
    process.stdout.write(`${JSON.stringify({ available: true, crashed: String(e?.stack ?? e) })}\n`);
    process.exit(1);
  },
);
