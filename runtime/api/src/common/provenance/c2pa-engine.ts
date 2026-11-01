import type { C2paSigningAlg } from './provenance.config';

/** IPTC digital source type for media created by a generative AI model (the C2PA / Art. 50 marker). */
export const DIGITAL_SOURCE_TRAINED_ALGORITHMIC_MEDIA =
  'http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia';

export interface C2paSignRequest {
  buffer: Buffer;
  mimeType: string;
  /** Manifest definition (claim_generator_info, title, assertions …). */
  manifest: Record<string, unknown>;
  digitalSourceType: string;
  certChainPem: Buffer;
  privateKeyPem: Buffer;
  alg: C2paSigningAlg;
  tsaUrl?: string;
}

export interface C2paReadResult {
  /** True when the file carries a C2PA manifest store. */
  hasManifest: boolean;
  /** The active manifest (JSON as produced by the c2pa library), if any. */
  activeManifest?: Record<string, any>;
  /** Validation failures reported by the library (empty ⇒ cryptographically valid). */
  validationErrors: string[];
  /** Raw validation state from the library (e.g. Valid / Trusted / Invalid). */
  validationState?: string;
}

export function errorMessage(err: unknown): string {
  // not `instanceof Error`: errors thrown inside jest's vm context / native addons come from another realm
  const m = (err as { message?: unknown } | null)?.message;
  return String(typeof m === 'string' ? m : err).split('\n')[0];
}

/** The only seam to the native library, so the rest of the code (and the tests) never need the binary. */
export interface C2paEngine {
  /** null ⇒ usable; otherwise the human-readable reason it is not (binary missing, wrong platform …). */
  unavailableReason(): string | null;
  sign(req: C2paSignRequest): Promise<Buffer>;
  read(buffer: Buffer, mimeType: string): Promise<C2paReadResult>;
}

export const C2PA_ENGINE = Symbol('C2PA_ENGINE');

/**
 * Engine backed by `@contentauth/c2pa-node` (MIT licence, Adobe / CAI — the reference Rust SDK).
 * It is an *optional* dependency: it needs Node >= 22 and a glibc Linux (or macOS / Windows) binary, so it is
 * loaded lazily and any failure is reported as "unavailable" instead of crashing the API.
 */
export class NodeC2paEngine implements C2paEngine {
  private mod: any | undefined;
  private loadError: string | null | undefined;

  private load(): any | undefined {
    if (this.mod || this.loadError !== undefined) return this.mod;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      this.mod = require('@contentauth/c2pa-node');
      this.loadError = null;
    } catch (err) {
      this.loadError = `@contentauth/c2pa-node could not be loaded (${errorMessage(err)}); it needs Node >= 22 on glibc Linux`;
    }
    return this.mod;
  }

  unavailableReason(): string | null {
    this.load();
    return this.loadError ?? null;
  }

  async sign(req: C2paSignRequest): Promise<Buffer> {
    const c2pa = this.load();
    if (!c2pa) throw new Error(this.loadError ?? 'c2pa engine unavailable');
    const signer = c2pa.LocalSigner.newSigner(req.certChainPem, req.privateKeyPem, req.alg, req.tsaUrl);
    const builder = await c2pa.Builder.withJsonAsync(req.manifest);
    builder.setIntent({ create: req.digitalSourceType });
    const output: { buffer: Buffer | null } = { buffer: null };
    builder.sign(signer, { buffer: req.buffer, mimeType: req.mimeType }, output);
    if (!output.buffer) throw new Error('c2pa signing produced no output');
    return Buffer.from(output.buffer);
  }

  async read(buffer: Buffer, mimeType: string): Promise<C2paReadResult> {
    const c2pa = this.load();
    if (!c2pa) throw new Error(this.loadError ?? 'c2pa engine unavailable');
    let reader: any;
    try {
      reader = await c2pa.Reader.fromAsset({ buffer, mimeType });
    } catch (err) {
      const msg = errorMessage(err);
      if (/no jumbf|jumbf not found|no c2pa|manifest not found/i.test(msg)) return { hasManifest: false, validationErrors: [] };
      throw err;
    }
    if (!reader) return { hasManifest: false, validationErrors: [] };
    const store = reader.json?.() ?? {};
    const active = reader.getActive?.() ?? undefined;
    const failures: any[] = store?.validation_results?.activeManifest?.failure ?? [];
    return {
      hasManifest: Boolean(active),
      activeManifest: active,
      validationErrors: failures.map((f) => String(f?.code ?? f?.explanation ?? 'invalid')),
      validationState: store?.validation_state,
    };
  }
}
