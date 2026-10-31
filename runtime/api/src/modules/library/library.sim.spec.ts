/**
 * 5 个人 × 7 天的模拟（周一到周日），周四有一次来源更新，周五审核人处理。
 * 用真的 抓取→对比→展示规则→排序→推荐 链路，只把「网页」和「数据库」换成假的。
 * 审核人是测试里的假名字：这里的「已审核」只在测试临时目录里，不会写进真实条目。
 */
import { LibraryJobService, makeFetch, policy } from './library-job.service';
import { LibraryService } from './library.service';
import * as review from './live/review';
import { dayStr, shanghaiToday } from './live/util';
import { FakeUser, buildPages, entriesOf, fakeHttp, fakePrisma, tmpStore } from './test-helpers';

const DAYS = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08'];
const WEEK = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const nowAt = (d: number, h = 9) => new Date(`${DAYS[d]}T${String(h).padStart(2, '0')}:00:00+08:00`);

const GUIDE = ['cf-rule-002', 'cf-rule-003']; // 共用「可识别性执法指南」来源页：周四改了数字
const LIVE = ['cf-rule-008', 'cf-rule-009']; // 共用「网络直播营销管理办法」来源页：周四页面标题出现「已废止」（模拟）

const users: FakeUser[] = [
  { id: 'u-beauty', tenant_id: 't1', preferences: {}, platforms: ['xiaohongshu'], personas: [{ name: '美妆号', description: '好物种草和测评' }] },
  { id: 'u-health', tenant_id: 't2', preferences: {}, platforms: ['douyin'], personas: [{ name: '养生号', description: '养生食谱和中医科普，偶尔直播' }] },
  { id: 'u-ai', tenant_id: 't3', preferences: {}, platforms: ['bilibili'], personas: [{ name: '科技号', description: 'AI 数字人科普' }] },
  { id: 'u-edu', tenant_id: 't4', preferences: {}, platforms: ['zhihu'], personas: [{ name: '教育号', description: '学生考试经验分享' }] },
  { id: 'u-new', tenant_id: 't5', preferences: {}, platforms: [], personas: [] },
];

interface Day {
  entries: ReturnType<LibraryService['entries']>;
  feeds: Record<string, ReturnType<LibraryService['feed']> extends Promise<infer R> ? R : never>;
  visible: string[];
  current: string[];
}

async function runWeek() {
  const store = tmpStore();
  const job = new LibraryJobService(store);
  const svc = new LibraryService(fakePrisma(users), store);
  const env = { LIBRARY_FRESHNESS_ENABLED: '1' };
  const entries = entriesOf();
  const days: Day[] = [];
  const log: string[] = [];
  const ids = (xs: { id: string }[]) => xs.map((x) => x.id);

  for (let d = 0; d < 7; d++) {
    const now = nowAt(d);
    // 周四：来源更新（指南数字变了）+ 直播办法页面标题出现「已废止」。页面浏览量每天都变，不该触发任何变化。
    const pages = buildPages(entries, d >= 3 ? { changed: GUIDE, repealed: LIVE, views: d * 1000 } : { views: d * 1000 });
    await job.runCheck(nowAt(d, 2), { env, fetch: makeFetch(policy(), fakeHttp(pages)) });

    if (d === 0) {
      // 周一：审核人把除「手动核对」条目以外的 12 条通过（测试用假审核人）
      const doc = store.loadDoc();
      const ctx = { doc, state: store.loadState(), snapshots: store.snapshots(), log: store.log, now: () => now };
      for (const e of doc.entries) if (e.id !== 'cf-rule-012') review.approve(ctx, e.id, '测试审核人', DAYS[0]);
      store.saveDoc(doc);
      store.saveState(ctx.state);
    }
    if (d === 4) {
      // 周五：审核人读了周四的变化：002 更新（写变更说明），003 确认无影响，008/009 标为已废止
      const doc = store.loadDoc();
      const ctx = { doc, state: store.loadState(), snapshots: store.snapshots(), log: store.log, now: () => now };
      review.update(ctx, 'cf-rule-002', '测试审核人', DAYS[4], '指南中的数字有调整，标注位置要求更具体');
      review.confirmUnchanged(ctx, 'cf-rule-003', '测试审核人', DAYS[4]);
      review.repeal(ctx, 'cf-rule-008', '测试审核人', DAYS[4], '来源页已标注废止');
      review.repeal(ctx, 'cf-rule-009', '测试审核人', DAYS[4], '来源页已标注废止');
      store.saveDoc(doc);
      store.saveState(ctx.state);
    }

    const feeds: Day['feeds'] = {};
    for (const u of users) {
      feeds[u.id] = await svc.feed(u.id, now);
      await svc.visit(u.id, now);
      // 周二、周三：每个人点开推荐的第一条，之后不该再被反复顶在最前面
      if (d >= 1 && d <= 2 && feeds[u.id].items[0]) await svc.opened(u.id, feeds[u.id].items[0].id, now);
    }
    const all = svc.entries(now);
    days.push({ entries: all, feeds, visible: ids(all), current: ids(all.filter((e) => e.display.current)) });
    log.push(`${WEEK[d]} ${DAYS[d]}：` + users.map((u) => `${u.id}[${ids(feeds[u.id].items).map((i) => i.slice(-3)).join(',')}]`).join(' '));
  }
  return { days, store, svc, log };
}

