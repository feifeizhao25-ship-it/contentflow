import { AIService } from './ai.service';
import { checkGeneratedTitles } from './title-compliance';

function service(env: Record<string, unknown>) {
  const config = { get: jest.fn((key: string, fallback: unknown) => (key in env ? env[key] : fallback)) };
  return new AIService({} as never, config as never);
}

describe('checkGeneratedTitles', () => {
  const previousPreview = process.env.COMPLIANCE_CANDIDATE_RULES;
  afterEach(() => {
    if (previousPreview === undefined) delete process.env.COMPLIANCE_CANDIDATE_RULES;
    else process.env.COMPLIANCE_CANDIDATE_RULES = previousPreview;
  });

  it('鼻炎根治？标为违规，普通标题标为未发现，站外导流标为需复核', () => {
    const [risky, plain, offsite] = checkGeneratedTitles(['鼻炎根治？', '秋季护理笔记', '加微信领资料']);
    expect(risky).toMatchObject({ statusLabel: '违规', level: 'violation', passed: false });
    expect(risky.hits.map((hit) => hit.ruleId)).toContain('CN-INDUSTRY-001');
    expect(plain).toMatchObject({ statusLabel: '未发现', level: 'clear', passed: true, hits: [] });
    expect(offsite).toMatchObject({ statusLabel: '需复核', level: 'risk', passed: true });
  });

  it('预览开关打开时，标题里的「预防感冒」标为需复核；关闭时未发现', () => {
    delete process.env.COMPLIANCE_CANDIDATE_RULES;
    expect(checkGeneratedTitles(['预防感冒'])[0].statusLabel).toBe('未发现');
    process.env.COMPLIANCE_CANDIDATE_RULES = 'preview';
    const flagged = checkGeneratedTitles(['预防感冒'])[0];
    expect(flagged.statusLabel).toBe('需复核');
    expect(flagged.hits.map((hit) => hit.ruleId)).toContain('CN-CAND-FOOD-DISEASE');
    expect(flagged.passed).toBe(true);
  });
});

describe('generateTitlesWithUsage 数量、包装和逐条合规', () => {
  const previousRegion = process.env.MARKET_REGION;

  afterEach(() => {
    if (previousRegion === undefined) delete process.env.MARKET_REGION;
    else process.env.MARKET_REGION = previousRegion;
  });

  it('主题要求 5 个标题时丢掉包装行，只返回 5 条，并为「鼻炎根治？」附上违规', async () => {
    process.env.MARKET_REGION = 'cn';
    const svc = service({ MARKET_REGION: 'cn', QWEN_API_KEY: 'qk' });
    const raw = [
      '6个小红书爆款标题',
      '鼻炎根治？',
      '秋季护理笔记',
      '温差大怎么护肤',
      '出门记得围巾',
      '睡前热牛奶',
      '多喝水',
    ].join('\n');
    jest.spyOn(svc, 'generateTextForMarket').mockResolvedValue({
      content: raw,
      usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 },
      model: 'qwen-flash',
      provider: 'qwen',
      latency_ms: 1,
      cost_amount: 0,
    });

    const result = await svc.generateTitlesWithUsage('请给我5个标题', 'xhs', 6);
    expect(svc.generateTextForMarket).toHaveBeenCalledWith(expect.objectContaining({
      prompt: expect.stringContaining('生成5个'),
    }));
    expect(result.titles).toEqual(['鼻炎根治？', '秋季护理笔记', '温差大怎么护肤', '出门记得围巾', '睡前热牛奶']);
    expect(result.titles).not.toContain('6个小红书爆款标题');
    expect(result.titles).not.toContain('多喝水');
    expect(result.titleCompliance?.map((item) => item.statusLabel)).toEqual([
      '违规', '未发现', '未发现', '未发现', '未发现',
    ]);
    expect(result.titleCompliance?.[0].hits.map((hit) => hit.ruleId)).toContain('CN-INDUSTRY-001');
  });

  it('国际版不附中文标题合规状态', async () => {
    process.env.MARKET_REGION = 'global';
    const svc = service({ MARKET_REGION: 'global' });
    jest.spyOn(svc, 'generateTextForMarket').mockResolvedValue({
      content: 'Slow mornings\nFive cafés',
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      model: 'm',
      provider: 'openrouter',
      latency_ms: 1,
      cost_amount: 0,
    });
    const result = await svc.generateTitlesWithUsage('coffee', 'instagram', 2);
    expect(result.titles).toEqual(['Slow mornings', 'Five cafés']);
    expect(result.titleCompliance).toBeUndefined();
  });
});
