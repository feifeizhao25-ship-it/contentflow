/**
 * 注册三问和省份进入「为你推荐」的排序，而且只使用当前用户自己填的值。
 */
import { AnnotatedEntry, EMPTY_PROFILE, ProfileAnswers, Signals, rank } from './feed';
import { LibraryService } from './library.service';
import * as review from './live/review';
import { shanghaiToday } from './live/util';
import { FakeUser, fakePrisma, tmpStore } from './test-helpers';

const TODAY = Date.parse('2026-11-09T00:00:00+08:00');

function signals(profile: Partial<ProfileAnswers> = {}): Signals {
  return {
    enabled: true,
    today: TODAY,
    platforms: [],
    positioning: '',
    profile: { ...EMPTY_PROFILE, ...profile },
    followed: [],
    muted: [],
    opened: {},
    shown: {},
    lastVisit: null,
  };
}

function entry(partial: { id: string; title: string; summary?: string; category: string; tags?: string[] }): AnnotatedEntry {
  return {
    id: partial.id,
    title: partial.title,
    summary: partial.summary ?? '',
    category: partial.category,
    tags: partial.tags ?? [],
    platforms: [],
    source: { url: 'https://www.gov.cn/a' },
    status: '现行',
    review_status: '已审核',
    display: {
      state: 'current',
      visible: true,
      feed_eligible: true,
      current: true,
      banner: null,
      badges: [],
      change_note: null,
      last_verified_at: '2026-11-09',
      updated_on: null,
    },
  } as AnnotatedEntry;
}

describe('注册画像改变推荐顺序', () => {
  const health = entry({ id: 'health', title: '养生科普和卖货不能放在一起', category: '健康食品宣传', tags: ['养生'] });
  const ad = entry({ id: 'ad', title: '带货文章必须标明广告', category: '广告标识', tags: ['广告'] });
  const minors = entry({ id: 'minors', title: '面向学生的内容', category: '未成年人', tags: ['学生'] });
  const live = entry({ id: 'live', title: '直播间的不能做', category: '直播营销', tags: ['直播'] });
  const local = entry({ id: 'local', title: '地方台广告提示', summary: '适用于浙江的发布者', category: '直播营销' });

  it('没填画像时，广告标识的基础分排在前面', () => {
    const out = rank([health, ad], signals(), 'u');
    expect(out.items[0].id).toBe('ad');
    expect(out.items.every((item) => !item.reason_codes.includes('profile'))).toBe(true);
  });

  it('行业、岗位、成长阶段、省份各自能把相关条目排到前面', () => {
    expect(rank([health, ad], signals({ industry: '养生' }), 'u').items[0]).toMatchObject({
      id: 'health',
      reason_codes: expect.arrayContaining(['profile']),
    });
    expect(rank([minors, ad], signals({ jobRole: '学生' }), 'u').items[0].id).toBe('minors');
    expect(rank([live, ad], signals({ growthStage: '刚开始直播' }), 'u').items[0].id).toBe('live');
    const byProvince = rank([local, ad], signals({ province: '浙江' }), 'u');
    expect(byProvince.items[0].id).toBe('local');
    expect(byProvince.items[0].reason).toContain('浙江');
  });

  it('服务只把当前用户库里的四项送进排序', async () => {
    const users: FakeUser[] = [
      { id: 'u-a', tenant_id: 't1', preferences: {}, platforms: [], personas: [], industry: '养生', job_role: '老师', growth_stage: '起步', province: '浙江' },
      { id: 'u-b', tenant_id: 't2', preferences: {}, platforms: [], personas: [] },
    ];
    const store = tmpStore();
    const doc = store.loadDoc();
    const ctx = { doc, state: store.loadState(), log: store.log, now: () => new Date('2026-11-09T09:00:00+08:00') };
    for (const e of doc.entries) review.approve(ctx, e.id, '测试审核人', '2026-11-09');
    store.saveDoc(doc);
    const svc = new LibraryService(fakePrisma(users), store);
    const now = new Date('2026-11-09T09:00:00+08:00');

    const mine = await svc.signals('u-a', shanghaiToday(now));
    const other = await svc.signals('u-b', shanghaiToday(now));
    expect(mine.profile).toEqual({ industry: '养生', jobRole: '老师', growthStage: '起步', province: '浙江' });
    expect(other.profile).toEqual(EMPTY_PROFILE);

    const feedMine = await svc.feed('u-a', now, { record: false });
    const feedOther = await svc.feed('u-b', now, { record: false });
    expect(feedMine.items[0].category).toBe('健康食品宣传');
    expect(feedMine.items[0].reason_codes).toContain('profile');
    expect(feedOther.items[0].category).toBe('广告标识');
    expect(feedOther.items.every((item) => !item.reason_codes.includes('profile'))).toBe(true);
  });
});
