import { createHmac, randomUUID } from 'node:crypto';
import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { maskPhone } from '../../../common/pii';
import { SmsGateway, SmsPurpose } from './sms.types';

export interface AliyunSmsConfig {
  accessKeyId: string;
  accessKeySecret: string;
  signName: string;
  templateCode: string;
  endpoint: string;
}

/** 阿里云 RPC 风格签名要求的百分号编码（RFC 3986：除 A-Za-z0-9-_.~ 外全部编码）。 */
export function aliyunPercentEncode(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

/** 阿里云 RPC 签名（HMAC-SHA1，密钥为 AccessKeySecret + '&'）。 */
export function signAliyunRpc(params: Record<string, string>, accessKeySecret: string, method = 'POST'): string {
  const canonical = Object.keys(params)
    .sort()
    .map((key) => `${aliyunPercentEncode(key)}=${aliyunPercentEncode(params[key])}`)
    .join('&');
  const stringToSign = `${method}&${aliyunPercentEncode('/')}&${aliyunPercentEncode(canonical)}`;
  return createHmac('sha1', `${accessKeySecret}&`).update(stringToSign).digest('base64');
}

/**
 * 阿里云短信（Dysms SendSms，版本 2017-05-25）。
 * 密钥、签名名称、模板编号全部来自环境变量，见 sms-gateway.factory.ts。
 * 只访问 *.aliyuncs.com 的 https 地址（境内服务商）。
 */
export class AliyunSmsGateway implements SmsGateway {
  readonly name = 'aliyun';
  private readonly logger = new Logger(AliyunSmsGateway.name);

  constructor(private readonly config: AliyunSmsConfig) {}

  async sendVerificationCode(phone: string, code: string, _ctx: { purpose: SmsPurpose; ttlMinutes: number }): Promise<void> {
    const params: Record<string, string> = {
      AccessKeyId: this.config.accessKeyId,
      Action: 'SendSms',
      Format: 'JSON',
      PhoneNumbers: phone,
      SignName: this.config.signName,
      SignatureMethod: 'HMAC-SHA1',
      SignatureNonce: randomUUID(),
      SignatureVersion: '1.0',
      TemplateCode: this.config.templateCode,
      TemplateParam: JSON.stringify({ code }),
      Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
      Version: '2017-05-25',
    };
    params.Signature = signAliyunRpc(params, this.config.accessKeySecret);
    const body = Object.keys(params).map((k) => `${aliyunPercentEncode(k)}=${aliyunPercentEncode(params[k])}`).join('&');

    let result: { Code?: string; Message?: string } = {};
    try {
      const response = await fetch(this.config.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        signal: AbortSignal.timeout(10_000),
      });
      result = (await response.json().catch(() => ({}))) as typeof result;
      if (!response.ok) result = { Code: `HTTP_${response.status}` };
    } catch {
      this.logger.error(`短信发送失败（网络）：${maskPhone(phone)}`);
      throw new ServiceUnavailableException('短信发送失败，请稍后重试');
    }
    if (result.Code !== 'OK') {
      // 只记录服务商返回的错误码，不记录验证码、不记录完整手机号
      this.logger.error(`短信发送失败：${maskPhone(phone)} 服务商返回 ${String(result.Code ?? '无响应')}`);
      throw new ServiceUnavailableException('短信发送失败，请稍后重试');
    }
  }
}
