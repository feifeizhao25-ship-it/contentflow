import {
  AI_TEXT_LABEL,
  AI_GENERATOR_NAME,
  labelAiGeneratedText,
  buildAiMediaMetadata,
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
