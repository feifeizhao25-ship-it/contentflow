import { Logger } from '@nestjs/common';
import { maskPhone } from '../../../common/pii';
import { SmsGateway } from './sms.types';

/**
 * 开发 / 测试用：不发送任何短信，验证码固定为 123456。
 * 绝不能进入生产：工厂在 NODE_ENV=production 时拒绝创建，启动配置校验也会拒绝 SMS_PROVIDER=dev。
 */
export class DevSmsGateway implements SmsGateway {
  readonly name = 'dev';
  readonly fixedCodeForTesting = '123456';
  private readonly logger = new Logger(DevSmsGateway.name);

  async sendVerificationCode(phone: string): Promise<void> {
    this.logger.warn(`[开发环境] 未真实发送短信：${maskPhone(phone)}，验证码固定为 ${this.fixedCodeForTesting}`);
  }
}
