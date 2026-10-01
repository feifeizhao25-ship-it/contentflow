import { ServiceUnavailableException } from '@nestjs/common';

/**
 * 实名认证（公安 / 运营商二要素核验）的可替换接口。
 *
 * 这是外部资质：需要有资质的核验服务商与合同，代码层不能伪造。目前只有「未接入」实现；
 * 接入时再写一个实现（成功后由实现所在的服务把 User.real_name_verified 置为 true，
 * 此外没有任何代码可以写这个字段），并在 AuthModule 里替换 REAL_NAME_VERIFIER。
 *
 * 身份证号属于敏感个人信息：接入时必须在界面上单独告知并单独同意，核验后不落库明文，日志不得记录。
 */
export interface RealNameVerifier {
  readonly name: string;
  verify(input: { realName: string; idNumber: string; phone: string }): Promise<{ verified: boolean }>;
}

export const REAL_NAME_VERIFIER = 'REAL_NAME_VERIFIER';

export class NotConfiguredRealNameVerifier implements RealNameVerifier {
  readonly name = 'not-configured';

  async verify(_input: { realName: string; idNumber: string; phone: string }): Promise<{ verified: boolean }> {
    throw new ServiceUnavailableException('实名认证服务未接入，暂时无法完成实名认证');
  }
}

/** REAL_NAME_REQUIRED_FOR_PUBLISH：true / 1（不分大小写与空格）为打开，默认关闭。 */
export function isRealNameRequiredForPublish(value: unknown): boolean {
  const v = String(value ?? '').trim().toLowerCase();
  return v === 'true' || v === '1';
}
