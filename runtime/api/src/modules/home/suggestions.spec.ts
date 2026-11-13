import { EMPTY_PROFILE } from '../library/feed';
import { pendingItems, suggestionsForProfile } from './suggestions';

describe('首页选题只用注册资料和已有主题', () => {
  it('没填资料时不编一条建议', () => {
    expect(suggestionsForProfile(EMPTY_PROFILE)).toEqual([]);
  });

  it('教育培训、老师、浙江和养生、四川不是同一句', () => {
    const edu = suggestionsForProfile({ ...EMPTY_PROFILE, industry: '教育培训', jobRole: '老师', province: '浙江' });
    const health = suggestionsForProfile({ ...EMPTY_PROFILE, industry: '养生', province: '四川' });
    expect(edu[0].title).toContain('教育培训');
    expect(edu[0].title).toContain('浙江');
    expect(edu[0].reason).toContain('老师');
    expect(health[0].title).not.toBe(edu[0].title);
    expect(health.some((item) => item.library === 'rule-topics' && item.title.includes('健康食品宣传'))).toBe(true);
    expect(edu.concat(health).every((item) => !/热搜|全网趋势|爆款预测/.test(`${item.title}${item.reason}`))).toBe(true);
  });

  it('岗位「学生」对上规则库里已有的未成年人主题，不另造趋势', () => {
    const items = suggestionsForProfile({ ...EMPTY_PROFILE, jobRole: '学生' });
    expect(items.map((item) => item.id)).toContain('topic:minors');
    expect(items.find((item) => item.id === 'topic:minors')?.reason).toContain('学生');
  });

  it('待审核列表只用这条内容自己的标题', () => {
    expect(pendingItems([{ id: 'c-1', title: '  寒假班课表  ' }, { id: '', title: '丢掉' }, { title: '无编号' }])).toEqual([
      { id: 'c-1', title: '寒假班课表', href: '/contents?status=pending_review' },
    ]);
    expect(pendingItems([{ id: 'c-2', title: '   ' }])[0].title).toBe('（无标题）');
  });
});
