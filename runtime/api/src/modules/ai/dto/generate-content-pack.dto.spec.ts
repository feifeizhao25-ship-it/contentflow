import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { GenerateContentPackDto } from './generate-content-pack.dto';

describe('GenerateContentPackDto accepts what the apps send', () => {
  const check = (body: object) => validate(plainToInstance(GenerateContentPackDto, body), { whitelist: true, forbidNonWhitelisted: true });

  it('the app payload {topic, count} is accepted (it used to be a 400)', async () => {
    expect(await check({ topic: 'desk setup', count: 5 })).toHaveLength(0);
  });
  it('rejects an out-of-range count and unknown fields', async () => {
    expect(await check({ topic: 'x', count: 99 })).not.toHaveLength(0);
    expect(await check({ topic: 'x', surprise: 1 })).not.toHaveLength(0);
  });
});
