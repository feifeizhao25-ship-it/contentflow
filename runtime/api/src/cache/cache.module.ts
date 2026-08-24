import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CacheService } from './cache.service';
import Redis from 'ioredis';

export function resolveRedisMode(config: {
  nodeEnv?: string;
  redisHost?: string;
  useMockRedis?: string;
}): 'mock' | 'redis' {
  const production = config.nodeEnv === 'production';
  const mockRequested = config.useMockRedis === 'true';
  if (production && (mockRequested || !config.redisHost)) {
    throw new Error(
      'Production requires REDIS_HOST and forbids USE_MOCK_REDIS=true',
    );
  }
  return !production && (mockRequested || !config.redisHost) ? 'mock' : 'redis';
}

// Mock Redis 客户端（开发模式使用）
class MockRedis {
  private data = new Map<string, any>();
  
  async get(key: string): Promise<string | null> {
    return this.data.get(key) || null;
  }
  
  async set(key: string, value: string): Promise<string> {
    this.data.set(key, value);
    return 'OK';
  }
  
  async setex(key: string, seconds: number, value: string): Promise<string> {
    this.data.set(key, value);
    return 'OK';
  }
  
  async del(key: string): Promise<number> {
    const existed = this.data.has(key);
    this.data.delete(key);
    return existed ? 1 : 0;
  }
  
  async incr(key: string): Promise<number> {
    const val = parseInt(this.data.get(key) || '0', 10) + 1;
    this.data.set(key, val.toString());
    return val;
  }
  
  async expire(key: string, seconds: number): Promise<number> {
    return this.data.has(key) ? 1 : 0;
  }
  
  async hset(key: string, field: string, value: string): Promise<number> {
    const hash = this.data.get(key) || {};
    hash[field] = value;
    this.data.set(key, hash);
    return 1;
  }
  
  async hget(key: string, field: string): Promise<string | null> {
    const hash = this.data.get(key) || {};
    return hash[field] || null;
  }
  
  async hgetall(key: string): Promise<Record<string, string>> {
    return this.data.get(key) || {};
  }
  
  async lpush(key: string, ...values: string[]): Promise<number> {
    const list = this.data.get(key) || [];
    this.data.set(key, [...values.reverse(), ...list]);
    return this.data.get(key).length;
  }
  
  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    const list = this.data.get(key) || [];
    return list.slice(start, stop === -1 ? undefined : stop + 1);
  }
  
  async publish(channel: string, message: string): Promise<number> {
    return 0;
  }
  
  async eval(script: string, numKeys: number, ...args: string[]): Promise<any> {
    return 0;
  }
  
  on(event: string, callback: (err: Error) => void): void {
    // Mock - no-op
  }
}

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: 'REDIS_CLIENT',
      useFactory: async (configService: ConfigService) => {
        const redisHost = configService.get<string>('REDIS_HOST');
        const redisMode = resolveRedisMode({
          nodeEnv: configService.get('NODE_ENV'),
          redisHost,
          useMockRedis: configService.get('USE_MOCK_REDIS'),
        });
        if (redisMode === 'mock') {
          console.warn('🔶 使用开发模式 - Redis 操作将被模拟（Mock）');
          console.warn('🔶 配置真实的 REDIS_HOST 以连接真实 Redis');
          return new MockRedis() as any;
        }
        
        const client = new Redis({
          host: redisHost || 'localhost',
          port: configService.get('REDIS_PORT', 6379),
          password: configService.get('REDIS_PASSWORD') || undefined,
          db: configService.get('REDIS_DB', 0),
          maxRetriesPerRequest: 3,
        });

        client.on('error', (err) => {
          console.error('Redis connection error:', err);
        });

        client.on('connect', () => {
          console.log('✅ Redis connected');
        });

        return client;
      },
      inject: [ConfigService],
    },
    CacheService,
  ],
  exports: [CacheService, 'REDIS_CLIENT'],
})
export class CacheModule {}
