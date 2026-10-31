import { BadGatewayException } from '@nestjs/common';
import { AIService } from './ai.service';
import { ContentPackService } from './content-pack.service';
import { adaptBodyForPlatform } from './platform-adaptation';
import { RagPolicyService } from './rag-policy.service';
import { AI_TEXT_LABEL, AI_TEXT_LABEL_EN, aiTextLabel, labelAiGeneratedText } from '../../common/ai-content-label';
import { containsCjk } from '../../common/interceptors/transform.interceptor';
import { parseGeneratedTitles } from './title-parser';

const usage = (n: number) => ({ prompt_tokens: n, completion_tokens: n, total_tokens: 2 * n });
const answer = (content: string, n = 1) => ({ content, model: 'm', provider: 'p', latency_ms: 5, cost_amount: 0.01, usage: usage(n) });

describe('International edition: English-only generation', () => {
  const previous = process.env.MARKET_REGION;
  afterEach(() => { process.env.MARKET_REGION = previous; });

  it('the AI label follows the market and is never added twice', () => {
    process.env.MARKET_REGION = 'global';
    expect(aiTextLabel()).toBe(AI_TEXT_LABEL_EN);
    expect(containsCjk(aiTextLabel())).toBe(false);
    const once = labelAiGeneratedText('Hello');
    expect(once.startsWith(AI_TEXT_LABEL_EN)).toBe(true);
    expect(labelAiGeneratedText(once)).toBe(once);
    expect(labelAiGeneratedText(`${AI_TEXT_LABEL}\nold`)).toBe(`${AI_TEXT_LABEL}\nold`); // content labelled before the switch
    process.env.MARKET_REGION = 'cn';
    expect(aiTextLabel()).toBe(AI_TEXT_LABEL);
  });

  describe('generateTextForMarket', () => {
    const make = () => {
      const config = { get: (_k: string, d?: unknown) => (_k === 'MARKET_REGION' ? 'global' : d) };
      const service = new AIService({} as never, config as never);
      const generateText = jest.fn();
      (service as any).generateText = generateText;
      return { service, generateText };
    };

    it('retries once in English when the model answers in Chinese, and adds up the usage', async () => {
      process.env.MARKET_REGION = 'global';
      const { service, generateText } = make();
      generateText.mockResolvedValueOnce(answer('这是中文回答', 3)).mockResolvedValueOnce(answer('An English answer', 4));
      const result = await service.generateTextForMarket({ prompt: 'Write a post', userText: 'coffee' });
      expect(result.content).toBe('An English answer');
      expect(generateText).toHaveBeenCalledTimes(2);
      expect(generateText.mock.calls[1][0].prompt).toContain('English only');
      expect(result.usage.total_tokens).toBe(14);
      expect(result.cost_amount).toBeCloseTo(0.02);
    });

    it('fails with 502 and an English message when the retry is still Chinese', async () => {
      process.env.MARKET_REGION = 'global';
      const { service, generateText } = make();
      generateText.mockResolvedValue(answer('还是中文'));
      const error: any = await service.generateTextForMarket({ prompt: 'x', userText: 'coffee' }).catch((e) => e);
      expect(error).toBeInstanceOf(BadGatewayException);
      expect(containsCjk(error.getResponse())).toBe(false);
      expect(generateText).toHaveBeenCalledTimes(2);
    });

    it('does not retry when the user wrote Chinese themselves, or on the domestic edition', async () => {
      process.env.MARKET_REGION = 'global';
      const a = make();
      a.generateText.mockResolvedValue(answer('中文内容'));
      await a.service.generateTextForMarket({ prompt: 'x', userText: '咖啡' });
      expect(a.generateText).toHaveBeenCalledTimes(1);
      process.env.MARKET_REGION = 'cn';
      const b = make();
      b.generateText.mockResolvedValue(answer('中文内容'));
      await b.service.generateTextForMarket({ prompt: 'x', userText: 'coffee' });
      expect(b.generateText).toHaveBeenCalledTimes(1);
    });

    it('asks for English titles and articles', async () => {
      process.env.MARKET_REGION = 'global';
      const { service, generateText } = make();
      generateText.mockResolvedValue(answer('Slow mornings, better coffee\nFive cafés worth the detour'));
      const titles = await service.generateTitlesWithUsage('coffee', 'instagram', 2);
      expect(titles.titles).toHaveLength(2);
      expect(generateText.mock.calls[0][0].prompt).not.toMatch(/[\u3400-\u9fff]/);
      generateText.mockResolvedValue(answer('Body text\n---\nprompt one\nprompt two'));
      await service.generateArticle({ topic: 'coffee', style: 'friendly', platform: 'tiktok' });
      const prompt = generateText.mock.calls[1][0].prompt as string;
      expect(prompt).not.toMatch(/[\u3400-\u9fff]/);
      expect(prompt).toContain('TikTok');
    });
  });

  it('script and viral-analysis prompts are English in the international edition', async () => {
    process.env.MARKET_REGION = 'global';
    const config = { get: (k: string, d?: unknown) => (k === 'MARKET_REGION' ? 'global' : d) };
    const service = new AIService({} as never, config as never);
    const generateText = jest.fn().mockResolvedValue(answer('{"title":"Slow mornings","scenes":[{"visual":"Sunlit kitchen","subtitle":"Start slow","time":6}]}'));
    (service as any).generateText = generateText;
    await service.generateScript({ topic: 'coffee' });
    expect(generateText.mock.calls[0][0].prompt).not.toMatch(/[\u3400-\u9fff]/);
    generateText.mockResolvedValue(answer('{"hook":"strong"}'));
    await service.analyzeViralContent('Some English post');
    expect(generateText.mock.calls[1][0].prompt).not.toMatch(/[\u3400-\u9fff]/);
  });

  it('English headlines up to 90 characters and English preambles are handled', () => {
    const long = 'The quiet case for slow mornings: how a ten-minute routine changed my whole week';
    expect(parseGeneratedTitles(`Here are 2 headlines:\n1. ${long}\n2. Short and sweet\nHope these help!`, 5)).toEqual([long, 'Short and sweet']);
  });

  it('platform variants for international platforms are English', () => {
    process.env.MARKET_REGION = 'global';
    const out = adaptBodyForPlatform(`${AI_TEXT_LABEL_EN}\nA long enough body about coffee.`, 'tiktok', 'coffee');
    expect(containsCjk(out)).toBe(false);
    expect(out.hashtags).toContain('#AIGenerated');
    expect(out.body.startsWith(AI_TEXT_LABEL_EN)).toBe(true);
  });

  it('content pack answers contain no Chinese: label, sources note, variants', async () => {
    process.env.MARKET_REGION = 'global';
    const ai = {
      assertTenantDailyBudget: jest.fn(),
      generateTitlesWithUsage: jest.fn().mockResolvedValue({ titles: ['Slow mornings'], usage: usage(1), cost_amount: 0 }),
      generateTextForMarket: jest.fn().mockResolvedValue(answer('A short script about slow mornings.')),
    };
    const usageSvc = { withAiHold: jest.fn(async (_i: unknown, run: () => Promise<{ response: unknown }>) => (await run()).response) };
    const compliance = { scrubOutput: jest.fn(async (v: string) => v), checkContent: jest.fn().mockResolvedValue({ level: 'ok', disclaimer: 'Not legal advice.', mode: 'normal', hits: [] }) };
    const rag = new RagPolicyService({ get: () => undefined } as never);
    jest.spyOn(rag, 'select').mockResolvedValue([]);
    jest.spyOn(rag, 'freshnessReport').mockResolvedValue({ maxAgeDays: 90, total: 0, current: 0, needsReview: true, mode: 'conservative', generationAvailable: true, notice: 'Compliance sources need a human review', userNotice: null, sources: [] } as never);
    const service = new ContentPackService(ai as never, usageSvc as never, compliance as never, rag as never);
    const res: any = await service.generatePack('t1', { topic: 'coffee', platforms: ['tiktok', 'instagram'] } as never, 'u1');
    const leaks = JSON.stringify(res).match(/"[^"]*[\u3400-\u9fff][^"]*"/g);
    expect(leaks).toBeNull();
    expect(res.data.script.startsWith(AI_TEXT_LABEL_EN)).toBe(true);
    expect(res.data.sources_note).toMatch(/draft|source/i);
    expect(ai.generateTextForMarket.mock.calls[0][0].prompt).toContain('English only');
  });
});
