/** 短信服务的可替换接口：换服务商只需要再写一个实现并在 sms-gateway.factory.ts 登记。 */
export type SmsPurpose = 'register' | 'login' | 'bind';

export interface SmsGateway {
  /** 供日志与配置识别：aliyun / dev / not-configured */
  readonly name: string;
  /**
   * 仅开发环境的测试实现提供：固定验证码。生产环境即使实现提供了也不会被使用。
   */
  readonly fixedCodeForTesting?: string;
  /** 发送验证码短信。失败必须抛出，不得假装成功。 */
  sendVerificationCode(phone: string, code: string, ctx: { purpose: SmsPurpose; ttlMinutes: number }): Promise<void>;
}

export const SMS_GATEWAY = 'SMS_GATEWAY';
