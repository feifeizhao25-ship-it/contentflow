import { UserService } from './user.service';
import { EMPTY_PROFILE, rank, type AnnotatedEntry, type Signals } from '../library/feed';

describe('注册画像只写当前用户，并进入推荐原因', () => {
  it('空字符串清空，不写到别人的账号', async () => {
    const rows = new Map<string, any>([
      ['me', { status: 'active', industry: null, job_role: '旧岗位', growth_stage: null, province: null }],
      ['other', { status: 'active', industry: '别人的行业', job_role: null, growth_stage: null, province: null }],
    ]);
    const prisma = {
      user: {
        findUnique: async ({ where }: any) => rows.get(where.id) ?? null,
        update: async ({ where, data }: any) => Object.assign(rows.get(where.id), data),
      },
    };
    const saved = await new UserService(prisma as any).saveSignupProfile('me', { industry: ' 养生 ', job_role: '  ' });
    expect(saved).toEqual({ industry: '养生', job_role: null, growth_stage: null, province: null });
    expect(rows.get('other').industry).toBe('别人的行业');
  });

  it('行业答案会给相关规则加上 profile 原因', () => {
    const health = entry('health', '养生科普', '健康食品宣传');
    const ad = entry('ad', '带货必须标广告', '广告标识');
    const withProfile = rank([health, ad], signals({ industry: '养生' }), 'me');
    expect(withProfile.items[0].id).toBe('health');
    expect(withProfile.items[0].reason_codes).toContain('profile');
    const without = rank([health, ad], signals(), 'me');
    expect(without.items.every((item) => !item.reason_codes.includes('profile'))).toBe(true);
  });
});

function signals(profile: Partial<typeof EMPTY_PROFILE> = {}): Signals {
  return {
    enabled: true,
    today: Date.parse('2026-11-09T00:00:00+08:00'),
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

function entry(id: string, title: string, category: string): AnnotatedEntry {
  return {
    id,
    title,
    summary: '',
    category,
    tags: [],
    platforms: [],
    source: { url: 'https://www.gov.cn/a' },
    status: '现行',
    review_status: '已审核',
    display: { feed_eligible: true, badges: [], change_note: null, last_verified_at: '2026-11-09', state: 'current', visible: true, current: true, banner: null, updated_on: null },
  } as AnnotatedEntry;
}
