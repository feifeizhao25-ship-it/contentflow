/**
 * 规则库自动更新任务：挂在 SIL 已有的调度槽（daily_scan 02:00 / weekly_cycle 周日 03:00，Asia/Shanghai）上，
 * 复用 SIL 的域名白名单、注入扫描和调度表。只读网络，只写 LIBRARY_DATA_DIR 下的状态/快照/报告；
 * 不改条目，不让任何东西上线。默认关闭：LIBRARY_FRESHNESS_ENABLED=1 才运行（与 SIL_ENABLED 无关）。
 */
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SIL_CRON, SIL_TIMEZONE } from '../growth/self-improve/schedule';
import { SourcePolicy, domainOk, scanInjection } from '../growth/self-improve/sources';
import { FetchError, Fetcher, Page, checkEntries, discover, renderReport } from './live/freshness';
import { extractText } from './live/util';
import { LibraryStore, sources } from './store';

export const LIBRARY_SLOTS = { library_check: SIL_CRON.daily_scan, library_discover: SIL_CRON.weekly_cycle } as const;
export const libraryJobEnabled = (env: NodeJS.ProcessEnv = process.env): boolean => ['1', 'true', 'yes', 'on'].includes(String(env.LIBRARY_FRESHNESS_ENABLED ?? '0').trim().toLowerCase());

export type HttpGet = (url: string, timeoutMs: number) => Promise<{ status: number; body: string; location?: string | null }>;

const MAX_BYTES = 2_000_000;
export const realHttpGet: HttpGet = async (url, timeoutMs) => {
  const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(timeoutMs), headers: { 'user-agent': 'Mozilla/5.0 (compatible; library-freshness-check)', accept: 'text/html,application/xhtml+xml' } });
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_BYTES) throw new FetchError('refused', res.status, 'too_large');
  return { status: res.status, body: buf.toString('utf8'), location: res.headers.get('location') };
};

/** 受限抓取：仅 https、仅白名单域名、不跨域跳转（同域最多跳 3 次）、限大小。 */
export function makeFetch(policy: SourcePolicy, http: HttpGet = realHttpGet, timeoutMs = 15_000): Fetcher {
  return async (url0: string): Promise<Page> => {
    let url = url0;
    for (let hop = 0; hop < 4; hop++) {
      let u: URL;
      try {
        u = new URL(url);
      } catch {
        throw new FetchError('refused', null, 'bad_url');
      }
      if (u.protocol !== 'https:') throw new FetchError('refused', null, 'not_https');
      if (!domainOk(u.hostname, policy)) throw new FetchError('refused', null, `domain_not_whitelisted:${u.hostname}`);
      let r;
      try {
        r = await http(url, timeoutMs);
      } catch (e) {
        if (e instanceof FetchError) throw e;
        throw new FetchError('unreachable', null, (e as Error)?.name ?? 'error');
      }
      if ([301, 302, 303, 307, 308].includes(r.status) && r.location) {
        url = new URL(r.location, url).toString();
        continue;
      }
      if (r.status === 404 || r.status === 410) throw new FetchError('broken', r.status);
      if (r.status >= 400) throw new FetchError('unreachable', r.status);
      const { title, text } = extractText(r.body);
      return { url, status: r.status, title, text, raw: r.body };
    }
    throw new FetchError('refused', null, 'too_many_redirects');
  };
}

export function policy(): SourcePolicy {
  return { allowedDomains: sources().allowed_domains };
}

@Injectable()
export class LibraryJobService {
  private readonly logger = new Logger(LibraryJobService.name);
  constructor(private readonly store: LibraryStore = new LibraryStore()) {}

  enabled(env: NodeJS.ProcessEnv = process.env) {
    return libraryJobEnabled(env);
  }

  async runCheck(now = new Date(), opts: { fetch?: Fetcher; env?: NodeJS.ProcessEnv } = {}) {
    if (!this.enabled(opts.env)) return { status: 'disabled' as const };
    const doc = this.store.loadDoc();
    const fetch = opts.fetch ?? makeFetch(policy());
    const state = await checkEntries(doc.entries, this.store.loadState(), fetch, now, { product: 'contentflow', snapshots: this.store.snapshots(), injection: scanInjection, manualHosts: sources().manual_hosts });
    this.store.saveState(state);
    this.store.saveReport(renderReport(doc.entries, state));
    const attention = Object.entries(state.entries).filter(([, s]) => s.check !== 'ok').map(([id, s]) => `${id}:${s.check}`);
    this.logger.log(`library check: ${Object.keys(state.entries).length} entries, needs attention: ${attention.length}`);
    return { status: 'ok' as const, attention, state };
  }

  async runDiscover(now = new Date(), opts: { fetch?: Fetcher; env?: NodeJS.ProcessEnv } = {}) {
    if (!this.enabled(opts.env)) return { status: 'disabled' as const };
    const doc = this.store.loadDoc();
    const pol = policy();
    const fetch = opts.fetch ?? makeFetch(pol);
    const state = await discover(sources().watch, this.store.loadState(), fetch, now, {
      knownUrls: doc.entries.map((e) => e.source.url),
      urlOk: (u) => {
        try {
          const x = new URL(u);
          return x.protocol === 'https:' && domainOk(x.hostname, pol);
        } catch {
          return false;
        }
      },
    });
    this.store.saveState(state);
    this.store.saveReport(renderReport(doc.entries, state));
    return { status: 'ok' as const, candidates: state.candidates.length, state };
  }

  @Cron(LIBRARY_SLOTS.library_check, { name: 'library-check', timeZone: SIL_TIMEZONE })
  async checkJob(): Promise<void> {
    try {
      await this.runCheck();
    } catch (e) {
      this.logger.error(`library check failed: ${(e as Error).message}`);
    }
  }

  @Cron(LIBRARY_SLOTS.library_discover, { name: 'library-discover', timeZone: SIL_TIMEZONE })
  async discoverJob(): Promise<void> {
    try {
      await this.runDiscover();
    } catch (e) {
      this.logger.error(`library discover failed: ${(e as Error).message}`);
    }
  }
}
