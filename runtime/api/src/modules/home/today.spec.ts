import { TodaySignals, nextStep } from './today';

const base: TodaySignals = { accounts: 1, platforms: ['douyin'], content_7d: 2, drafts: 0, pending_review: 0, approved_unpublished: 0, published_7d: 2, failed_7d: 0, scheduled_upcoming: 0, materials: 0, active_goals: 1 };

describe('今天先做什么（I-10）', () => {
  it('优先级固定：没账号 > 发布失败 > 待审核 > 已通过未发布 > 没新内容 > 没目标 > 继续保持', () => {
    expect(nextStep({ ...base, accounts: 0, failed_7d: 3 }, 'zh', true).id).toBe('connect_account');
    expect(nextStep({ ...base, failed_7d: 3, pending_review: 2 }, 'zh', true).id).toBe('fix_failed');
    expect(nextStep({ ...base, pending_review: 2, approved_unpublished: 1 }, 'zh', true).id).toBe('review_content');
    expect(nextStep({ ...base, approved_unpublished: 1 }, 'zh', true).id).toBe('publish_approved');
    expect(nextStep({ ...base, content_7d: 0 }, 'zh', true).id).toBe('create_content');
    expect(nextStep({ ...base, active_goals: 0 }, 'zh', true).id).toBe('set_goal');
    expect(nextStep(base, 'zh', true).id).toBe('keep_going');
  });

  it('同样的数据同样的结果；数据一变，建议就变（不再七天零变化）', () => {
    const a = nextStep({ ...base, pending_review: 1 }, 'en', false);
    expect(nextStep({ ...base, pending_review: 1 }, 'en', false)).toEqual(a);
    expect(nextStep({ ...base, pending_review: 0 }, 'en', false).id).not.toBe(a.id);
  });

  it('国际版：全英文、没有目标这一步（增长目标是国内版功能）；国内版：中文', () => {
    const all = [{ ...base, accounts: 0 }, { ...base, failed_7d: 2 }, { ...base, pending_review: 2 }, { ...base, approved_unpublished: 1 }, { ...base, content_7d: 0 }, { ...base, active_goals: 0 }, base];
    for (const s of all) {
      const n = nextStep(s, 'en', false);
      expect(`${n.title}${n.description}${n.reason}`).not.toMatch(/[㐀-鿿]/);
      expect(n.id).not.toBe('set_goal');
      expect(nextStep(s, 'zh', true).title).toMatch(/[㐀-鿿]/);
    }
  });

  it('理由写明用了哪条真实数据，数字来自信号', () => {
    expect(nextStep({ ...base, failed_7d: 3 }, 'en', false).reason).toContain('3');
    expect(nextStep({ ...base, published_7d: 5 }, 'zh', true).reason).toContain('5');
  });
});
