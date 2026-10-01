import { ConfigService } from '@nestjs/config';
import { AliyunSmsGateway } from './aliyun-sms.gateway';
import { DevSmsGateway } from './dev-sms.gateway';
import { NotConfiguredSmsGateway } from './not-configured-sms.gateway';
import { SmsGateway } from './sms.types';

const DEFAULT_ALIYUN_ENDPOINT = 'https://dysmsapi.aliyuncs.com/';

/**
 * 按环境变量选择短信服务：
 *   SMS_PROVIDER=aliyun  需要 ALIYUN_SMS_ACCESS_KEY_ID / ALIYUN_SMS_ACCESS_KEY_SECRET /
 *                        ALIYUN_SMS_SIGN_NAME / ALIYUN_SMS_TEMPLATE_CODE（模板变量名为 code）
 *   SMS_PROVIDER=dev     固定验证码的测试实现，禁止在生产使用
 *   未设置 / 配置不全    NotConfigured：发送时明确报「短信服务未配置」
 */
export function createSmsGateway(config: ConfigService): SmsGateway {
  const provider = String(config.get('SMS_PROVIDER', '') ?? '').trim().toLowerCase();
  const production = config.get('NODE_ENV') === 'production';
  if (provider === 'dev') {
    if (production) throw new Error('SMS_PROVIDER=dev 只能用于开发环境，生产环境禁止使用');
    return new DevSmsGateway();
  }
  if (provider === 'aliyun') {
    const accessKeyId = String(config.get('ALIYUN_SMS_ACCESS_KEY_ID', '') ?? '');
    const accessKeySecret = String(config.get('ALIYUN_SMS_ACCESS_KEY_SECRET', '') ?? '');
    const signName = String(config.get('ALIYUN_SMS_SIGN_NAME', '') ?? '');
    const templateCode = String(config.get('ALIYUN_SMS_TEMPLATE_CODE', '') ?? '');
    const endpoint = String(config.get('ALIYUN_SMS_ENDPOINT', DEFAULT_ALIYUN_ENDPOINT) || DEFAULT_ALIYUN_ENDPOINT);
    if (!accessKeyId || !accessKeySecret || !signName || !templateCode) return new NotConfiguredSmsGateway();
    let url: URL;
    try { url = new URL(endpoint); } catch { return new NotConfiguredSmsGateway(); }
    if (url.protocol !== 'https:' || !url.hostname.endsWith('.aliyuncs.com')) return new NotConfiguredSmsGateway();
    return new AliyunSmsGateway({ accessKeyId, accessKeySecret, signName, templateCode, endpoint });
  }
  return new NotConfiguredSmsGateway();
}
