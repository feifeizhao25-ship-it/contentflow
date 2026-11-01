import { randomBytes } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

/** MIME → file extension for the formats the C2PA library can embed a manifest in. */
export const SIGNABLE_MEDIA: Record<string, { ext: string; kind: 'image' | 'video' }> = {
  'image/jpeg': { ext: 'jpg', kind: 'image' },
  'image/png': { ext: 'png', kind: 'image' },
  'image/webp': { ext: 'webp', kind: 'image' },
  'image/avif': { ext: 'avif', kind: 'image' },
  'video/mp4': { ext: 'mp4', kind: 'video' },
  'video/quicktime': { ext: 'mov', kind: 'video' },
};

const MIME_BY_EXT: Record<string, string> = Object.fromEntries(Object.entries(SIGNABLE_MEDIA).map(([mime, v]) => [v.ext, mime]));
const FILE_RE = /^([a-f0-9]{32})\.(jpg|png|webp|avif|mp4|mov)$/;

export interface StoredMedia {
  id: string;
  file: string;
  mimeType: string;
  bytes: number;
}

/**
 * Minimal on-disk store for signed media. The id is 128 random bits, so a file URL cannot be guessed.
 * Files expire after `ttlDays`. For multi-instance deployments point `MEDIA_STORE_DIR` at a shared volume
 * (or replace this class with an object-storage implementation — the interface is two methods).
 */
export class MediaStore {
  private lastSweep = 0;

  constructor(private readonly dir: string, private readonly ttlDays: number) {}

  async put(buffer: Buffer, mimeType: string): Promise<StoredMedia> {
    const spec = SIGNABLE_MEDIA[mimeType];
    if (!spec) throw new Error(`unsupported media type ${mimeType}`);
    await fs.promises.mkdir(this.dir, { recursive: true });
    const id = randomBytes(16).toString('hex');
    const file = `${id}.${spec.ext}`;
    const tmp = path.join(this.dir, `.${file}.tmp`);
    await fs.promises.writeFile(tmp, buffer, { mode: 0o640 });
    await fs.promises.rename(tmp, path.join(this.dir, file));
    void this.sweep();
    return { id, file, mimeType, bytes: buffer.length };
  }

  /** Returns null for an unknown / expired / malformed file name (no path is ever built from unchecked input). */
  async get(file: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
    const m = FILE_RE.exec(file);
    if (!m) return null;
    try {
      const full = path.join(this.dir, file);
      const stat = await fs.promises.stat(full);
      if (Date.now() - stat.mtimeMs > this.ttlDays * 86_400_000) return null;
      return { buffer: await fs.promises.readFile(full), mimeType: MIME_BY_EXT[m[2]] };
    } catch {
      return null;
    }
  }

  /** Delete expired files; runs at most once an hour and never throws. */
  async sweep(now = Date.now()): Promise<number> {
    if (now - this.lastSweep < 3_600_000) return 0;
    this.lastSweep = now;
    let removed = 0;
    try {
      for (const name of await fs.promises.readdir(this.dir)) {
        if (!FILE_RE.test(name) && !/^\..*\.tmp$/.test(name)) continue;
        const full = path.join(this.dir, name);
        const stat = await fs.promises.stat(full);
        if (now - stat.mtimeMs > this.ttlDays * 86_400_000) {
          await fs.promises.unlink(full);
          removed += 1;
        }
      }
    } catch {
      /* best effort */
    }
    return removed;
  }
}
