import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

// Database
import { DatabaseModule } from './database/database.module';

// Queue
import { QueueModule } from './queue/queue.module';

// Cache
import { CacheModule } from './cache/cache.module';

// Common
import { RequestLoggerMiddleware } from './common/middleware/request-logger.middleware';

// Auth Module
import { AuthModule } from './modules/auth/auth.module';

// User Module
import { UserModule } from './modules/user/user.module';

// Tenant Module
import { TenantModule } from './modules/tenant/tenant.module';

// Content Module
import { ContentModule } from './modules/content/content.module';

// Account Module
import { AccountModule } from './modules/account/account.module';

// Publish Module
import { PublishModule } from './modules/publish/publish.module';

// Billing Module
import { BillingModule } from './modules/billing/billing.module';

// AI Module
import { AIModule } from './modules/ai/ai.module';

// Analytics Module
import { AnalyticsModule } from './modules/analytics/analytics.module';

// Hot Module
import { HotModule } from './modules/hot/hot.module';

// Competitor Module
import { CompetitorModule } from './modules/competitor/competitor.module';

// Team Module
import { TeamModule } from './modules/team/team.module';

// Materials Module
import { MaterialsModule } from './modules/materials/materials.module';

// Growth Module (Phase 4)
import { GrowthModule } from './modules/growth/growth.module';

// Points Module (V1)
import { PointsModule } from './modules/points/points.module';

// Rewards Module (V1)
import { RewardsModule } from './modules/rewards/rewards.module';

// Quest Module (V1)
import { QuestModule } from './modules/quest/quest.module';

// Achievement Module (V1)
import { AchievementModule } from './modules/achievement/achievement.module';
import { SystemModule } from './modules/system/system.module';

const DOMESTIC_ONLY_MODULES = [
  HotModule,
  CompetitorModule,
  GrowthModule,
  PointsModule,
  RewardsModule,
  QuestModule,
  AchievementModule,
];

export function marketModulesFor(region: string | undefined) {
  return region === 'global' ? [] : DOMESTIC_ONLY_MODULES;
}

@Module({
  imports: [
    // 配置模块
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      validate: (config: Record<string, unknown>) => {
        if (config.NODE_ENV === 'production') {
          const required = ['DATABASE_URL', 'REDIS_HOST', 'JWT_SECRET', 'JWT_REFRESH_SECRET', 'MARKET_REGION'];
          const missing = required.filter((key) => !config[key]);
          if (missing.length > 0) {
            throw new Error(`Missing required production environment variables: ${missing.join(', ')}`);
          }
          for (const key of ['JWT_SECRET', 'JWT_REFRESH_SECRET']) {
            if (String(config[key]).length < 32) {
              throw new Error(`${key} must contain at least 32 characters`);
            }
          }
          if (!['cn', 'global'].includes(String(config.MARKET_REGION))) {
            throw new Error('MARKET_REGION must be either cn or global');
          }
        }
        return config;
      },
    }),
    
    // 限流保护
    ThrottlerModule.forRoot([
      {
        ttl: 60,
        limit: 100, // 每分钟100次请求
      },
    ]),
    
    // 数据库模块
    DatabaseModule,
    
    // 队列模块
    QueueModule,
    
    // 缓存模块
    CacheModule,
    
    // 业务模块
    AuthModule,
    UserModule,
    TenantModule,
    ContentModule,
    AccountModule,
    PublishModule,
    BillingModule,
    AIModule,
    AnalyticsModule,
    TeamModule,
    MaterialsModule,
    ...marketModulesFor(process.env.MARKET_REGION),
    SystemModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggerMiddleware).forRoutes('*');
  }
}