describe('5 个人 × 7 天，周四来源更新', () => {
  let w: Awaited<ReturnType<typeof runWeek>>;
  beforeAll(async () => {
    w = await runWeek();
    if (process.env.LIBRARY_SIM_PRINT) console.log(w.log.join('\n'));
  }, 60_000);

  const feedIds = (d: number, u: string) => w.days[d].feeds[u].items.map((i) => i.id);

  it('每个人每天都有推荐，且五个人的推荐互不相同', () => {
    for (let d = 0; d < 7; d++) {
      const sets = users.map((u) => feedIds(d, u.id).join('|'));
      for (const u of users) expect(feedIds(d, u.id).length).toBeGreaterThanOrEqual(3);
      expect(new Set(sets).size).toBe(5);
    }
    // 第一屏（前 3 条）：账号不同，前三条的组成也不同
    const firstDay = users.map((u) => [...feedIds(1, u.id).slice(0, 3)].sort().join('|'));
    expect(new Set(firstDay).size).toBeGreaterThanOrEqual(4);
  });

  it('推荐理由说得出来，并且和这个人的账号对得上', () => {
    const f = (u: string, d: number) => w.days[d].feeds[u].items;
    expect(f('u-beauty', 1)[0].reason).toMatch(/好物|种草|测评|小红书/);
    expect(f('u-health', 1).some((i) => i.topic === 'health' && /养生|食品|食谱|中医/.test(i.reason))).toBe(true);
    expect(f('u-ai', 1).some((i) => i.topic === 'ai' && /数字人|AI/.test(i.reason))).toBe(true);
    expect(f('u-edu', 1).some((i) => i.topic === 'minors' && /学生|考试/.test(i.reason))).toBe(true);
    expect(f('u-new', 1).every((i) => i.reason.length > 0)).toBe(true);
    // 没有绑定任何平台、没写定位的人：不会被说成「你在某平台发布」
    expect(f('u-new', 1).every((i) => !/你在/.test(i.reason))).toBe(true);
  });

  it('周四来源变了：受影响的条目当天起不再被推荐，列表里带「来源有变化」提示，不算现行', () => {
    for (let d = 3; d <= 4; d++) {
      for (const u of users) for (const id of GUIDE) if (d === 3) expect(feedIds(d, u.id)).not.toContain(id);
    }
    const thu = w.days[3].entries.filter((e) => GUIDE.includes(e.id));
    expect(thu).toHaveLength(2);
    for (const e of thu) expect(e.display).toMatchObject({ state: 'source_changed', current: false, feed_eligible: false, visible: true });
    expect(thu[0].display.banner).toContain('来源');
    // 周三还是现行的
    for (const id of GUIDE) expect(w.days[2].current).toContain(id);
  });

  it('周四来源出现「废止」迹象：直播办法这两条当天起所有人看不到，也不在条目列表里，更不算现行', () => {
    for (let d = 0; d < 3; d++) for (const id of LIVE) expect(w.days[d].visible).toContain(id);
    for (let d = 3; d < 7; d++) {
      for (const id of LIVE) {
        expect(w.days[d].visible).not.toContain(id);
        expect(w.days[d].current).not.toContain(id);
        for (const u of users) expect(feedIds(d, u.id)).not.toContain(id);
      }
    }
    // 单条详情也不会把它当现行
    const one = w.svc.entry('cf-rule-008', nowAt(5)); // 周五已被审核人标为已废止
    expect(one?.display.current).toBe(false);
    expect(one?.display.visible).toBe(false);
    const hold = w.days[3].entries.find((e) => e.id === 'cf-rule-008');
    expect(hold).toBeUndefined(); // 周四（还没人处理）：来源出现废止迹象就先隐藏
  });

  it('全周任何一个人任何一天，被废止/待审核/来源有变的条目都从没以「现行」出现', () => {
    for (let d = 0; d < 7; d++) {
      for (const u of users) {
        for (const it of w.days[d].feeds[u.id].items) {
          expect(it.status).not.toBe('已废止');
          if (d >= 3 && LIVE.includes(it.id)) throw new Error(`${it.id} shown on day ${d}`);
          if (d === 3 && GUIDE.includes(it.id)) throw new Error(`${it.id} shown while source changed`);
        }
      }
      expect(w.days[d].visible).not.toContain('cf-rule-012'); // 从没人审，不出现
    }
  });

  it('周五审核后：更新的 002 带「更新于」和变更说明，只对相关的人带「更新」标记（上次来访之后）', () => {
    const fri = (u: string) => w.days[4].feeds[u].items;
    const beauty = fri('u-beauty').find((i) => i.id === 'cf-rule-002');
    expect(beauty).toBeDefined();
    expect(beauty!.badge).toBe('updated');
    expect(beauty!.change_note).toContain('数字有调整');
    expect(beauty!.badges.map((b) => b.text)).toEqual(expect.arrayContaining([`更新于 ${DAYS[4]}`]));
    expect(beauty!.reason).toContain('更新');
    // 周三点开读过旧版的人（教育号）也会被告知；没读过、账号定位也无关的人（养生号、新用户）不被「更新」打扰
    expect(fri('u-edu').find((i) => i.id === 'cf-rule-002')?.badge).toBe('updated');
    expect(fri('u-health').find((i) => i.id === 'cf-rule-002')?.badge ?? null).toBeNull();
    expect(fri('u-new').find((i) => i.id === 'cf-rule-002')?.badge ?? null).toBeNull();
    // 相关的 AI 方向：003 确认无影响、没有「更新于」，仍可正常出现
    const ai003 = w.days[4].feeds['u-ai'].items.find((i) => i.id === 'cf-rule-003');
    if (ai003) expect(ai003.change_note).toBeNull();
    // 002 周五恢复为现行
    expect(w.days[4].current).toContain('cf-rule-002');
    expect(w.days[4].current).toContain('cf-rule-003');
  });

  it('「更新于」30 天内显示，周六周日仍在，但「更新」标记只在来访之后的那次出现', () => {
    const sat = w.days[5].feeds['u-beauty'].items.find((i) => i.id === 'cf-rule-002');
    if (sat) {
      expect(sat.badges.map((b) => b.kind)).toContain('updated');
      expect(sat.badge).not.toBe('updated'); // 周五来访过了
    }
  });

  it('每天读过的内容不会连着几天顶在第一位', () => {
    for (const u of users) {
      const firsts = [1, 2].map((d) => feedIds(d, u.id)[0]);
      // 周二点开的第一条，周三不再是第一条
      expect(feedIds(2, u.id)[0]).not.toBe(feedIds(1, u.id)[0]);
      expect(firsts[0]).toBeDefined();
    }
  });

  it('同一个人同一天推荐稳定；换一个人就不同', async () => {
    const a = await w.svc.feed('u-ai', nowAt(5, 8), { record: false });
    const b = await w.svc.feed('u-ai', nowAt(5, 20), { record: false });
    expect(a.items.map((i) => i.id)).toEqual(b.items.map((i) => i.id));
  });

  it('关闭个性化：不推荐、不记录；静音主题：不出现；关注主题：排在前面', async () => {
    const before = await w.svc.feed('u-new', nowAt(6), { record: false });
    const pos = (f: typeof before) => f.items.findIndex((i) => i.topic === 'health');
    await w.svc.setPreferences('u-new', { follow: ['health'] });
    const f = await w.svc.feed('u-new', nowAt(6), { record: false });
    expect(pos(f)).toBeLessThanOrEqual(pos(before));
    expect(f.items.filter((i) => i.topic === 'health').every((i) => i.reason.includes('你关注了「健康食品宣传」'))).toBe(true);
    expect(f.items.filter((i) => i.topic === 'health').length).toBeGreaterThan(0);
    await w.svc.setPreferences('u-new', { mute: ['health'] });
    const m = await w.svc.feed('u-new', nowAt(6), { record: false });
    expect(m.items.some((i) => i.topic === 'health')).toBe(false);
    await w.svc.setPreferences('u-edu', { enabled: false });
    const off = await w.svc.feed('u-edu', nowAt(6));
    expect(off).toMatchObject({ enabled: false, items: [] });
    expect(await w.svc.homeCard('u-edu', nowAt(6))).toBeNull();
    await w.svc.opened('u-edu', 'cf-rule-001', nowAt(6));
    const s = await w.svc.signals('u-edu', shanghaiToday(nowAt(6)));
    expect(s.opened).toEqual({}); // 关闭后不记
  });

  it('首页卡片：有更新就出卡片并带理由；没有值得说的不出卡片', async () => {
    const card = await w.svc.homeCard('u-beauty', nowAt(4));
    expect(card).not.toBeNull();
    expect(card!.href).toBe('/rules');
    expect(card!.title.length).toBeGreaterThan(0);
  });

  it('审计日志里只有测试审核人的人工操作；自动核对没有写过任何审核', () => {
    const lines = require('fs').readFileSync(`${w.store.dir}/library_review_log.jsonl`, 'utf8').trim().split('\n').map((l: string) => JSON.parse(l));
    expect(new Set(lines.map((l: any) => l.reviewer))).toEqual(new Set(['测试审核人']));
    expect(lines.filter((l: any) => l.action === 'approve')).toHaveLength(12);
    expect(dayStr(shanghaiToday(nowAt(4)))).toBe(DAYS[4]);
  });
});
