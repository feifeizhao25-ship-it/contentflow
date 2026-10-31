import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { ContentPackService } from './content-pack.service';
import { AI_TEXT_LABEL } from '../../common/ai-content-label';

describe('ContentPackService token accounting', () => {
  const ai = {
    generateTitlesWithUsage: jest.fn(),
    generateTextForMarket: jest.fn(),
    assertTenantDailyBudget: jest.fn(),
    recordGeneration: jest.fn(),
  };
  const usage: { withAiHold: jest.Mock; last?: { tokens: number; generation?: { userId?: string } | null } } = {
    withAiHold: jest.fn(),
  };
  const compliance = { scrubOutput: jest.fn() };
  const rag = { select: jest.fn(), buildContext: jest.fn() };
  let service: ContentPackService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ContentPackService(ai as any, usage as any, compliance as any, rag as any);
    usage.last = undefined;
    usage.withAiHold.mockImplementation(async (_input: unknown, run: () => Promise<{ tokens: number; generation?: { userId?: string } | null; response: unknown }>) => {
      const produced = await run();
      usage.last = produced;
      return produced.response;
    });
    compliance.scrubOutput.mockImplementation(async (value: string) => value);
    rag.select.mockResolvedValue([]);
    rag.buildContext.mockReturnValue('');
  });

  it.each([undefined, 0, -1, 0.5, NaN, Infinity, '10'])('rejects invalid title usage %s before generating the body', async (total) => {
    ai.generateTitlesWithUsage.mockResolvedValue({ titles: ['标题'], usage: { total_tokens: total } });
    ai.generateTextForMarket.mockResolvedValue({ content: '正文', usage: { total_tokens: 100 } });
    await expect(service.generatePack('tenant-1', { topic: '主题' }, 'user-1')).rejects.toBeInstanceOf(InternalServerErrorException);
    expect(ai.generateTextForMarket).not.toHaveBeenCalled();
    expect(usage.last).toBeUndefined();
    expect(ai.recordGeneration).not.toHaveBeenCalled();
  });

  it.each([undefined, 0, -1, 0.5, NaN, Infinity, '10'])('rejects invalid body usage %s even when combined usage would look valid', async (total) => {
    ai.generateTitlesWithUsage.mockResolvedValue({ titles: ['标题'], usage: { total_tokens: 100 } });
    ai.generateTextForMarket.mockResolvedValue({ content: '正文', usage: { total_tokens: total } });
    await expect(service.generatePack('tenant-1', { topic: '主题' }, 'user-1')).rejects.toBeInstanceOf(InternalServerErrorException);
    expect(usage.last).toBeUndefined();
    expect(ai.recordGeneration).not.toHaveBeenCalled();
  });

  it.each(['', '   ', null, 123])('rejects empty or malformed body %s without charging', async (content) => {
    ai.generateTitlesWithUsage.mockResolvedValue({ titles: ['标题'], usage: { total_tokens: 2 } });
    ai.generateTextForMarket.mockResolvedValue({ content, usage: { total_tokens: 4 } });
    await expect(service.generatePack('tenant-1', { topic: '主题' }, 'user-1')).rejects.toBeInstanceOf(InternalServerErrorException);
    expect(usage.last).toBeUndefined();
    expect(ai.recordGeneration).not.toHaveBeenCalled();
  });

  it('rejects a body emptied by compliance processing before adding the AI label', async () => {
    ai.generateTitlesWithUsage.mockResolvedValue({ titles: ['标题'], usage: { total_tokens: 2 } });
    ai.generateTextForMarket.mockResolvedValue({ content: '正文', usage: { total_tokens: 4 } });
    compliance.scrubOutput.mockResolvedValue('  ');
    await expect(service.generatePack('tenant-1', { topic: '主题' }, 'user-1')).rejects.toBeInstanceOf(InternalServerErrorException);
    expect(usage.last).toBeUndefined();
  });

  it.each([undefined, [], [' '], [12]].map(titles => [titles]))('rejects missing or malformed titles %s', async (titles) => {
    ai.generateTitlesWithUsage.mockResolvedValue({ titles, usage: { total_tokens: 2 } });
    await expect(service.generatePack('tenant-1', { topic: '主题' })).rejects.toBeInstanceOf(InternalServerErrorException);
    expect(ai.generateTextForMarket).not.toHaveBeenCalled();
    expect(usage.last).toBeUndefined();
  });

  it('charges the provider-reported title and script tokens', async () => {
    ai.generateTitlesWithUsage.mockResolvedValue({
      titles: ['A title'],
      usage: { prompt_tokens: 50, completion_tokens: 70, total_tokens: 120 },
    });
    ai.generateTextForMarket.mockResolvedValue({
      content: 'A script',
      usage: { prompt_tokens: 80, completion_tokens: 120, total_tokens: 200 },
    });

    const result = await service.generatePack('tenant-1', {
      topic: 'Topic',
      platforms: ['xhs'],
    });

    expect(usage.withAiHold).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-1', holdTokens: 10000, kind: 'content_pack' }),
      expect.any(Function),
    );
    expect(usage.last?.tokens).toBe(320);
    expect(result.data.metadata.usage.tokens).toBe(320);
  });

  it('labels the script as AI-generated and attaches media metadata', async () => {
    ai.generateTitlesWithUsage.mockResolvedValue({
      titles: ['A title'],
      usage: { prompt_tokens: 50, completion_tokens: 70, total_tokens: 120 },
    });
    ai.generateTextForMarket.mockResolvedValue({
      content: 'A script',
      usage: { prompt_tokens: 80, completion_tokens: 120, total_tokens: 200 },
    });

    const result = await service.generatePack('tenant-1', { topic: 'Topic' });

    expect(result.data.script.startsWith(AI_TEXT_LABEL)).toBe(true);
    expect(result.data.script).toContain('A script');
    expect(result.data.metadata.ai_content).toEqual(
      expect.objectContaining({ ai_generated: true, media_type: 'text' }),
    );
  });

  it('declares an explicit empty sources block instead of fabricating citations', async () => {
    ai.generateTitlesWithUsage.mockResolvedValue({
      titles: ['A title'],
      usage: { prompt_tokens: 50, completion_tokens: 70, total_tokens: 120 },
    });
    ai.generateTextForMarket.mockResolvedValue({
      content: 'A script',
      usage: { prompt_tokens: 80, completion_tokens: 120, total_tokens: 200 },
    });

    const result = await service.generatePack('tenant-1', { topic: 'Topic' });

    expect(result.data.sources).toEqual([]);
    expect(result.data.sources_status).toBe('none');
    expect(result.data.sources_note).toContain('未引用');
  });

  it('returns only sources that were inserted into the model context', async () => {
    const source = { id: 'official-1', source_url: 'https://example.gov/policy', source_name: '官方规则', published_at: '2025-01-01', retrieved_at: '2026-08-23', jurisdiction: 'CN', source_tier: 'S' };
    rag.select.mockResolvedValue([source]);
    rag.buildContext.mockReturnValue('\n[1] 官方规则');
    ai.generateTitlesWithUsage.mockResolvedValue({ titles: ['A title'], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } });
    ai.generateTextForMarket.mockResolvedValue({ content: 'A script', usage: { prompt_tokens: 2, completion_tokens: 2, total_tokens: 4 } });
    const result = await service.generatePack('tenant-1', { topic: 'Topic', platforms: ['douyin'] });
    expect(ai.generateTextForMarket).toHaveBeenCalledWith(expect.objectContaining({ prompt: expect.stringContaining('[1] 官方规则') }));
    expect(result.data.sources).toEqual([source]);
    expect(result.data.sources_status).toBe('verified');
    expect(result.data.platform_variants.map((item: { platform: string }) => item.platform)).toEqual(['douyin']);
  });

  it('fails closed when the provider omits usable token accounting', async () => {
    ai.generateTitlesWithUsage.mockResolvedValue({
      titles: ['A title'],
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    });
    ai.generateTextForMarket.mockResolvedValue({
      content: 'A script',
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    });

    await expect(
      service.generatePack('tenant-1', { topic: 'Topic' }),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
    expect(usage.last).toBeUndefined();
  });

  it('preserves structured compliance rejection and never charges usage', async () => {
    ai.generateTitlesWithUsage.mockResolvedValue({
      titles: ['A title'],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    });
    ai.generateTextForMarket.mockResolvedValue({
      content: 'blocked content',
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    });
    compliance.scrubOutput.mockRejectedValue(
      new BadRequestException({
        code: 'CONTENT_COMPLIANCE_BLOCKED',
        ruleset_version: 'cn-content-2026.08.30',
      }),
    );

    await expect(
      service.generatePack('tenant-1', { topic: 'Topic' }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'CONTENT_COMPLIANCE_BLOCKED' }),
    });
    expect(usage.last).toBeUndefined();
  });
});

