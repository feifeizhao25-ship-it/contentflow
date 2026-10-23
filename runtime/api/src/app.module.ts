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

/**
 * 短信服务：可以不配（发送时明确报「短信服务未配置」），但不能配错——
 *   - SMS_PROVIDER=dev 是固定验证码的开发实现，生产环境禁止；
 *   - 选了 aliyun 就要配全，且验证码哈希密钥单独配置、不与 JWT_SECRET 相同。
 */
function validateSmsConfig(config: Record<string, unknown>) {
  const provider = String(config.SMS_PROVIDER ?? '').trim().toLowerCase();
  if (!provider) return;
  if (provider === 'dev') throw new Error('SMS_PROVIDER=dev 只能用于开发环境，生产环境禁止使用');
  if (provider !== 'aliyun') throw new Error(`SMS_PROVIDER 只支持 aliyun（收到：${provider}）`);
  const missing = [
    'ALIYUN_SMS_ACCESS_KEY_ID', 'ALIYUN_SMS_ACCESS_KEY_SECRET', 'ALIYUN_SMS_SIGN_NAME',
    'ALIYUN_SMS_TEMPLATE_CODE', 'SMS_CODE_HMAC_SECRET',
  ].filter((key) => !config[key]);
  if (missing.length) throw new Error(`SMS_PROVIDER=aliyun requires: ${missing.join(', ')}`);
  if (String(config.SMS_CODE_HMAC_SECRET).length < 32) throw new Error('SMS_CODE_HMAC_SECRET must contain at least 32 characters');
  if (config.SMS_CODE_HMAC_SECRET === config.JWT_SECRET) throw new Error('SMS_CODE_HMAC_SECRET 不得与 JWT_SECRET 相同');
}

export function validateProductionConfig(config: Record<string, unknown>) {
  if (config.NODE_ENV !== 'production') return config;
  validateSmsConfig(config);
  const required = [
    'DATABASE_URL', 'REDIS_HOST', 'JWT_SECRET', 'JWT_REFRESH_SECRET',
    'MARKET_REGION', 'CORS_ORIGIN', 'PUBLISH_DISPATCH_WEBHOOK_URL',
    'PUBLISH_DISPATCH_WEBHOOK_SECRET',
  ];
  if (config.MARKET_REGION === 'global') required.push('OPENROUTER_SITE_URL');
  const missing = required.filter((key) => !config[key]);
  if (missing.length) {
    throw new Error(`Missing required production environment variables: ${missing.join(', ')}`);
  }
  for (const key of ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'PUBLISH_DISPATCH_WEBHOOK_SECRET']) {
    if (String(config[key]).length < 32) throw new Error(`${key} must contain at least 32 characters`);
  }
  if (!String(config.PUBLISH_DISPATCH_WEBHOOK_URL).startsWith('https://')) {
    throw new Error('PUBLISH_DISPATCH_WEBHOOK_URL must use HTTPS');
  }
  if (!['cn', 'global'].includes(String(config.MARKET_REGION))) {
    throw new Error('MARKET_REGION must be either cn or global');
  }
  const webhookKey = String(config.WEBHOOK_ENCRYPTION_KEY ?? '').trim();
  if (webhookKey && !/^[0-9a-fA-F]{64}$/.test(webhookKey)) {
    throw new Error('WEBHOOK_ENCRYPTION_KEY must be 64 hex characters');
  }
  const origins = String(config.CORS_ORIGIN).split(',').map((value) => value.trim());
  if (origins.some((origin) => !origin.startsWith('https://') || origin.includes('*'))) {
    throw new Error('CORS_ORIGIN must contain explicit HTTPS origins without wildcards');
  }
  return config;
}

const DOMESTIC_ONLY_MODULES = [
  HotModule, CompetitorModule, GrowthModule, PointsModule,
  RewardsModule, QuestModule, AchievementModule,
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
      validate: validateProductionConfig,
    }),
    
    // 限流保护。@nestjs/throttler v5 起 ttl 的单位是**毫秒**：原来写的 60 是 60 毫秒，
    // 即每个地址每 60ms 可以 100 次——等于没有限流（登录可以随便撞库）。
    // 按地址计数依赖 bootstrap.ts 里的 trust proxy，否则所有人都算成 web-cn 一个地址。
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 100, // 每个客户端地址每分钟 100 次
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
