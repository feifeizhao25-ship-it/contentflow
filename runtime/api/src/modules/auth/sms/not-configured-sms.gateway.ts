import { ServiceUnavailableException } from '@nestjs/common';
import { SmsGateway } from './sms.types';

/** 没有配置短信服务时的实现：明确报「未配置」，绝不假装发送成功。 */
export class NotConfiguredSmsGateway implements SmsGateway {
  readonly name = 'not-configured';
  async sendVerificationCode(): Promise<void> {
    throw new ServiceUnavailableException('短信服务未配置，暂时无法发送验证码');
  }
}
