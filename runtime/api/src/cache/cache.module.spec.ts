import { resolveRedisMode } from './cache.module';

describe('Redis production mode contract', () => {
  it('allows an in-memory mock only outside production', () => {
    expect(resolveRedisMode({ nodeEnv: 'development' })).toBe('mock');
    expect(resolveRedisMode({ nodeEnv: 'test', useMockRedis: 'true' })).toBe('mock');
  });

  it('requires a real Redis host in production', () => {
    expect(() => resolveRedisMode({ nodeEnv: 'production' })).toThrow(
      'Production requires REDIS_HOST',
    );
    expect(() =>
      resolveRedisMode({
        nodeEnv: 'production',
        redisHost: 'redis',
        useMockRedis: 'true',
      }),
    ).toThrow('forbids USE_MOCK_REDIS=true');
  });

  it('uses Redis when production configuration is explicit', () => {
    expect(
      resolveRedisMode({ nodeEnv: 'production', redisHost: 'redis' }),
    ).toBe('redis');
  });
});
