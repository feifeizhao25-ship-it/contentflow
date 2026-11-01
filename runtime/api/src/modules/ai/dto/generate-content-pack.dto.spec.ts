import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { GenerateContentPackDto } from './generate-content-pack.dto';

const errorsFor = async (body: Record<string, unknown>) =>
  validate(plainToInstance(GenerateContentPackDto, body), { whitelist: true, forbidNonWhitelisted: true });

describe('GenerateContentPackDto', () => {
  it('accepts the optional title count the apps send (it used to be rejected with a 400)', async () => {
    expect(await errorsFor({ topic: 'Autumn latte launch', count: 5, platforms: ['instagram'] })).toHaveLength(0);
  });
  it('still works without a count', async () => {
    expect(await errorsFor({ topic: 'Autumn latte launch' })).toHaveLength(0);
  });
  it('rejects counts outside 1-10 and unknown fields', async () => {
    expect((await errorsFor({ topic: 'x topic', count: 0 })).length).toBeGreaterThan(0);
    expect((await errorsFor({ topic: 'x topic', count: 11 })).length).toBeGreaterThan(0);
    expect((await errorsFor({ topic: 'x topic', surprise: 1 })).length).toBeGreaterThan(0);
  });

  // 复测 B15：国际版 targetMarket 只接受大写，'uk' / 'us' 会 400。
  describe('targetMarket is case-insensitive', () => {
    it.each(['us', 'Uk', ' in ', 'sg', 'US'])('accepts %j and normalises it to upper case', async (m) => {
      const dto = plainToInstance(GenerateContentPackDto, { topic: 'x', targetMarket: m });
      expect(await validate(dto, { whitelist: true, forbidNonWhitelisted: true })).toHaveLength(0);
      expect(dto.targetMarket).toBe(m.trim().toUpperCase());
    });
    it('treats an empty value as "no market chosen" (generic wording), not an error', async () => {
      expect(await errorsFor({ topic: 'x', targetMarket: '' })).toHaveLength(0);
    });
    it.each(['other', 'OTHER', ' Other '])('B15: accepts %j for creators in any other country (general guidance)', async (m) => {
      const dto = plainToInstance(GenerateContentPackDto, { topic: 'x', targetMarket: m });
      expect(await validate(dto, { whitelist: true, forbidNonWhitelisted: true })).toHaveLength(0);
      expect(dto.targetMarket).toBe('OTHER');
    });
    it('still rejects markets that have no sourced hint', async () => {
      expect(await errorsFor({ topic: 'x', targetMarket: 'sea' })).toHaveLength(1);
      expect(await errorsFor({ topic: 'x', targetMarket: 'CN' })).toHaveLength(1);
    });
  });
});
