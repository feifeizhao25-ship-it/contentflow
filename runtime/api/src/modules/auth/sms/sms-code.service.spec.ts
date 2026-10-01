/**
 * 短信验证码：限频、限次数、有过期、一次性、只存哈希、手机号不进日志。
 * 用内存实现的 store（保持与数据库一致的原子语义）+ 可控的网关，不需要数据库。
 */
import { ConfigService } from '@nestjs/config';
import { BadRequestException, HttpException, Logger, ServiceUnavailableException } from '@nestjs/common';
import { SmsCodeService } from './sms-code.service';
import { MemoryStore } from './memory-sms-code-store.testing';
import { SmsGateway } from './sms.types';
import { DevSmsGateway } from './dev-sms.gateway';
import { NotConfiguredSmsGateway } from './not-configured-sms.gateway';

describe('SmsCodeService', () => {
  const PHONE = '13812345678';
  let now: Date;
  let store: MemoryStore;
  let sent: Array<{ phone: string; code: string }>;
  let gateway: SmsGateway;
  const cfg = (extra: Record<string, unknown> = {}) => new ConfigService({ NODE_ENV: 'test', JWT_SECRET: 'j'.repeat(40), SMS_CODE_HMAC_SECRET: 's'.repeat(40), ...extra });
  const make = (extra: Record<string, unknown> = {}, gw: SmsGateway = gateway) => new SmsCodeService(store, gw, cfg(extra), () => now);
  const advance = (ms: number) => { now = new Date(now.getTime() + ms); };
  const lastCode = () => sent[sent.length - 1].code;

  beforeEach(() => {
    now = new Date('2026-10-01T10:00:00Z');
    store = new MemoryStore();
    sent = [];
    gateway = { name: 'fake', sendVerificationCode: async (phone, code) => { sent.push({ phone, code }); } };
    jest.restoreAllMocks();
  });

  it('发送：生成 6 位数字验证码，交给网关；库里只有哈希，没有明文验证码与明文手机号', async () => {
    const r = await make().send(PHONE, 'login', '1.2.3.4');
    expect(sent).toHaveLength(1);
    expect(sent[0].phone).toBe(PHONE);
    expect(sent[0].code).toMatch(/^\d{6}$/);
    expect(r.expiresInSeconds).toBe(300);
    const stored = JSON.stringify(store.rows);
    expect(stored).not.toContain(sent[0].code);
    expect(stored).not.toContain(PHONE);
    expect(store.rows[0].code_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(store.rows[0].request_ip_hash).not.toContain('1.2.3.4');
  });

  it('验证成功后一次性：同一个验证码不能用第二次', async () => {
    const svc = make();
    await svc.send(PHONE, 'login');
    await svc.verify(PHONE, 'login', lastCode());
    await expect(svc.verify(PHONE, 'login', lastCode())).rejects.toBeInstanceOf(BadRequestException);
  });

  it('有过期：超过有效期不能用', async () => {
    const svc = make();
    await svc.send(PHONE, 'login');
    advance(301_000);
    await expect(svc.verify(PHONE, 'login', lastCode())).rejects.toThrow(/过期|重新获取/);
  });

  it('限次数：错误 5 次后，即使第 6 次给了正确验证码也作废', async () => {
    const svc = make();
    await svc.send(PHONE, 'login');
    const good = lastCode();
    const bad = good === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i += 1) await expect(svc.verify(PHONE, 'login', bad)).rejects.toThrow();
    await expect(svc.verify(PHONE, 'login', good)).rejects.toThrow(/次数过多|重新获取/);
  });

  it('用途隔离：登录验证码不能拿去注册；别的手机号的验证码不能用', async () => {
    const svc = make();
    await svc.send(PHONE, 'login');
    await expect(svc.verify(PHONE, 'register', lastCode())).rejects.toThrow();
    await expect(svc.verify('13900000000', 'login', lastCode())).rejects.toThrow();
  });

  it('重新获取验证码后，旧验证码立即失效', async () => {
    const svc = make();
    await svc.send(PHONE, 'login');
    const first = lastCode();
    advance(61_000);
    await svc.send(PHONE, 'login');
    const second = lastCode();
    if (first !== second) await expect(svc.verify(PHONE, 'login', first)).rejects.toThrow();
    await svc.verify(PHONE, 'login', second);
  });

  it('限频：60 秒内同一手机号不能重复获取（429，带剩余秒数）', async () => {
    const svc = make();
    await svc.send(PHONE, 'login');
    advance(30_000);
    const err = await svc.send(PHONE, 'login').catch((e) => e);
    expect(err).toBeInstanceOf(HttpException);
    expect(err.getStatus()).toBe(429);
    expect(String(err.message)).toMatch(/30|秒/);
    expect(sent).toHaveLength(1);
    advance(31_000);
    await svc.send(PHONE, 'login');
    expect(sent).toHaveLength(2);
  });

  it('限频：同一手机号每天最多 10 条', async () => {
    const svc = make();
    for (let i = 0; i < 10; i += 1) { await svc.send(PHONE, 'login'); advance(61_000); }
    const err = await svc.send(PHONE, 'login').catch((e) => e);
    expect(err.getStatus()).toBe(429);
    expect(sent).toHaveLength(10);
  });

  it('限频：同一地址每小时最多 30 条（换手机号轮换也不行）', async () => {
    const svc = make();
    for (let i = 0; i < 30; i += 1) await svc.send(`139000000${String(i).padStart(2, '0')}`, 'login', '9.9.9.9');
    const err = await svc.send('13911112222', 'login', '9.9.9.9').catch((e) => e);
    expect(err.getStatus()).toBe(429);
    await svc.send('13911112222', 'login', '8.8.8.8');
  });

  it('网关发送失败：不留下可用的验证码，不占用冷却时间', async () => {
    const failing: SmsGateway = { name: 'f', sendVerificationCode: async () => { throw new ServiceUnavailableException('短信发送失败，请稍后重试'); } };
    await expect(make({}, failing).send(PHONE, 'login')).rejects.toThrow(/短信发送失败/);
    expect(store.rows).toHaveLength(0);
    await make().send(PHONE, 'login');
  });

  it('没有配置短信服务：明确报「短信服务未配置」，不记录验证码，也不假装成功', async () => {
    const err = await make({}, new NotConfiguredSmsGateway()).send(PHONE, 'login').catch((e) => e);
    expect(err).toBeInstanceOf(ServiceUnavailableException);
    expect(err.message).toContain('短信服务未配置');
    expect(store.rows).toHaveLength(0);
  });

  it('开发网关：固定验证码 123456，验证通过；生产环境即使用了开发网关也直接拒绝', async () => {
    const dev = new DevSmsGateway();
    const svc = make({}, dev);
    await svc.send(PHONE, 'login');
    await svc.verify(PHONE, 'login', '123456');
    advance(61_000);
    const prod = make({ NODE_ENV: 'production' }, dev);
    await expect(prod.send(PHONE, 'login')).rejects.toThrow(/短信服务未配置|开发/);
    expect(store.rows.filter((r) => !r.consumed_at)).toHaveLength(0);
  });

  it('生产环境没有哈希密钥：不退回 JWT_SECRET，报未配置', async () => {
    const svc = new SmsCodeService(store, gateway, new ConfigService({ NODE_ENV: 'production', JWT_SECRET: 'j'.repeat(40) }), () => now);
    await expect(svc.send(PHONE, 'login')).rejects.toThrow(/短信服务未配置/);
  });

  it('日志里没有明文手机号与验证码', async () => {
    const logs: string[] = [];
    for (const level of ['log', 'warn', 'error', 'debug', 'verbose'] as const) {
      jest.spyOn(Logger.prototype, level).mockImplementation((m: any) => { logs.push(String(m)); });
    }
    const svc = make();
    await svc.send(PHONE, 'login');
    await svc.verify(PHONE, 'login', '000000').catch(() => undefined);
    const text = logs.join('\n');
    expect(text).not.toContain(PHONE);
    expect(text).not.toContain(lastCode());
  });

  it('清除手机号相关的验证码（注销账号时调用）', async () => {
    const svc = make();
    await svc.send(PHONE, 'login');
    expect(await svc.eraseForPhone(PHONE)).toBe(1);
    expect(store.rows).toHaveLength(0);
  });
});
