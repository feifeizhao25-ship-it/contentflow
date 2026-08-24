import { AchievementModule } from './modules/achievement/achievement.module';
import { CompetitorModule } from './modules/competitor/competitor.module';
import { GrowthModule } from './modules/growth/growth.module';
import { HotModule } from './modules/hot/hot.module';
import { PointsModule } from './modules/points/points.module';
import { QuestModule } from './modules/quest/quest.module';
import { RewardsModule } from './modules/rewards/rewards.module';
import { marketModulesFor, validateProductionConfig } from './app.module';

describe('market module isolation', () => {
  const domesticModules = [
    HotModule,
    CompetitorModule,
    GrowthModule,
    PointsModule,
    RewardsModule,
    QuestModule,
    AchievementModule,
  ];

  it('does not register domestic-only controllers in the global API', () => {
    expect(marketModulesFor('global')).toEqual([]);
  });

  it('keeps domestic-only controllers available in the CN API', () => {
    expect(marketModulesFor('cn')).toEqual(domesticModules);
  });

  it('fails safely toward the existing CN surface outside production', () => {
    expect(marketModulesFor(undefined)).toEqual(domesticModules);
  });
});

describe('production configuration', () => {
  const valid = {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://db',
    REDIS_HOST: 'redis',
    JWT_SECRET: 'a'.repeat(32),
    JWT_REFRESH_SECRET: 'b'.repeat(32),
    MARKET_REGION: 'global',
    CORS_ORIGIN: 'https://contentflow.example.com',
    OPENROUTER_SITE_URL: 'https://contentflow.example.com',
    PUBLISH_DISPATCH_WEBHOOK_URL: 'https://automation.contentflow.example.com/publish',
    PUBLISH_DISPATCH_WEBHOOK_SECRET: 'c'.repeat(32),
  };

  it('accepts an explicit global production origin', () => {
    expect(validateProductionConfig(valid)).toEqual(valid);
  });

  it('rejects missing or wildcard production origins', () => {
    expect(() => validateProductionConfig({ ...valid, CORS_ORIGIN: '' })).toThrow('CORS_ORIGIN');
    expect(() => validateProductionConfig({ ...valid, CORS_ORIGIN: 'https://*.example.com' })).toThrow('wildcards');
  });

  it('rejects an unencrypted or missing publishing dispatcher', () => {
    expect(() => validateProductionConfig({ ...valid, PUBLISH_DISPATCH_WEBHOOK_URL: 'http://automation.local/publish' })).toThrow('HTTPS');
    expect(() => validateProductionConfig({ ...valid, PUBLISH_DISPATCH_WEBHOOK_SECRET: '' })).toThrow('PUBLISH_DISPATCH_WEBHOOK_SECRET');
  });
});
