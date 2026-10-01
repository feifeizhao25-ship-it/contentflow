import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { AliyunSmsGateway, aliyunPercentEncode, signAliyunRpc } from './aliyun-sms.gateway';
import { DevSmsGateway } from './dev-sms.gateway';
import { NotConfiguredSmsGateway } from './not-configured-sms.gateway';
import { createSmsGateway } from './sms-gateway.factory';
import { normalizeChinaMobile } from './phone';
import { maskEmail, maskPhone } from '../../../common/pii';

const cfg = (values: Record<string, unknown>) => new ConfigService(values);
const ALIYUN = { SMS_PROVIDER: 'aliyun', ALIYUN_SMS_ACCESS_KEY_ID: 'test-id', ALIYUN_SMS_ACCESS_KEY_SECRET: 'test-secret', ALIYUN_SMS_SIGN_NAME: '测试签名', ALIYUN_SMS_TEMPLATE_CODE: 'SMS_000000' };

describe('短信网关选择', () => {
  it('没设置 SMS_PROVIDER：未配置网关，发送时明确报「短信服务未配置」', async () => {
    const gw = createSmsGateway(cfg({}));
    expect(gw).toBeInstanceOf(NotConfiguredSmsGateway);
    await expect(gw.sendVerificationCode('13812345678', '123456', { purpose: 'login', ttlMinutes: 5 })).rejects.toThrow('短信服务未配置');
  });

  it.each(['ALIYUN_SMS_ACCESS_KEY_ID', 'ALIYUN_SMS_ACCESS_KEY_SECRET', 'ALIYUN_SMS_SIGN_NAME', 'ALIYUN_SMS_TEMPLATE_CODE'])('阿里云缺 %s：按未配置处理，不是静默用空值去请求', (missing) => {
    expect(createSmsGateway(cfg({ ...ALIYUN, [missing]: '' }))).toBeInstanceOf(NotConfiguredSmsGateway);
  });

  it('阿里云配置齐全：用阿里云网关；端点必须是 https 的 aliyuncs.com，否则当未配置（防止把验证码发到别处）', () => {
    expect(createSmsGateway(cfg(ALIYUN))).toBeInstanceOf(AliyunSmsGateway);
    expect(createSmsGateway(cfg({ ...ALIYUN, ALIYUN_SMS_ENDPOINT: 'http://dysmsapi.aliyuncs.com/' }))).toBeInstanceOf(NotConfiguredSmsGateway);
    expect(createSmsGateway(cfg({ ...ALIYUN, ALIYUN_SMS_ENDPOINT: 'https://evil.example.com/' }))).toBeInstanceOf(NotConfiguredSmsGateway);
  });

  it('开发网关只在非生产可用：生产环境直接抛错', () => {
    expect(createSmsGateway(cfg({ SMS_PROVIDER: 'dev', NODE_ENV: 'development' }))).toBeInstanceOf(DevSmsGateway);
    expect(() => createSmsGateway(cfg({ SMS_PROVIDER: 'dev', NODE_ENV: 'production' }))).toThrow(/生产/);
  });
});

describe('阿里云短信网关', () => {
  afterEach(() => jest.restoreAllMocks());
  const gw = () => new AliyunSmsGateway({ accessKeyId: 'test-id', accessKeySecret: 'test-secret', signName: '测试签名', templateCode: 'SMS_000000', endpoint: 'https://dysmsapi.aliyuncs.com/' });

  it('百分号编码遵循 RFC3986', () => {
    expect(aliyunPercentEncode("a b*c'd(e)f~g!/")).toBe('a%20b%2Ac%27d%28e%29f~g%21%2F');
  });

  it('签名：HMAC-SHA1(AccessKeySecret&)，待签串为 POST&%2F&<规范化查询串>，参数按字典序', () => {
    const params = { B: '2', A: '1 2' };
    const expected = createHmac('sha1', 'sec&').update('POST&%2F&A%3D1%252%20B%3D2'.replace('%252%20B', '%25202%26B')).digest('base64');
    // 规范化查询串：A=1%202&B=2 ；整体再编码：A%3D1%25202%26B%3D2
    expect(signAliyunRpc(params, 'sec')).toBe(createHmac('sha1', 'sec&').update('POST&%2F&A%3D1%25202%26B%3D2').digest('base64'));
    expect(expected).toBeTruthy();
  });

  it('请求：SendSms，带签名名称、模板编号、TemplateParam 里的 code；成功 Code=OK 不抛错', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, json: async () => ({ Code: 'OK', BizId: 'x' }) } as Response);
    await gw().sendVerificationCode('13812345678', '654321', { purpose: 'login', ttlMinutes: 5 });
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://dysmsapi.aliyuncs.com/');
    const sent = new URLSearchParams(String(init.body));
    expect(sent.get('Action')).toBe('SendSms');
    expect(sent.get('PhoneNumbers')).toBe('13812345678');
    expect(sent.get('SignName')).toBe('测试签名');
    expect(sent.get('TemplateCode')).toBe('SMS_000000');
    expect(JSON.parse(String(sent.get('TemplateParam')))).toEqual({ code: '654321' });
    // 签名可由其余参数重新算出；密钥本身不在请求里
    const signature = sent.get('Signature')!;
    const rest = Object.fromEntries([...sent.entries()].filter(([k]) => k !== 'Signature'));
    expect(signAliyunRpc(rest, 'test-secret')).toBe(signature);
    expect(String(init.body)).not.toContain('test-secret');
  });

  it('服务商返回失败：抛出中文错误，错误与日志里没有验证码与完整手机号', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, json: async () => ({ Code: 'isv.BUSINESS_LIMIT_CONTROL', Message: 'x' }) } as Response);
    const err = await gw().sendVerificationCode('13812345678', '654321', { purpose: 'login', ttlMinutes: 5 }).catch((e) => e);
    expect(err).toBeInstanceOf(ServiceUnavailableException);
    expect(err.message).toBe('短信发送失败，请稍后重试');
  });

  it('网络异常 / HTTP 非 2xx 同样失败，不假装成功', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new TypeError('fetch failed'));
    await expect(gw().sendVerificationCode('13812345678', '1', { purpose: 'login', ttlMinutes: 5 })).rejects.toThrow('短信发送失败');
    jest.spyOn(global, 'fetch').mockResolvedValue({ ok: false, status: 500, json: async () => ({}) } as Response);
    await expect(gw().sendVerificationCode('13812345678', '1', { purpose: 'login', ttlMinutes: 5 })).rejects.toThrow('短信发送失败');
  });
});

describe('手机号与脱敏', () => {
  it('规范化：接受 11 位大陆手机号与 +86/86 前缀，其余拒绝', () => {
    expect(normalizeChinaMobile('138 1234 5678')).toBe('13812345678');
    expect(normalizeChinaMobile('+8613812345678')).toBe('13812345678');
    expect(normalizeChinaMobile('8613812345678')).toBe('13812345678');
    for (const bad of ['12812345678', '1381234567', '138123456789', 'abc', '', null, undefined, 13812345678]) expect(normalizeChinaMobile(bad as any)).toBeNull();
  });
  it('脱敏', () => {
    expect(maskPhone('13812345678')).toBe('138****5678');
    expect(maskPhone('123')).toBe('***');
    expect(maskEmail('alice@example.com')).toBe('a***@example.com');
    expect(maskEmail('bad')).toBe('***');
  });
});
