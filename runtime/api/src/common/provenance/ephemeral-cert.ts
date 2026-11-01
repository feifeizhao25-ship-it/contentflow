import { createHash, generateKeyPairSync, KeyObject, randomBytes, sign } from 'node:crypto';

/**
 * Development-only signing identity, generated at runtime (never written to disk, never committed).
 *
 * C2PA requires a certificate chain with a specific profile: a CA that may sign certificates and a leaf with
 * digitalSignature key usage and an extended key usage (document signing / e-mail protection). We build both with
 * node:crypto and a tiny DER encoder (no extra dependency) so the real c2pa library accepts the chain. Manifests
 * signed with it carry a valid signature but the signer is **not on any C2PA trust list**, so verifiers show
 * "unknown signer" — exactly what a dev / test run should look like. Production must provide
 * C2PA_SIGNING_CERT / C2PA_SIGNING_KEY.
 */
export interface SigningIdentity {
  certChainPem: string;
  privateKeyPem: string;
  alg: 'es256';
}

let cached: Promise<SigningIdentity> | undefined;

export function getEphemeralSigningIdentity(): Promise<SigningIdentity> {
  if (!cached) cached = Promise.resolve().then(generate);
  return cached;
}

/** Test helper. */
export function resetEphemeralSigningIdentity(): void {
  cached = undefined;
}

// ---- minimal DER ----------------------------------------------------------------------------------------------
const len = (n: number): Buffer => {
  if (n < 0x80) return Buffer.from([n]);
  const bytes: number[] = [];
  for (let v = n; v > 0; v = Math.floor(v / 256)) bytes.unshift(v & 0xff);
  return Buffer.from([0x80 | bytes.length, ...bytes]);
};
const tlv = (tag: number, ...parts: Buffer[]): Buffer => {
  const body = Buffer.concat(parts);
  return Buffer.concat([Buffer.from([tag]), len(body.length), body]);
};
const seq = (...p: Buffer[]) => tlv(0x30, ...p);
const set = (...p: Buffer[]) => tlv(0x31, ...p);
const octets = (b: Buffer) => tlv(0x04, b);
const bool = (v: boolean) => tlv(0x01, Buffer.from([v ? 0xff : 0x00]));
const int = (b: Buffer) => tlv(0x02, b[0] & 0x80 ? Buffer.concat([Buffer.from([0]), b]) : b);
const smallInt = (n: number) => int(Buffer.from([n]));
const utf8 = (s: string) => tlv(0x0c, Buffer.from(s, 'utf8'));
const bits = (b: Buffer, unused = 0) => tlv(0x03, Buffer.from([unused]), b);
const oid = (dotted: string): Buffer => {
  const n = dotted.split('.').map(Number);
  const out: number[] = [n[0] * 40 + n[1]];
  for (const v of n.slice(2)) {
    const chunk = [v & 0x7f];
    for (let x = v >> 7; x > 0; x >>= 7) chunk.unshift((x & 0x7f) | 0x80);
    out.push(...chunk);
  }
  return tlv(0x06, Buffer.from(out));
};
const utcTime = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, '0');
  return tlv(0x17, Buffer.from(`${p(d.getUTCFullYear() % 100)}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`));
};
const ctx = (n: number, ...p: Buffer[]) => tlv(0xa0 | n, ...p);

const OID = {
  ecdsaSha256: '1.2.840.10045.4.3.2',
  commonName: '2.5.4.3',
  org: '2.5.4.10',
  basicConstraints: '2.5.29.19',
  keyUsage: '2.5.29.15',
  extKeyUsage: '2.5.29.37',
  subjectKeyId: '2.5.29.14',
  authorityKeyId: '2.5.29.35',
  emailProtection: '1.3.6.1.5.5.7.3.4',
  documentSigning: '1.3.6.1.5.5.7.3.36',
};

const name = (cn: string) => seq(set(seq(oid(OID.org), utf8('ContentFlow'))), set(seq(oid(OID.commonName), utf8(cn))));
const ext = (id: string, critical: boolean, value: Buffer) => seq(oid(id), ...(critical ? [bool(true)] : []), octets(value));
const keyId = (pub: KeyObject): Buffer => {
  // SubjectKeyIdentifier = SHA-1 of the subjectPublicKey bits; any stable 20-byte digest is acceptable for a dev cert.
  const spki = pub.export({ type: 'spki', format: 'der' });
  return createHash('sha1').update(spki).digest();
};

function certificate(opts: { subjectCn: string; issuerCn: string; subjectPub: KeyObject; issuerPub: KeyObject; issuerKey: KeyObject; ca: boolean; notBefore: Date; notAfter: Date }): Buffer {
  const sigAlg = seq(oid(OID.ecdsaSha256));
  const extensions: Buffer[] = [
    opts.ca
      ? ext(OID.basicConstraints, true, seq(bool(true), smallInt(0)))
      : ext(OID.basicConstraints, true, seq()),
    // keyUsage BIT STRING: keyCertSign(5)+cRLSign(6) = 0x06 (1 unused bit) for the CA; digitalSignature(0) = 0x80 for the leaf.
    ext(OID.keyUsage, true, opts.ca ? bits(Buffer.from([0x06]), 1) : bits(Buffer.from([0x80]), 7)),
    ...(opts.ca ? [] : [ext(OID.extKeyUsage, false, seq(oid(OID.emailProtection), oid(OID.documentSigning)))]),
    ext(OID.subjectKeyId, false, octets(keyId(opts.subjectPub))),
    ...(opts.ca ? [] : [ext(OID.authorityKeyId, false, seq(tlv(0x80, keyId(opts.issuerPub))))]),
  ];
  const serial = Buffer.concat([Buffer.from([0x01]), randomBytes(8)]);
  const tbs = seq(
    ctx(0, smallInt(2)), // v3
    int(serial),
    sigAlg,
    name(opts.issuerCn),
    seq(utcTime(opts.notBefore), utcTime(opts.notAfter)),
    name(opts.subjectCn),
    Buffer.from(opts.subjectPub.export({ type: 'spki', format: 'der' })),
    ctx(3, seq(...extensions)),
  );
  const signature = sign('sha256', tbs, { key: opts.issuerKey, dsaEncoding: 'der' });
  return seq(tbs, sigAlg, bits(signature));
}

const pem = (label: string, der: Buffer) => `-----BEGIN ${label}-----\n${der.toString('base64').match(/.{1,64}/g)!.join('\n')}\n-----END ${label}-----\n`;

function generate(): SigningIdentity {
  const ca = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const leaf = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const now = Date.now();
  const notBefore = new Date(now - 5 * 60_000);
  const notAfter = new Date(now + 30 * 86_400_000);
  const caCn = 'ContentFlow DEV C2PA CA (ephemeral - not for production)';
  const caDer = certificate({ subjectCn: caCn, issuerCn: caCn, subjectPub: ca.publicKey, issuerPub: ca.publicKey, issuerKey: ca.privateKey, ca: true, notBefore, notAfter });
  const leafDer = certificate({
    subjectCn: 'ContentFlow DEV C2PA Signer (ephemeral - not for production)',
    issuerCn: caCn,
    subjectPub: leaf.publicKey,
    issuerPub: ca.publicKey,
    issuerKey: ca.privateKey,
    ca: false,
    notBefore,
    notAfter,
  });
  return {
    certChainPem: pem('CERTIFICATE', leafDer) + pem('CERTIFICATE', caDer),
    privateKeyPem: leaf.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    alg: 'es256',
  };
}
