import { chooseTitle } from './bandit.service';
import { assignArm } from '../improvement/canary';
import { resolveVariation } from './growthbook.client';
import { readFileSync } from 'fs';
import { join } from 'path';
import { pushUrls } from '../seo/baidu-push.service';
import { draftFromNewTerm, prepareTemplatePage } from '../seo/template-pages.service';
import { pullFromProviders, recordObservation } from '../geo/geo-monitor';
import { proposeRuleUpdates } from '../../ai/knowledge-improvement/weekly';
import { proposePromptBump } from '../../ai/prompts/evolve';

describe('外部集成默认关闭', () => {
  it('GrowthBook 未配置时不请求网络', async () => {
    const fetchImpl = jest.fn();
    const result = await resolveVariation('pricing-hero', '对照文案', { env: {}, fetchImpl });
    expect(result).toEqual({ value: '对照文案', source: 'default' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('标题实验的对照永远用第一个候选', () => {
    const variants = [
      { id: 'control-title', wins: 0, trials: 10 },
      { id: 'new-title', wins: 10, trials: 10 },
    ];
    const controlId = Array.from({ length: 50 }, (_, i) => `subject-${i}`).find((id) => assignArm(id) === 'control');
    expect(controlId).toBeTruthy();
    expect(chooseTitle(variants, controlId as string, () => 0.99)).toEqual({ id: 'control-title', arm: 'control' });
  });

  it('百度推送未配置时不请求，源码不写死 token', async () => {
    const fetchImpl = jest.fn();
    expect(await pushUrls(['https://example.com/a'], {}, fetchImpl)).toEqual({ pushed: false, reason: '百度普通收录未配置' });
    expect(fetchImpl).not.toHaveBeenCalled();
    const source = readFileSync(join(__dirname, '../seo/baidu-push.service.ts'), 'utf8');
    expect(source).not.toMatch(/BAIDU_PUSH_TOKEN\s*=\s*['"][^'"]+['"]/);
  });

  it('模板页和新词默认是草稿', () => {
    expect(prepareTemplatePage({
      slug: 'case',
      title: '案例',
      body: '【本内容由 AI 生成】\n请人工确认后发布。',
      facts: [{ claim: '免费版每月 5 条', source_id: 'product-facts' }],
      humanApproved: false,
    }).status).toBe('draft');
    expect(draftFromNewTerm('视频号新规则').status).toBe('draft');
  });

  it('GEO 默认不记录，也不抓取', () => {
    expect(recordObservation({ week: '2026-W43', platform: 'doubao', surface: 'app', query: '分发侠', cited: false }).stored).toBe(false);
    expect(() => pullFromProviders()).toThrow('不主动抓取');
  });

  it('规则提案和提示升级都要人批，且不带出租户编号', () => {
    const proposal = proposeRuleUpdates([
      { tenantId: 'secret-tenant', platform: 'xhs', code: 'A06' },
      { tenantId: 'secret-tenant', platform: 'xhs', code: 'A06' },
    ]);
    expect(proposal.autoApplied).toBe(false);
    expect(proposal.needsHumanApproval).toBe(true);
    expect(JSON.stringify(proposal)).not.toContain('secret-tenant');
    expect(proposePromptBump('0.1.0', '评测上升').autoPromoted).toBe(false);
  });
});
