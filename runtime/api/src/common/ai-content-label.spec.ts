import {
  AI_TEXT_LABEL,
  AI_GENERATOR_NAME,
  labelAiGeneratedText,
  buildAiMediaMetadata,
  aigcProviderCode,
} from './ai-content-label';

describe('labelAiGeneratedText', () => {
  it('prepends the visible AI label to generated text', () => {
    const labeled = labelAiGeneratedText('正文内容');
    expect(labeled.startsWith(AI_TEXT_LABEL)).toBe(true);
    expect(labeled).toContain('正文内容');
  });

  it('is idempotent — never double-labels', () => {
    const once = labelAiGeneratedText('正文内容');
    expect(labelAiGeneratedText(once)).toBe(once);
  });

  it('still emits the label for empty content', () => {
    expect(labelAiGeneratedText('')).toBe(AI_TEXT_LABEL);
  });
});

describe('buildAiMediaMetadata', () => {
  it('marks media as AI generated with generator and ISO timestamp', () => {
    const meta = buildAiMediaMetadata({
      mediaType: 'video',
      model: 'minimax',
      now: new Date('2026-08-21T00:00:00.000Z'),
    });
    expect(meta.ai_generated).toBe(true);
    expect(meta.generator).toBe(AI_GENERATOR_NAME);
    expect(meta.media_type).toBe('video');
    expect(meta.model).toBe('minimax');
    expect(meta.generated_at).toBe('2026-08-21T00:00:00.000Z');
  });

  it('omits the model field instead of fabricating one', () => {
    const meta = buildAiMediaMetadata({ mediaType: 'image' });
    expect('model' in meta).toBe(false);
  });
});

describe('隐式标识补齐服务提供者编码与内容编号（GB 45438-2025）', () => {
  const previous = process.env.AIGC_PROVIDER_CODE;
  afterEach(() => { if (previous === undefined) delete process.env.AIGC_PROVIDER_CODE; else process.env.AIGC_PROVIDER_CODE = previous; });

  it('provider_code 从环境变量读，content_id 由调用方给', () => {
    process.env.AIGC_PROVIDER_CODE = ' 91110000TEST00000X ';
    const meta = buildAiMediaMetadata({ mediaType: 'image', contentId: 'content-123' });
    expect(meta.provider_code).toBe('91110000TEST00000X');
    expect(meta.content_id).toBe('content-123');
  });

  it('未配置时为空字符串，不编造；字段始终存在', () => {
    delete process.env.AIGC_PROVIDER_CODE;
    const meta = buildAiMediaMetadata({ mediaType: 'text' });
    expect(meta).toHaveProperty('provider_code', '');
    expect(meta).toHaveProperty('content_id', '');
    expect(aigcProviderCode({} as NodeJS.ProcessEnv)).toBe('');
  });
});
