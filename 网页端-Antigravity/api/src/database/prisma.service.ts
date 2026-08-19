import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private isConnected = false;
  mockMode = false;

  constructor() {
    super({
      log: process.env.NODE_ENV === 'development'
        ? ['error', 'warn']
        : ['error'],
      errorFormat: 'pretty',
    });

    // 立即初始化 mockMode 避免异步竞争
    this.mockMode = process.env.USE_MOCK_DB === 'true' ||
      process.env.DATABASE_URL?.includes('placeholder') ||
      !process.env.DATABASE_URL ||
      process.env.DATABASE_URL?.includes('localhost:5432');

    if (this.mockMode) {
      this.logger.warn('🔶 Constructor: Initialized in Mock Mode');
      return new Proxy(this, {
        get: (target: any, prop: string) => {
          // List of properties we MUST keep real for NestJS/Prisma lifecycle
          const realProps = ['logger', 'mockMode', 'onModuleInit', 'onModuleDestroy', '$connect', '$disconnect', 'isConnected', 'createMockModel'];
          if (realProps.includes(prop) || typeof prop === 'symbol') {
            return target[prop];
          }

          // Everything else (like user, userPoints, aiGeneration) gets a mock model
          this.logger.debug(`🔮 Intercepting and Mocking: ${String(prop)}`);
          return target.createMockModel(String(prop));
        }
      });
    }
  }

  private createMockModel(modelName: string) {
    const handleMockResult = (method: string, args: any) => {
      this.logger.log(`🏗️ Mock ${modelName}.${method} called`);

      const rawData = args[0]?.data || args[0]?.update || {};
      const resolvedData = { ...rawData };
      for (const key in resolvedData) {
        if (resolvedData[key] && typeof resolvedData[key] === 'object') {
          if ('increment' in resolvedData[key]) resolvedData[key] = 1000 + (resolvedData[key] as any).increment;
          if ('decrement' in resolvedData[key]) resolvedData[key] = 1000 - (resolvedData[key] as any).decrement;
        }
      }

      // Special cases for specific models
      if (modelName === 'account' && method === 'findMany') {
        return [
          { id: 'mock-acc-1', platform: 'xhs', name: '王小红 (演示)', avatar: '📕', status: 'active' },
          { id: 'mock-acc-2', platform: 'douyin', name: '内容专家 (演示)', avatar: '🎵', status: 'active' },
        ];
      }

      // Return reasonable defaults based on method
      if (method.startsWith('findMany')) return [];
      if (method.startsWith('find')) return { id: `mock-${modelName}-id`, name: '演示数据', balance: 9999, level: 5 };
      if (method.startsWith('create')) return { id: `mock-${modelName}-id`, ...resolvedData };
      if (method.startsWith('update')) return { id: `mock-${modelName}-id`, ...resolvedData };
      if (method.startsWith('count')) return 0;
      if (method.startsWith('upsert')) return { id: `mock-${modelName}-id`, ...resolvedData };

      return { success: true };
    };

    return new Proxy({}, {
      get: (_, method: string) => {
        return (...args: any[]) => Promise.resolve(handleMockResult(method, args));
      }
    });
  }

  async onModuleInit() {
    const useMockDb = process.env.USE_MOCK_DB === 'true' ||
      process.env.DATABASE_URL?.includes('placeholder') ||
      !process.env.DATABASE_URL ||
      process.env.DATABASE_URL?.includes('localhost:5432');

    if (useMockDb) {
      this.mockMode = true;
      this.logger.warn('🔶 使用开发模式 - 数据库操作将被模拟（Mock）');
      this.logger.warn('🔶 如需使用真实数据库，请配置正确的 DATABASE_URL');
      this.isConnected = true;
      return;
    }

    try {
      await this.$connect();
      this.logger.log('✅ Database connection established');
      this.isConnected = true;
    } catch (error) {
      this.logger.error('❌ Database connection failed:', error instanceof Error ? error.message : 'Unknown error');
      this.logger.warn('🔶 切换到开发模式（Mock）...');
      this.mockMode = true;
      this.isConnected = true;
    }
  }

  async onModuleDestroy() {
    if (!this.mockMode && this.isConnected) {
      await this.$disconnect();
      this.logger.log('Database connection closed');
    }
  }
}
