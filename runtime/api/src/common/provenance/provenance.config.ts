import * as path from 'node:path';
import { isGlobalMarket } from '../i18n/market-text';

/**
 * C2PA Content Credentials — configuration (environment only, nothing is hard-coded).
 *
 * Why this exists: EU AI Act Art. 50(2) obliges providers of generative systems to mark synthetic
 * image / audio / video output "in a machine-readable format and detectable as artificially generated".
 * C2PA Content Credentials (a signed manifest embedded in the file) is the interoperable way to do it.
 *
 *   C2PA_ENABLED               on/off. Unset ⇒ ON for the global edition (MARKET_REGION=global), OFF for CN.
 *   C2PA_SIGNING_CERT          PEM certificate chain (leaf first). "\n" escapes are accepted. Secret-store only.
 *   C2PA_SIGNING_KEY           PEM PKCS#8 private key matching the leaf. Secret-store only. NEVER commit it.
 *   C2PA_SIGNING_CERT_FILE     …or paths to files (mounted secrets) instead of inline values.
 *   C2PA_SIGNING_KEY_FILE
 *   C2PA_SIGNING_ALG           es256 (default) | es384 | es512 | ps256 | ps384 | ps512 | ed25519
 *   C2PA_TSA_URL               optional RFC 3161 timestamp authority (keeps the credential valid after the cert expires)
 *   C2PA_ALLOW_EPHEMERAL       use a throw-away self-signed cert generated at runtime when no key is configured.
 *                              Unset ⇒ allowed outside NODE_ENV=production only.
 *   MEDIA_STORE_DIR            where signed files are kept (default ./data/generated-media)
 *   MEDIA_STORE_TTL_DAYS       retention of signed files (default 30)
 *   MEDIA_PUBLIC_BASE_URL      absolute origin the signed-file URL is built on (default: relative /api/v1/ai/media/…)
 *   C2PA_MAX_MEDIA_BYTES       refuse to sign larger files (default 25 MiB)
 */

export const C2PA_SIGNING_ALGS = ['es256', 'es384', 'es512', 'ps256', 'ps384', 'ps512', 'ed25519'] as const;
export type C2paSigningAlg = (typeof C2PA_SIGNING_ALGS)[number];

export interface ProvenanceConfig {
  enabled: boolean;
  certPem?: string;
  keyPem?: string;
  certFile?: string;
  keyFile?: string;
  alg: C2paSigningAlg;
  tsaUrl?: string;
  allowEphemeral: boolean;
  mediaDir: string;
  mediaTtlDays: number;
  mediaPublicBase: string;
  maxMediaBytes: number;
  claimGenerator: string;
}

const TRUE = new Set(['1', 'true', 'on', 'yes', 'y']);
const FALSE = new Set(['0', 'false', 'off', 'no', 'n']);

export function parseFlag(raw: string | undefined, fallback: boolean): boolean {
  const v = String(raw ?? '').trim().toLowerCase();
  if (TRUE.has(v)) return true;
  if (FALSE.has(v)) return false;
  return fallback;
}

function unescapePem(raw: string | undefined): string | undefined {
  const v = String(raw ?? '').trim();
  if (!v) return undefined;
  return v.replace(/\\n/g, '\n');
}

function positiveInt(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export function loadProvenanceConfig(env: NodeJS.ProcessEnv = process.env): ProvenanceConfig {
  const algRaw = String(env.C2PA_SIGNING_ALG ?? 'es256').trim().toLowerCase();
  const alg = (C2PA_SIGNING_ALGS as readonly string[]).includes(algRaw) ? (algRaw as C2paSigningAlg) : 'es256';
  return {
    // Default ON for the global edition: Art. 50 applies to what it generates.
    enabled: parseFlag(env.C2PA_ENABLED, isGlobalMarket(env)),
    certPem: unescapePem(env.C2PA_SIGNING_CERT),
    keyPem: unescapePem(env.C2PA_SIGNING_KEY),
    certFile: String(env.C2PA_SIGNING_CERT_FILE ?? '').trim() || undefined,
    keyFile: String(env.C2PA_SIGNING_KEY_FILE ?? '').trim() || undefined,
    alg,
    tsaUrl: String(env.C2PA_TSA_URL ?? '').trim() || undefined,
    allowEphemeral: parseFlag(env.C2PA_ALLOW_EPHEMERAL, env.NODE_ENV !== 'production'),
    mediaDir: String(env.MEDIA_STORE_DIR ?? '').trim() || path.join(process.cwd(), 'data', 'generated-media'),
    mediaTtlDays: positiveInt(env.MEDIA_STORE_TTL_DAYS, 30),
    mediaPublicBase: String(env.MEDIA_PUBLIC_BASE_URL ?? '').trim().replace(/\/+$/, ''),
    maxMediaBytes: positiveInt(env.C2PA_MAX_MEDIA_BYTES, 25 * 1024 * 1024),
    claimGenerator: 'ContentFlow',
  };
}
