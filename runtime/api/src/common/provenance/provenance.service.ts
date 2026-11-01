import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import { Inject, Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { aiTextLabel } from '../ai-content-label';
import {
  C2PA_ENGINE,
  C2paEngine,
  C2paReadResult,
  DIGITAL_SOURCE_TRAINED_ALGORITHMIC_MEDIA,
  NodeC2paEngine,
  errorMessage,
} from './c2pa-engine';
import { getEphemeralSigningIdentity } from './ephemeral-cert';
import { MediaStore, SIGNABLE_MEDIA } from './media-store';
import { fetchRemoteMedia, RemoteMediaError } from './remote-media';
import { loadProvenanceConfig, ProvenanceConfig } from './provenance.config';

export type MediaKind = 'image' | 'video';

export interface GeneratedMediaContext {
  mediaType: MediaKind;
  model?: string;
  provider?: string;
}

/** What the API tells the client about the credential (returned next to `aiGenerated` / `aiLabel`). */
export interface C2paDisclosure {
  standard: 'C2PA';
  signed: boolean;
  digitalSourceType?: string;
  /** `configured` = production certificate; `ephemeral-dev` = throw-away dev certificate (not trusted by verifiers). */
  signer?: 'configured' | 'ephemeral-dev';
  manifestInstanceId?: string;
  reason?: string;
}

export interface SignedMedia {
  buffer: Buffer;
  mimeType: string;
  signer: 'configured' | 'ephemeral-dev';
  manifestInstanceId: string;
}

export interface VerificationResult {
  hasManifest: boolean;
  /** Cryptographically valid (signature + hashes). Says nothing about whether the signer is on a trust list. */
  valid: boolean;
  aiGenerated: boolean;
  digitalSourceType?: string;
  claimGenerator?: string;
  signer?: string;
  errors: string[];
}

/** The credential is cryptographically sound even when the (dev / private) signer is not on a trust list. */
const IGNORABLE_VALIDATION_CODES = new Set(['signingCredential.untrusted']);

@Injectable()
export class ProvenanceService implements OnModuleInit {
  private readonly logger = new Logger(ProvenanceService.name);
  private readonly engine: C2paEngine;
  private store?: MediaStore;
  private storeDir?: string;
  private readonly warned = new Set<string>();

  constructor(@Optional() @Inject(C2PA_ENGINE) engine?: C2paEngine) {
    this.engine = engine ?? new NodeC2paEngine();
  }

  config(): ProvenanceConfig {
    return loadProvenanceConfig();
  }

  isEnabled(): boolean {
    return this.config().enabled;
  }

  /** Lazily built so a changed MEDIA_STORE_DIR (tests) is honoured. */
  mediaStore(): MediaStore {
    const cfg = this.config();
    if (!this.store || this.storeDir !== cfg.mediaDir) {
      this.store = new MediaStore(cfg.mediaDir, cfg.mediaTtlDays);
      this.storeDir = cfg.mediaDir;
    }
    return this.store;
  }

  onModuleInit(): void {
    const cfg = this.config();
    if (!cfg.enabled) return;
    const problem = this.engine.unavailableReason();
    if (problem) {
      this.logger.error(`C2PA 已启用，但签名引擎不可用，生成的图片/视频将不带 Content Credentials：${problem}`);
      return;
    }
    if (!this.hasConfiguredKey(cfg)) {
      if (cfg.allowEphemeral) this.logger.warn('C2PA signing key not configured: using an ephemeral self-signed DEV certificate. Set C2PA_SIGNING_CERT / C2PA_SIGNING_KEY before going live.');
      else this.logger.error('C2PA is enabled but no signing certificate is configured (C2PA_SIGNING_CERT / C2PA_SIGNING_KEY) and ephemeral certs are not allowed: generated media will be returned WITHOUT Content Credentials.');
    }
  }

  /** Non-secret status for health / diagnostics. */
  status(): { enabled: boolean; engine: 'ok' | 'unavailable'; engineReason?: string; signer: 'configured' | 'ephemeral-dev' | 'none' } {
    const cfg = this.config();
    const reason = this.engine.unavailableReason();
    return {
      enabled: cfg.enabled,
      engine: reason ? 'unavailable' : 'ok',
      ...(reason ? { engineReason: reason } : {}),
      signer: this.hasConfiguredKey(cfg) ? 'configured' : cfg.allowEphemeral ? 'ephemeral-dev' : 'none',
    };
  }

  private hasConfiguredKey(cfg: ProvenanceConfig): boolean {
    return Boolean((cfg.certPem || cfg.certFile) && (cfg.keyPem || cfg.keyFile));
  }

  private async resolveSigner(cfg: ProvenanceConfig): Promise<{ certChainPem: Buffer; privateKeyPem: Buffer; alg: ProvenanceConfig['alg']; signer: 'configured' | 'ephemeral-dev' }> {
    if (this.hasConfiguredKey(cfg)) {
      const cert = cfg.certPem ?? (await fs.promises.readFile(cfg.certFile!, 'utf8'));
      const key = cfg.keyPem ?? (await fs.promises.readFile(cfg.keyFile!, 'utf8'));
      return { certChainPem: Buffer.from(cert), privateKeyPem: Buffer.from(key), alg: cfg.alg, signer: 'configured' };
    }
    if (!cfg.allowEphemeral) throw new Error('no C2PA signing certificate configured');
    const id = await getEphemeralSigningIdentity();
    return { certChainPem: Buffer.from(id.certChainPem), privateKeyPem: Buffer.from(id.privateKeyPem), alg: id.alg, signer: 'ephemeral-dev' };
  }

  /** Embed a signed C2PA manifest ("this was created by a generative AI model") in the file. */
  async signMedia(input: { buffer: Buffer; mimeType: string; context: GeneratedMediaContext }): Promise<SignedMedia> {
    const cfg = this.config();
    const spec = SIGNABLE_MEDIA[input.mimeType];
    if (!spec) throw new Error(`media type ${input.mimeType} cannot carry a C2PA manifest`);
    if (spec.kind !== input.context.mediaType) throw new Error(`file is ${spec.kind}, expected ${input.context.mediaType}`);
    if (input.buffer.length > cfg.maxMediaBytes) throw new Error('media is too large to sign');
    const reason = this.engine.unavailableReason();
    if (reason) throw new Error(reason);

    const signer = await this.resolveSigner(cfg);
    const instanceId = `xmp:iid:${randomUUID()}`;
    const generatedAt = new Date().toISOString();
    const manifest: Record<string, unknown> = {
      claim_generator_info: [{ name: cfg.claimGenerator, version: '1.0' }],
      title: `generated-${spec.kind}.${spec.ext}`,
      format: input.mimeType,
      instance_id: instanceId,
      assertions: [
        {
          // Our own, human-readable companion to the standard digital-source-type: same wording as the visible label.
          label: 'org.contentflow.ai-disclosure',
          data: {
            ai_generated: true,
            label: aiTextLabel(),
            media_type: input.context.mediaType,
            ...(input.context.model ? { model: input.context.model } : {}),
            ...(input.context.provider ? { provider: input.context.provider } : {}),
            generated_at: generatedAt,
            regulation: 'EU AI Act Art. 50(2)',
          },
        },
      ],
    };
    const signed = await this.engine.sign({
      buffer: input.buffer,
      mimeType: input.mimeType,
      manifest,
      digitalSourceType: DIGITAL_SOURCE_TRAINED_ALGORITHMIC_MEDIA,
      certChainPem: signer.certChainPem,
      privateKeyPem: signer.privateKeyPem,
      alg: signer.alg,
      tsaUrl: cfg.tsaUrl,
    });
    return { buffer: signed, mimeType: input.mimeType, signer: signer.signer, manifestInstanceId: instanceId };
  }

  /**
   * Take a freshly generated `{ url, … }` result, download the file, sign it, store it and point `url` at the signed copy.
   * The original provider URL is kept as `providerUrl`. Never throws: a failure leaves the result untouched and says why
   * in `c2pa.reason` — the visible label and the text marker are unaffected either way.
   */
  async attachToGeneratedMedia<T extends { url?: string }>(
    result: T,
    context: GeneratedMediaContext,
  ): Promise<T & { providerUrl?: string; c2pa?: C2paDisclosure }> {
    const cfg = this.config();
    if (!cfg.enabled) return result;
    const url = typeof result?.url === 'string' ? result.url : '';
    try {
      if (!url) throw new Error('no media url to sign');
      const remote = await fetchRemoteMedia(url, { maxBytes: cfg.maxMediaBytes });
      const signed = await this.signMedia({ buffer: remote.buffer, mimeType: remote.mimeType, context });
      const stored = await this.mediaStore().put(signed.buffer, signed.mimeType);
      const path = `/api/v1/ai/media/${stored.file}`;
      return {
        ...result,
        url: `${cfg.mediaPublicBase}${path}`,
        providerUrl: url,
        c2pa: {
          standard: 'C2PA',
          signed: true,
          digitalSourceType: DIGITAL_SOURCE_TRAINED_ALGORITHMIC_MEDIA,
          signer: signed.signer,
          manifestInstanceId: signed.manifestInstanceId,
        },
      };
    } catch (err) {
      const reason = errorMessage(err) || 'signing failed';
      // Log each distinct failure once per process so a broken key does not flood the logs.
      if (!this.warned.has(reason)) {
        this.warned.add(reason);
        this.logger.error(`C2PA signing skipped for generated ${context.mediaType}: ${reason}`);
      }
      return { ...result, c2pa: { standard: 'C2PA', signed: false, reason } };
    }
  }

  /** Read the credential back (used by tests and the support tooling; verifies hashes + signature, not trust). */
  async verify(buffer: Buffer, mimeType: string): Promise<VerificationResult> {
    const read: C2paReadResult = await this.engine.read(buffer, mimeType);
    if (!read.hasManifest) return { hasManifest: false, valid: false, aiGenerated: false, errors: [] };
    const errors = read.validationErrors.filter((e) => !IGNORABLE_VALIDATION_CODES.has(e));
    const assertions: any[] = read.activeManifest?.assertions ?? [];
    const actions = assertions.filter((a) => /^c2pa\.actions/.test(String(a?.label)));
    const types = actions.flatMap((a) => (a?.data?.actions ?? []).map((x: any) => x?.digitalSourceType)).filter(Boolean);
    const digitalSourceType = types.find((t: string) => t === DIGITAL_SOURCE_TRAINED_ALGORITHMIC_MEDIA) ?? types[0];
    return {
      hasManifest: true,
      valid: errors.length === 0,
      aiGenerated: digitalSourceType === DIGITAL_SOURCE_TRAINED_ALGORITHMIC_MEDIA,
      digitalSourceType,
      claimGenerator: read.activeManifest?.claim_generator_info?.[0]?.name,
      signer: read.activeManifest?.signature_info?.issuer,
      errors,
    };
  }
}
