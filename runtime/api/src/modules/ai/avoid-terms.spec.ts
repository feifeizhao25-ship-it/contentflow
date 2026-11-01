import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { GenerateContentPackDto } from './dto/generate-content-pack.dto';
import { avoidTermsPromptBlock, sanitizeAvoidTerms } from './avoid-terms';

describe('B28 avoidTerms (rewrite-and-retry after a compliance block)', () => {
  it('keeps clean, unique, short terms and drops junk', () => {
    expect(sanitizeAvoidTerms(['最佳', ' 国家级 ', '最佳', '', 12, null, 'x'.repeat(21), '「引号」\n'])).toEqual(['最佳', '国家级', '引号']);
    expect(sanitizeAvoidTerms('最佳')).toEqual([]);
    expect(sanitizeAvoidTerms(Array.from({ length: 30 }, (_, i) => `词${i}`))).toHaveLength(12);
  });

  it('writes the terms into a Chinese or English prompt line, and nothing when empty', () => {
    expect(avoidTermsPromptBlock(['最佳', '国家级'], false)).toContain('「最佳」、「国家级」');
    expect(avoidTermsPromptBlock(['best ever'], true)).toContain('"best ever"');
    expect(avoidTermsPromptBlock([], false)).toBe('');
  });

  it('the generate DTO accepts avoidTerms and rejects too many or too long ones', async () => {
    const ok = plainToInstance(GenerateContentPackDto, { topic: 't', avoidTerms: ['最佳'] });
    expect(await validate(ok)).toHaveLength(0);
    const many = plainToInstance(GenerateContentPackDto, { topic: 't', avoidTerms: Array.from({ length: 13 }, () => 'a') });
    expect((await validate(many)).map((e) => e.property)).toContain('avoidTerms');
    const long = plainToInstance(GenerateContentPackDto, { topic: 't', avoidTerms: ['x'.repeat(21)] });
    expect((await validate(long)).map((e) => e.property)).toContain('avoidTerms');
  });
});
