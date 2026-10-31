import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AnnotatedEntry, Feed, Signals, TOPICS, TOPIC_BY_ID, homeCard, rank } from './feed';
import { dayStr, parseDay, shanghaiToday } from './live/util';
import { LibraryStore, annotate, showPending } from './store';

const KEY = 'library';
const KEEP_DAYS = 30;

export interface Prefs {
  enabled: boolean;
  followed: string[];
  muted: string[];
}
interface Stored extends Partial<Prefs> {
  last_visit?: string;
  opened?: { id: string; day: string }[];
  shown?: { id: string; day: string }[];
}

/** 用户的资料库设置、来访、读过什么，都放在 User.preferences.library 里（账号注销时随 preferences 一起清空）。 */
@Injectable()
export class LibraryService {
  constructor(private readonly prisma: PrismaService, private readonly store: LibraryStore = new LibraryStore()) {}

  private async readUser(userId: string): Promise<Record<string, any>> {
    const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { preferences: true } });
    return ((u?.preferences as Record<string, any>) ?? {}) as Record<string, any>;
  }
  private async writeStored(userId: string, prefs: Record<string, any>, stored: Stored) {
    await this.prisma.user.update({ where: { id: userId }, data: { preferences: { ...prefs, [KEY]: stored } as any } });
  }

  entries(now = new Date()): AnnotatedEntry[] {
    return annotate(this.store.loadDoc(), this.store.loadState(), shanghaiToday(now), { preview: showPending() });
  }

  async entriesFor(userId: string | null, now = new Date()) {
    const today = shanghaiToday(now);
    const items = annotate(this.store.loadDoc(), this.store.loadState(), today, { preview: showPending() });
    let marks: Record<string, 'new' | 'updated'> = {};
    if (userId) {
      const s = ((await this.readUser(userId))[KEY] ?? {}) as Stored;
      const ref = parseDay(s.last_visit);
      if (ref !== null) {
        for (const e of items) {
          const a = parseDay(e.approved_at);
          const u = parseDay(e.updated_on);
          if (a !== null && a > ref) marks[e.id] = 'new';
          else if (u !== null && u > ref) marks[e.id] = 'updated';
        }
      }
    }
    return { entries: items.map((e) => (marks[e.id] ? { ...e, badge: marks[e.id] } : e)), generated_for: dayStr(today), preview_pending: showPending(), personalized: !!userId };
  }

  entry(id: string, now = new Date()) {
    return annotate(this.store.loadDoc(), this.store.loadState(), shanghaiToday(now), { preview: showPending(), includeHidden: true }).find((e) => e.id === id && (e.display.visible || e.display.state === 'repealed' || e.display.state === 'repeal_hold')) ?? null;
  }

  async preferences(userId: string): Promise<Prefs & { topics: { id: string; name: string }[] }> {
    const s = ((await this.readUser(userId))[KEY] ?? {}) as Stored;
    return { enabled: s.enabled !== false, followed: s.followed ?? [], muted: s.muted ?? [], topics: TOPICS.map((t) => ({ id: t.id, name: t.name })) };
  }

  async setPreferences(userId: string, body: { enabled?: boolean; follow?: string[]; unfollow?: string[]; mute?: string[]; unmute?: string[] }) {
    const all = [...(body.follow ?? []), ...(body.unfollow ?? []), ...(body.mute ?? []), ...(body.unmute ?? [])];
    if (all.some((t) => !TOPIC_BY_ID.has(t))) throw new RangeError('unknown topic');
    const prefs = await this.readUser(userId);
    const s = ((prefs[KEY] ?? {}) as Stored) ?? {};
    let followed = new Set(s.followed ?? []);
    let muted = new Set(s.muted ?? []);
    for (const t of body.follow ?? []) {
      followed.add(t);
      muted.delete(t);
    }
    for (const t of body.mute ?? []) {
      muted.add(t);
      followed.delete(t);
    }
    for (const t of body.unfollow ?? []) followed.delete(t);
    for (const t of body.unmute ?? []) muted.delete(t);
    const next: Stored = { ...s, followed: [...followed].sort(), muted: [...muted].sort() };
    if (body.enabled !== undefined) {
      next.enabled = body.enabled;
      if (!body.enabled) {
        next.opened = [];
        next.shown = []; // 关闭后不再记录读过什么，也清掉已有的
      }
    }
    await this.writeStored(userId, prefs, next);
    return this.preferences(userId);
  }

  private keep(list: { id: string; day: string }[] | undefined, today: number) {
    return (list ?? []).filter((x) => {
      const d = parseDay(x.day);
      return d !== null && today - d <= KEEP_DAYS * 86_400_000;
    });
  }

  async signals(userId: string, today: number): Promise<Signals> {
    const prefs = await this.readUser(userId);
    const s = (prefs[KEY] ?? {}) as Stored;
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { tenant_id: true } });
    const tenant = user?.tenant_id;
    const platforms = new Set<string>(Array.isArray(prefs.default_platforms) ? prefs.default_platforms : []);
    let positioning = '';
    if (tenant) {
      const accs = await this.prisma.platformAccount.findMany({ where: { tenant_id: tenant, status: 'active' }, select: { platform: true } });
      for (const a of accs) if (a.platform) platforms.add(a.platform);
      const personas = await this.prisma.persona.findMany({ where: { tenant_id: tenant }, select: { name: true, description: true, config: true } });
      positioning = personas.map((p) => personaText(p)).join(' ');
    }
    const toMap = (l?: { id: string; day: string }[]) => Object.fromEntries(this.keep(l, today).map((x) => [x.id, x.day]));
    return { enabled: s.enabled !== false, today, platforms: [...platforms].sort(), positioning, followed: s.followed ?? [], muted: s.muted ?? [], opened: toMap(s.opened), shown: toMap(s.shown), lastVisit: s.last_visit ?? null };
  }

  async feed(userId: string, now = new Date(), opts: { record?: boolean; limit?: number } = {}) {
    const today = shanghaiToday(now);
    const sig = await this.signals(userId, today);
    const items = annotate(this.store.loadDoc(), this.store.loadState(), today, { preview: showPending() });
    const out = rank(items, sig, userId, opts.limit ?? 6);
    const topics = TOPICS.map((t) => ({ id: t.id, name: t.name, followed: sig.followed.includes(t.id), muted: sig.muted.includes(t.id) }));
    const result = {
      ...out,
      topics,
      since: sig.lastVisit,
      generated_for: dayStr(today),
      note: '推荐只用你账号里的信息（绑定的平台、人设里写的账号定位）、你关注的主题和在应用里读过的内容；规则来自官方文件，仅供了解，不是法律意见。可随时关闭。',
    };
    if (opts.record !== false && out.enabled && out.items.length) {
      const prefs = await this.readUser(userId);
      const s = (prefs[KEY] ?? {}) as Stored;
      const day = dayStr(today);
      const shown = [...this.keep(s.shown, today).filter((x) => x.day !== day), ...out.items.map((i) => ({ id: i.id, day }))];
      await this.writeStored(userId, prefs, { ...s, shown });
    }
    return result;
  }

  async visit(userId: string, now = new Date()) {
    const prefs = await this.readUser(userId);
    const s = (prefs[KEY] ?? {}) as Stored;
    if (s.enabled === false) return; // 关闭后不记录
    await this.writeStored(userId, prefs, { ...s, last_visit: dayStr(shanghaiToday(now)) });
  }

  async opened(userId: string, id: string, now = new Date()) {
    const today = shanghaiToday(now);
    const prefs = await this.readUser(userId);
    const s = (prefs[KEY] ?? {}) as Stored;
    if (s.enabled === false) return;
    const opened = [...this.keep(s.opened, today), { id, day: dayStr(today) }].slice(-200);
    await this.writeStored(userId, prefs, { ...s, opened });
  }

  async homeCard(userId: string, now = new Date()) {
    return homeCard((await this.feed(userId, now, { record: false })) as unknown as Feed);
  }
}

/** 人设里账号自己写的定位文字（说明 + 配置里的定位类字段）；不含其它租户的内容。 */
export function personaText(p: { name?: string | null; description?: string | null; config?: unknown }): string {
  const cfg = p.config && typeof p.config === 'object' && !Array.isArray(p.config) ? (p.config as Record<string, unknown>) : {};
  const parts = [p.description ?? ''];
  for (const k of ['positioning', 'niche', 'audience', 'topics']) {
    const v = cfg[k];
    parts.push(Array.isArray(v) ? v.filter((x) => typeof x === 'string').join(' ') : typeof v === 'string' ? v : '');
  }
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}
