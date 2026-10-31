import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import bundled from './data/rule-library.json';
import sourcesConfig from './data/sources.json';
import { Decision, decide } from './live/display';
import { AnnotatedEntry } from './feed';
import { LibEntry, LibState, emptyState } from './live/util';
import type { Snapshots } from './live/freshness';

export const TTL_BY_CATEGORY: Record<string, number> = {};
export interface SourcesConfig {
  allowed_domains: string[];
  manual_hosts: Record<string, string>;
  watch: { id: string; name?: string; publisher?: string; listing_url: string; title_include?: string[]; license_note?: string; category_hint?: string }[];
}
export const sources = (): SourcesConfig => sourcesConfig as SourcesConfig;
export const bundledDoc = (): { entries: LibEntry[]; [k: string]: unknown } => JSON.parse(JSON.stringify(bundled));

/** 预览开关：和 web-cn 的 NEXT_PUBLIC_SHOW_PENDING_LIBRARY 一致，只在审核/预览环境打开。 */
export const showPending = (env: NodeJS.ProcessEnv = process.env): boolean => String(env.LIBRARY_SHOW_PENDING ?? env.NEXT_PUBLIC_SHOW_PENDING_LIBRARY ?? '').toLowerCase() === 'true';

/** 文件存储：条目（审核后的版本）、状态文件、来源快照、审核日志、报告。 */
export class LibraryStore {
  constructor(public dir: string = process.env.LIBRARY_DATA_DIR || join(process.cwd(), 'var', 'library')) {}

  private p = (f: string) => join(this.dir, f);
  private ensure() {
    mkdirSync(this.dir, { recursive: true });
  }

  loadDoc(): { entries: LibEntry[]; [k: string]: unknown } {
    return existsSync(this.p('reference_entries.json')) ? JSON.parse(readFileSync(this.p('reference_entries.json'), 'utf8')) : bundledDoc();
  }
  saveDoc(doc: unknown) {
    this.ensure();
    writeFileSync(this.p('reference_entries.json'), JSON.stringify(doc, null, 1), 'utf8');
  }
  loadState(): LibState {
    return existsSync(this.p('library_state.json')) ? JSON.parse(readFileSync(this.p('library_state.json'), 'utf8')) : emptyState();
  }
  saveState(st: LibState) {
    this.ensure();
    writeFileSync(this.p('library_state.json'), JSON.stringify(st, null, 1), 'utf8');
  }
  saveReport(text: string) {
    this.ensure();
    writeFileSync(this.p('library_report.md'), text, 'utf8');
  }
  log = (rec: Record<string, unknown>) => {
    this.ensure();
    appendFileSync(this.p('library_review_log.jsonl'), `${JSON.stringify(rec)}\n`, 'utf8');
  };
  snapshots(): Snapshots {
    const f = (id: string, k: string) => join(this.dir, 'snapshots', `${id}.${k}.txt`);
    return {
      read: (id, k) => (existsSync(f(id, k)) ? readFileSync(f(id, k), 'utf8') : null),
      exists: (id, k) => existsSync(f(id, k)),
      write: (id, k, t) => {
        mkdirSync(join(this.dir, 'snapshots'), { recursive: true });
        writeFileSync(f(id, k), t, 'utf8');
      },
    };
  }
}

/** 给每条条目附上展示结论；不可见的（待审核/已废止/来源有废止迹象）直接去掉，除非是预览。 */
export function annotate(doc: { entries: LibEntry[] }, state: LibState, today: number, opts: { preview?: boolean; includeHidden?: boolean } = {}): AnnotatedEntry[] {
  const out: AnnotatedEntry[] = [];
  for (const e of doc.entries) {
    const display: Decision = decide(e, state.entries?.[e.id], today, { ttlByCategory: TTL_BY_CATEGORY, preview: opts.preview });
    if (!display.visible && !opts.includeHidden) continue;
    out.push({ ...e, display });
  }
  return out;
}
