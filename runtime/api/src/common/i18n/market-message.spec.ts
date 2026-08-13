import { validate } from 'class-validator';
import { LoginDto } from '../../modules/auth/dto/login.dto';
import { defaultTenantSettings } from './market-message';

describe('market-specific validation messages', () => {
  afterEach(() => {
    delete process.env.MARKET_REGION;
  });

  it('returns English-only validation text for the global API', async () => {
    process.env.MARKET_REGION = 'global';
    const dto = Object.assign(new LoginDto(), { email: 'invalid', password: '' });
    const messages = (await validate(dto)).flatMap((error) => Object.values(error.constraints ?? {}));

    expect(messages).toContain('Enter a valid email address');
    expect(messages.join(' ')).not.toMatch(/[\u3400-\u9fff]/);
  });

  it('keeps Chinese validation text in the domestic API', async () => {
    process.env.MARKET_REGION = 'cn';
    const dto = Object.assign(new LoginDto(), { email: 'invalid', password: '' });
    const messages = (await validate(dto)).flatMap((error) => Object.values(error.constraints ?? {}));

    expect(messages).toContain('请输入有效的邮箱地址');
  });

  it('uses neutral international defaults for global workspaces', () => {
    expect(defaultTenantSettings(true)).toEqual({
      timezone: 'UTC',
      language: 'en',
      notification_email: true,
    });
    expect(JSON.stringify(defaultTenantSettings(true))).not.toMatch(/[\u3400-\u9fff]/);
  });
});
