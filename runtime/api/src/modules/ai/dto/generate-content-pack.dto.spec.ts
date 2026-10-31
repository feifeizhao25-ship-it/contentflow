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
});
