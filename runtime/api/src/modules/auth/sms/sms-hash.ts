import { createHmac } from 'node:crypto';
import { ConfigService } from '@nestjs/config';

/**
 * 验证码表里手机号、验证码、IP 的哈希。带密钥的 HMAC-SHA256：
 * 只有手机号这类低熵输入，不加密钥的哈希一撞库就还原了。
 * 生产环境必须单独配置 SMS_CODE_HMAC_SECRET，不与 JWT_SECRET 共用；非生产才允许借用 JWT_SECRET。
 * 返回 null 表示没有可用密钥（短信服务未配置）。
 */
export function smsHmacSecret(config: Pick<ConfigService, 'get'>): string | null {
  const dedicated = String(config.get('SMS_CODE_HMAC_SECRET', '') ?? '');
  const production = config.get('NODE_ENV') === 'production';
  const value = dedicated || (production ? '' : String(config.get('JWT_SECRET', '') ?? ''));
  return value.length >= 16 ? value : null;
}

export function smsHmac(secret: string, scope: string, value: string): string {
  return createHmac('sha256', secret).update(`${scope}:${value}`).digest('hex');
}

export function smsPhoneHash(secret: string, phone: string): string {
  return smsHmac(secret, 'phone', phone);
}
