import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { ContentPackService } from './content-pack.service';
import { ResourceType } from '../system/usage.service';
import { AI_TEXT_LABEL } from '../../common/ai-content-label';

describe('ContentPackService token accounting', () => {
  const ai = {
    generateTitlesWithUsage: jest.fn(),
    generateText: jest.fn(),
  };
  const usage = {
    checkQuota: jest.fn(),
    trackUsage: jest.fn(),
  };
  const compliance = { scrubOutput: jest.fn() };
  const rag = { select: jest.fn(), buildContext: jest.fn() };
  let service: ContentPackService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ContentPackService(ai as any, usage as any, compliance as any, rag as any);
    usage.checkQuota.mockResolvedValue(true);
    compliance.scrubOutput.mockImplementation(async (value: string) => value);
    rag.select.mockResolvedValue([]);
    rag.buildContext.mockReturnValue('');
  });

  it('charges the provider-reported title and script tokens', async () => {
    ai.generateTitlesWithUsage.mockResolvedValue({
      titles: ['A title'],
      usage: { prompt_tokens: 50, completion_tokens: 70, total_tokens: 120 },
    });
    ai.generateText.mockResolvedValue({
      content: 'A script',
      usage: { prompt_tokens: 80, completion_tokens: 120, total_tokens: 200 },
    });

    const result = await service.generatePack('tenant-1', {
      topic: 'Topic',
      platforms: ['xhs'],
    });

    expect(usage.trackUsage).toHaveBeenCalledWith(
      'tenant-1',
      ResourceType.TOKENS,
      320,
      expect.objectContaining({ type: 'content_pack' }),
    );
    expect(result.data.metadata.usage.tokens).toBe(320);
  });

  it('labels the script as AI-generated and attaches media metadata', async () => {
    ai.generateTitlesWithUsage.mockResolvedValue({
      titles: ['A title'],
      usage: { prompt_tokens: 50, completion_tokens: 70, total_tokens: 120 },
    });
    ai.generateText.mockResolvedValue({
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
    ai.generateText.mockResolvedValue({
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
    ai.generateText.mockResolvedValue({ content: 'A script', usage: { prompt_tokens: 2, completion_tokens: 2, total_tokens: 4 } });
    const result = await service.generatePack('tenant-1', { topic: 'Topic', platforms: ['douyin'] });
    expect(ai.generateText).toHaveBeenCalledWith(expect.objectContaining({ prompt: expect.stringContaining('[1] 官方规则') }));
    expect(result.data.sources).toEqual([source]);
    expect(result.data.sources_status).toBe('verified');
  });

  it('fails closed when the provider omits usable token accounting', async () => {
    ai.generateTitlesWithUsage.mockResolvedValue({
      titles: ['A title'],
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    });
    ai.generateText.mockResolvedValue({
      content: 'A script',
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    });

    await expect(
      service.generatePack('tenant-1', { topic: 'Topic' }),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
    expect(usage.trackUsage).not.toHaveBeenCalled();
  });

  it('preserves structured compliance rejection and never charges usage', async () => {
    ai.generateTitlesWithUsage.mockResolvedValue({
      titles: ['A title'],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    });
    ai.generateText.mockResolvedValue({
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
    expect(usage.trackUsage).not.toHaveBeenCalled();
  });
});
