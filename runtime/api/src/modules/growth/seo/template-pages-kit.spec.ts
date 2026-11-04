import { prepareTemplatePage } from './template-pages.service';

const base = {
  slug: 'case',
  title: '案例',
  body: '【本内容由 AI 生成】\n这是一个工具介绍。',
  facts: [{ claim: '免费版每月 5 条', source_id: 'product-facts' }],
  humanApproved: true,
};
const withClaim = { ...base, body: '【本内容由 AI 生成】\n全网第一的内容工具。' };

describe('增长工具包接入模板页（SEO_PAGES_ENABLED，默认关闭）', () => {
  it('开关关闭时行为不变', () => {
    expect(prepareTemplatePage(base, {}).status).toBe('live');
    expect(prepareTemplatePage(withClaim, {}).status).toBe('live');
    expect(prepareTemplatePage(withClaim, { SEO_PAGES_ENABLED: '0' }).status).toBe('live');
  });

  it('开关打开后，带绝对化用语的页面保持草稿且不记为已批准', () => {
    const page = prepareTemplatePage(withClaim, { SEO_PAGES_ENABLED: '1' });
    expect(page.status).toBe('draft');
    expect(page.humanApproved).toBe(false);
  });

  it('开关打开后，干净页面照常上线', () => {
    expect(prepareTemplatePage(base, { SEO_PAGES_ENABLED: '1' }).status).toBe('live');
  });

  it('未人工批准的页面仍是草稿', () => {
    expect(prepareTemplatePage({ ...base, humanApproved: false }, { SEO_PAGES_ENABLED: '1' }).status).toBe('draft');
  });

  it('默认读 process.env，测试环境未打开', () => {
    expect(process.env.SEO_PAGES_ENABLED).toBeUndefined();
    expect(prepareTemplatePage(withClaim).status).toBe('live');
  });
});