describe('合规资料过期时如实提示', () => {
  it('没有可用资料且资料过期：sources_status=review_required，提示「合规规则资料需要人工复核」', async () => {
    const ai = { assertTenantDailyBudget: jest.fn(), recordGeneration: jest.fn(), generateTitlesWithUsage: jest.fn().mockResolvedValue({ titles: ['T'], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } }), generateTextForMarket: jest.fn().mockResolvedValue({ content: '正文', usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } }) };
    const usage = { withAiHold: jest.fn(async (_input: unknown, run: () => Promise<{ response: unknown }>) => (await run()).response) };
    const rag = { select: jest.fn().mockResolvedValue([]), buildContext: jest.fn().mockReturnValue(''), freshnessReport: jest.fn().mockResolvedValue({ needsReview: true, notice: '合规规则资料需要人工复核：平台规则资料超过 30 天未核对' }) };
    const service = new ContentPackService(ai as any, usage as any, { scrubOutput: async (v: string) => v } as any, rag as any);
    const result = await service.generatePack('t', { topic: '主题' } as any, 'u');
    expect(result.data.sources_status).toBe('review_required');
    expect(result.data.sources_note).toContain('合规规则资料需要人工复核');
  });
});

describe('ContentPackService personalisation, target market and grounding', () => {
  const ai = { generateTitlesWithUsage: jest.fn(), generateTextForMarket: jest.fn(), assertTenantDailyBudget: jest.fn(), recordGeneration: jest.fn() };
  const usage = { withAiHold: jest.fn() };
  const compliance = { scrubOutput: jest.fn(), checkContent: jest.fn() };
  const rag = { select: jest.fn(), buildContext: jest.fn() };
  const prisma = { persona: { findFirst: jest.fn() }, content: { findMany: jest.fn() } };
  const prevRegion = process.env.MARKET_REGION;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.MARKET_REGION = 'global';
    usage.withAiHold.mockImplementation(async (_i: unknown, run: () => Promise<{ response: unknown }>) => (await run()).response);
    ai.generateTitlesWithUsage.mockResolvedValue({ titles: ['Desk setup'], usage: { total_tokens: 10 } });
    ai.generateTextForMarket.mockResolvedValue({ content: 'The AQUAPURE lamp is 24% brighter.', usage: { total_tokens: 20 } });
    compliance.scrubOutput.mockImplementation(async (v: string) => v);
    compliance.checkContent.mockResolvedValue({ level: 'clear', disclaimer: 'd', mode: 'normal', hits: [], hitCounts: { block: 0, review: 0, total: 0 }, rulesChecked: 12, notChecked: ['x'] });
    rag.select.mockResolvedValue([]);
    rag.buildContext.mockReturnValue('');
    prisma.persona.findFirst.mockResolvedValue({ name: 'Desk nerd', description: 'Minimalist desks', config: { tone: 'dry' } });
    prisma.content.findMany.mockResolvedValue([{ title: 'My best title', viral_score: 90 }]);
  });
  afterEach(() => { process.env.MARKET_REGION = prevRegion; });

  const make = () => new ContentPackService(ai as any, usage as any, compliance as any, rag as any, prisma as any);

  it('puts persona + own top titles in the prompts (own tenant only) and reports positioning_used', async () => {
    const out: any = await make().generatePack('t1', { topic: 'desk lamp', personaId: 'p1' }, 'u1');
    expect(prisma.content.findMany.mock.calls[0][0].where.tenant_id).toBe('t1');
    expect(prisma.persona.findFirst.mock.calls[0][0].where.OR).toEqual([{ tenant_id: 't1' }, { is_system: true }]);
    expect(ai.generateTitlesWithUsage.mock.calls[0][3]).toContain('My best title');
    expect(ai.generateTextForMarket.mock.calls[0][0].prompt).toContain('Desk nerd');
    expect(out.data.positioning_used).toEqual({ persona: true, persona_name: 'Desk nerd', top_titles: 1, reference_only: true });
  });

  it('with no persona text and no scored titles the prompts are unchanged and the response says nothing was used', async () => {
    prisma.persona.findFirst.mockResolvedValue(null);
    prisma.content.findMany.mockResolvedValue([]);
    const out: any = await make().generatePack('t1', { topic: 'desk lamp' }, 'u1');
    expect(ai.generateTitlesWithUsage.mock.calls[0]).toHaveLength(3);
    expect(out.data.positioning_used).toEqual({ persona: false, persona_name: null, top_titles: 0, reference_only: true });
  });

  it('a failing positioning lookup does not fail generation', async () => {
    prisma.content.findMany.mockRejectedValue(new Error('db down'));
    const out: any = await make().generatePack('t1', { topic: 'desk lamp' }, 'u1');
    expect(out.success).toBe(true);
    expect(out.data.positioning_used.top_titles).toBe(0);
  });

  it('international: target market adds the disclosure hint and a prompt line; unsupported value is ignored', async () => {
    const out: any = await make().generatePack('t1', { topic: 'desk lamp', targetMarket: 'IN' }, 'u1');
    expect(out.data.target_market).toBe('IN');
    expect(out.data.disclosure_hint.sources[0].url).toMatch(/ascionline/);
    expect(ai.generateTextForMarket.mock.calls[0][0].prompt).toContain('India');
    const none: any = await make().generatePack('t1', { topic: 'desk lamp', targetMarket: 'FR' }, 'u1');
    expect(none.data.target_market).toBeUndefined();
  });

  it('grounds figures/names to the supplied material and flags the rest', async () => {
    const out: any = await make().generatePack('t1', { topic: 'desk lamp', material: 'AQUAPURE datasheet: 24% brighter than v1' }, 'u1');
    expect(ai.generateTextForMarket.mock.calls[0][0].prompt).toContain('AQUAPURE datasheet');
    expect(out.data.grounding.material_supplied).toBe(true);
    expect(out.data.grounding.supported_by_material).toEqual(['24%', 'AQUAPURE']);
    expect(out.data.grounding.unverified).toEqual([]);
    const without: any = await make().generatePack('t1', { topic: 'desk lamp' }, 'u1');
    expect(without.data.grounding.unverified).toEqual(['24%', 'AQUAPURE']);
  });

  it('compliance block carries counts, rules run and not-checked items', async () => {
    const out: any = await make().generatePack('t1', { topic: 'desk lamp' }, 'u1');
    expect(out.data.compliance.hit_counts).toEqual({ block: 0, review: 0, total: 0 });
    expect(out.data.compliance.rules_checked).toBe(12);
    expect(out.data.compliance.not_checked).toEqual(['x']);
  });
});
