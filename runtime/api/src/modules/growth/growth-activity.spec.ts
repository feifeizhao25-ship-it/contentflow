import { GrowthController } from './growth.controller';

describe('GET /growth/plan 带近 7 天真实活动（I-10）', () => {
  it('计划来自目标，activity_7d 来自账号活动，两者都不编', async () => {
    const plan = { goals: [], hasGoals: false };
    const signals = { content_7d: 3, published_7d: 2, failed_7d: 1, scheduled_upcoming: 4, platforms: ['douyin'], materials: 5 };
    const ctl = new GrowthController(
      { getGrowthPlan: async () => plan } as any,
      {} as any,
      { signalsForUser: async (id: string) => (id === 'u1' ? signals : null) } as any,
    );
    const r: any = await ctl.getPlan({ user: { id: 'u1' } });
    expect(r).toMatchObject({ goals: [], hasGoals: false });
    expect(r.activity_7d).toEqual({ content_created: 3, published: 2, failed: 1, scheduled_upcoming: 4, connected_platforms: ['douyin'], materials: 5 });
  });
});
