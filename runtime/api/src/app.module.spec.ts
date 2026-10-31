import { AchievementModule } from './modules/achievement/achievement.module';
import { CompetitorModule } from './modules/competitor/competitor.module';
import { GrowthModule } from './modules/growth/growth.module';
import { SelfImproveModule } from './modules/growth/self-improve/self-improve.module';
import { HotModule } from './modules/hot/hot.module';
import { LibraryModule } from './modules/library/library.module';
import { PointsModule } from './modules/points/points.module';
import { QuestModule } from './modules/quest/quest.module';
import { RewardsModule } from './modules/rewards/rewards.module';
import { marketModulesFor, validateProductionConfig } from './app.module';

describe('market module isolation', () => {
  const domesticModules = [
    HotModule,
    CompetitorModule,
    GrowthModule,
    SelfImproveModule,
    LibraryModule,
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

  it('rejects a malformed webhook encryption key and allows it to be unset', () => {
    expect(validateProductionConfig(valid).WEBHOOK_ENCRYPTION_KEY).toBeUndefined();
    expect(() => validateProductionConfig({ ...valid, WEBHOOK_ENCRYPTION_KEY: 'short' })).toThrow('WEBHOOK_ENCRYPTION_KEY');
    expect(validateProductionConfig({ ...valid, WEBHOOK_ENCRYPTION_KEY: 'a'.repeat(64) }).WEBHOOK_ENCRYPTION_KEY).toBe('a'.repeat(64));
  });

  it('rejects an unencrypted or missing publishing dispatcher', () => {
    expect(() => validateProductionConfig({ ...valid, PUBLISH_DISPATCH_WEBHOOK_URL: 'http://automation.local/publish' })).toThrow('HTTPS');
    expect(() => validateProductionConfig({ ...valid, PUBLISH_DISPATCH_WEBHOOK_SECRET: '' })).toThrow('PUBLISH_DISPATCH_WEBHOOK_SECRET');
  });

  describe('短信服务配置', () => {
    const aliyun = {
      ...valid,
      SMS_PROVIDER: 'aliyun',
      SMS_CODE_HMAC_SECRET: 'd'.repeat(32),
      ALIYUN_SMS_ACCESS_KEY_ID: 'id',
      ALIYUN_SMS_ACCESS_KEY_SECRET: 'secret',
      ALIYUN_SMS_SIGN_NAME: '签名',
      ALIYUN_SMS_TEMPLATE_CODE: 'SMS_000',
    };

    it('不配短信服务也能启动（发送时明确报「短信服务未配置」，而不是启动失败）', () => {
      expect(validateProductionConfig(valid)).toEqual(valid);
    });

    it('生产环境禁止开发用的固定验证码实现（SMS_PROVIDER=dev）', () => {
      expect(() => validateProductionConfig({ ...valid, SMS_PROVIDER: 'dev' })).toThrow('SMS_PROVIDER=dev');
      expect(() => validateProductionConfig({ ...valid, SMS_PROVIDER: ' DEV ' })).toThrow('SMS_PROVIDER=dev');
    });

    it('非生产环境允许 dev', () => {
      const dev = { NODE_ENV: 'development', SMS_PROVIDER: 'dev' };
      expect(validateProductionConfig(dev)).toEqual(dev);
    });

    it('选了阿里云就必须配全：密钥、签名、模板、验证码哈希密钥（≥32 位）', () => {
      expect(validateProductionConfig(aliyun)).toEqual(aliyun);
      for (const key of ['ALIYUN_SMS_ACCESS_KEY_ID', 'ALIYUN_SMS_ACCESS_KEY_SECRET', 'ALIYUN_SMS_SIGN_NAME', 'ALIYUN_SMS_TEMPLATE_CODE', 'SMS_CODE_HMAC_SECRET']) {
        expect(() => validateProductionConfig({ ...aliyun, [key]: '' })).toThrow(key);
      }
      expect(() => validateProductionConfig({ ...aliyun, SMS_CODE_HMAC_SECRET: 'short' })).toThrow('at least 32');
    });

    it('验证码哈希密钥不得与 JWT_SECRET 相同（一把泄露不能连带另一把）', () => {
      expect(() => validateProductionConfig({ ...aliyun, SMS_CODE_HMAC_SECRET: valid.JWT_SECRET })).toThrow('SMS_CODE_HMAC_SECRET');
    });

    it('不认识的 SMS_PROVIDER 值直接拒绝（拼错了不能悄悄变成未配置）', () => {
      expect(() => validateProductionConfig({ ...valid, SMS_PROVIDER: 'aliyunn' })).toThrow('SMS_PROVIDER');
    });
  });
});
