/** 只给测试用：假的页面、假的抓取、内存里的假 Prisma。 */
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { HttpGet } from './library-job.service';
import { LibEntry } from './live/util';
import { LibraryStore, bundledDoc } from './store';

export const page = (title: string, body: string, views = 1) => `<html><head><title>${title}</title></head><body><nav>首页</nav><p>浏览量：${views}</p>${body}</body></html>`;

/** 按来源页（不是按条目）生成页面：同一个来源页被几条共用。 */
export function buildPages(entries: LibEntry[], opts: { changed?: string[]; repealed?: string[]; views?: number } = {}): Record<string, string> {
  const out: Record<string, string> = {};
  for (const e of entries) {
    const url = e.source.url;
    const sharing = entries.filter((x) => x.source.url === url).map((x) => x.id);
    let body = Array.from({ length: 29 }, (_, i) => `<p>${url.slice(-12)} 第${i + 1}条 数值 ${(i + 1) * 10} 单位。</p>`).join('');
    if (sharing.some((id) => opts.changed?.includes(id))) body = body.replace('数值 10 单位', '数值 15 单位');
    const title = e.source.title + (sharing.some((id) => opts.repealed?.includes(id)) ? '（已废止）' : '');
    out[url] = page(title as string, body, opts.views ?? 1);
  }
  return out;
}

export function fakeHttp(pages: Record<string, string>, broken: string[] = []): HttpGet {
  return async (url) => {
    if (broken.includes(url)) return { status: 404, body: '' };
    if (!(url in pages)) return { status: 500, body: '' };
    return { status: 200, body: pages[url] };
  };
}

export const tmpStore = () => new LibraryStore(mkdtempSync(join(tmpdir(), 'lib-')));
export const entriesOf = () => bundledDoc().entries;

export interface FakeUser {
  id: string;
  tenant_id: string;
  preferences: Record<string, unknown>;
  platforms: string[];
  personas: { name: string; description?: string; config?: unknown }[];
}

export function fakePrisma(users: FakeUser[]) {
  const by = new Map(users.map((u) => [u.id, u]));
  return {
    user: {
      findUnique: async ({ where }: any) => {
        const u = by.get(where.id);
        return u ? { preferences: u.preferences, tenant_id: u.tenant_id } : null;
      },
      update: async ({ where, data }: any) => {
        by.get(where.id)!.preferences = JSON.parse(JSON.stringify(data.preferences));
        return {};
      },
    },
    platformAccount: { findMany: async ({ where }: any) => users.filter((u) => u.tenant_id === where.tenant_id).flatMap((u) => u.platforms.map((p) => ({ platform: p }))) },
    persona: { findMany: async ({ where }: any) => users.filter((u) => u.tenant_id === where.tenant_id).flatMap((u) => u.personas) },
  } as any;
}
