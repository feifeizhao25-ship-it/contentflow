/**
 * 手机号 + 短信验证码注册 / 登录 / 绑定（接口层，走真实 configureApp：校验管道、中文错误信封）。
 *
 * 数据库用一个有状态的假实现，短信服务用可控的网关，验证码存储用内存实现（与数据库同样的原子语义）。
 * 重点是几个上线前不能错的性质：
 *   - 验证码一次性、错误有次数上限、手机号注册必须勾选同意并留痕；
 *   - 短信服务没配置时明确报「短信服务未配置」，不假装成功；
 *   - 日志里不出现完整手机号与邮箱；
 *   - 手机号账号的占位邮箱不外露。
 */
import { ExecutionContext, INestApplication, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const request = require('supertest');
import { configureApp } from '../../bootstrap';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PrismaService } from '../../database/prisma.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { CONSENT_VERSION } from './consent';
import { MemoryStore } from './sms/memory-sms-code-store.testing';
import { SMS_CODE_STORE, SmsCodeService } from './sms/sms-code.service';
import { SMS_GATEWAY, SmsGateway } from './sms/sms.types';
import { NotConfiguredSmsGateway } from './sms/not-configured-sms.gateway';

const PHONE = '13812345678';
const OTHER = '13900001111';

class FakeDb {
  users: any[] = [];
  tenants: any[] = [];
  seq = 0;
  user = {
    findFirst: async ({ where }: any) => this.users.find((u) => Object.entries(where).every(([k, v]) => u[k] === v)) ?? null,
    findUnique: async ({ where }: any) => this.users.find((u) => u.id === where.id) ?? null,
    create: async ({ data }: any) => {
      if (data.phone && this.users.some((u) => u.phone === data.phone && u.status === 'active')) {
        throw Object.assign(new Error('unique'), { code: 'P2002' });
      }
      const row = { id: `u${++this.seq}`, status: 'active', role: 'member', phone: null, phone_verified: false, real_name_verified: false, consent_version: null, consent_at: null, name: null, ...data };
      this.users.push(row);
      return row;
    },
    update: async ({ where, data }: any) => {
      const row = this.users.find((u) => u.id === where.id);
      Object.assign(row, Object.fromEntries(Object.entries(data).map(([k, v]: any) => [k, v && typeof v === 'object' && 'increment' in v ? (row[k] ?? 0) + v.increment : v])));
      return row;
    },
  };
  tenant = {
    create: async ({ data }: any) => { const row = { id: `t${++this.seq}`, ...data }; this.tenants.push(row); return row; },
    findUnique: async ({ where }: any) => this.tenants.find((t) => t.id === where.id) ?? null,
  };
  $transaction = async (fn: any) => {
    const snapshot = { users: [...this.users], tenants: [...this.tenants] };
    try { return await fn(this); } catch (e) { this.users = snapshot.users; this.tenants = snapshot.tenants; throw e; }
  };
}

describe('手机号 + 短信验证码（接口层）', () => {
  let app: INestApplication;
  let db: FakeDb;
  let store: MemoryStore;
  let sent: Array<{ phone: string; code: string }>;
  let now: Date;
  let logs: string[];
  const ME = { id: 'u-bind', sub: 'u-bind', tenantId: 't-bind', role: 'owner' };

  const gatewayOk = (): SmsGateway => ({ name: 'fake', sendVerificationCode: async (phone, code) => { sent.push({ phone, code }); } });

  async function boot(gateway: SmsGateway = gatewayOk(), env: Record<string, unknown> = {}) {
    const config = new ConfigService({ NODE_ENV: 'test', JWT_SECRET: 'j'.repeat(40), JWT_REFRESH_SECRET: 'r'.repeat(40), SMS_CODE_HMAC_SECRET: 's'.repeat(40), ...env });
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        AuthService,
        { provide: PrismaService, useValue: db },
        { provide: ConfigService, useValue: config },
        { provide: JwtService, useValue: new JwtService({ secret: 'j'.repeat(40) }) },
        { provide: SMS_CODE_STORE, useValue: store },
        { provide: SMS_GATEWAY, useValue: gateway },
        { provide: SmsCodeService, useFactory: () => new SmsCodeService(store, gateway, config, () => now) },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: (ctx: ExecutionContext) => { ctx.switchToHttp().getRequest().user = ME; return true; } })
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app, []);
    await app.init();
  }

  beforeEach(() => {
    db = new FakeDb();
    store = new MemoryStore();
    sent = [];
    now = new Date('2026-10-01T10:00:00Z');
    logs = [];
    for (const level of ['log', 'warn', 'error', 'debug', 'verbose'] as const) {
      jest.spyOn(Logger.prototype, level).mockImplementation((...args: any[]) => { logs.push(args.map(String).join(' ')); });
    }
  });
  afterEach(async () => { await app?.close(); jest.restoreAllMocks(); });

  const http = () => request(app.getHttpServer());
  const sendCode = (phone: string, purpose: string) => http().post('/api/v1/auth/sms/send').send({ phone, purpose });
  const advance = (ms: number) => { now = new Date(now.getTime() + ms); };
  const lastCode = () => sent[sent.length - 1].code;
  const registerBody = (over: Record<string, unknown> = {}) => ({ phone: PHONE, code: lastCode(), agreedToTerms: true, ...over });

  describe('发送验证码', () => {
    it('手机号格式不对：400 中文提示，不调用短信服务', async () => {
      await boot();
      const res = await sendCode('12345', 'register');
      expect(res.status).toBe(400);
      expect([].concat(res.body.error.message).join('')).toContain('手机号');
      expect(sent).toHaveLength(0);
    });

    it('purpose 只能是 register / login（bind 走登录后的专用接口）', async () => {
      await boot();
      expect((await sendCode(PHONE, 'bind')).status).toBe(400);
      expect((await sendCode(PHONE, 'reset')).status).toBe(400);
      expect(sent).toHaveLength(0);
    });

    it('注册：该手机号已有账号 → 409 提示直接登录，且不发短信（不白花钱）', async () => {
      await boot();
      db.users.push({ id: 'x', phone: PHONE, status: 'active', tenant_id: 't', email: 'a@b.com' });
      const res = await sendCode(PHONE, 'register');
      expect(res.status).toBe(409);
      expect(res.body.error.message).toContain('已注册');
      expect(sent).toHaveLength(0);
    });

    it('登录：手机号没有账号 → 同样返回 200（不泄露哪些手机号注册过），但不发短信', async () => {
      await boot();
      const res = await sendCode(PHONE, 'login');
      expect(res.status).toBe(200);
      expect(sent).toHaveLength(0);
    });

    it('登录：手机号有账号 → 发送', async () => {
      await boot();
      db.users.push({ id: 'x', phone: PHONE, status: 'active', tenant_id: 't', email: 'a@b.com' });
      const res = await sendCode(PHONE, 'login');
      expect(res.status).toBe(200);
      expect(res.body.data.resendAfterSeconds).toBe(60);
      expect(sent).toHaveLength(1);
    });

    it('短信服务没配置：503，错误信息明确写「短信服务未配置」，不是 200', async () => {
      await boot(new NotConfiguredSmsGateway());
      const res = await sendCode(PHONE, 'register');
      expect(res.status).toBe(503);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('短信服务未配置');
    });

    it('一分钟内再发：429 并提示等待秒数', async () => {
      await boot();
      expect((await sendCode(PHONE, 'register')).status).toBe(200);
      const res = await sendCode(PHONE, 'register');
      expect(res.status).toBe(429);
      expect(res.body.error.message).toMatch(/\d+ 秒/);
      expect(sent).toHaveLength(1);
    });

    it('发送接口自己也挂了每地址限流（防止刷短信费用）', async () => {
      const meta = Reflect.getMetadata('THROTTLER:LIMITdefault', AuthController.prototype.sendSmsCode);
      expect(meta).toBeLessThanOrEqual(10);
    });
  });

  describe('手机号注册', () => {
    it('必须勾选同意：缺少或为 false → 400，不建账号，验证码不被消耗', async () => {
      await boot();
      await sendCode(PHONE, 'register');
      for (const body of [{ phone: PHONE, code: lastCode() }, registerBody({ agreedToTerms: false }), registerBody({ agreedToTerms: 'true' })]) {
        const res = await http().post('/api/v1/auth/register/phone').send(body);
        expect(res.status).toBe(400);
      }
      expect(db.users).toHaveLength(0);
      // 验证码没被消耗：勾选后仍可用
      const ok = await http().post('/api/v1/auth/register/phone').send(registerBody());
      expect(ok.status).toBe(201);
    });

    it('成功：建工作区与用户（owner）、手机号已验证、记录同意的协议版本与时间，返回令牌', async () => {
      await boot();
      await sendCode(PHONE, 'register');
      const res = await http().post('/api/v1/auth/register/phone').send(registerBody({ name: '小王' }));
      expect(res.status).toBe(201);
      const { user, token, refreshToken } = res.body.data;
      expect(token).toBeTruthy();
      expect(refreshToken).toBeTruthy();
      const row = db.users[0];
      expect(row.phone).toBe(PHONE);
      expect(row.phone_verified).toBe(true);
      expect(row.real_name_verified).toBe(false);
      expect(row.role).toBe('owner');
      expect(row.password_hash ?? null).toBeNull();
      expect(row.consent_version).toBe(CONSENT_VERSION);
      expect(row.consent_at).toBeInstanceOf(Date);
      expect(db.tenants).toHaveLength(1);
      // 响应里：占位邮箱不外露，手机号脱敏
      expect(user.email).toBe('');
      expect(user.phone).toBe('138****5678');
      expect(JSON.stringify(res.body)).not.toContain(PHONE);
      expect(JSON.stringify(res.body)).not.toContain('phone.invalid');
    });

    it('验证码错误：400，不建账号', async () => {
      await boot();
      await sendCode(PHONE, 'register');
      const res = await http().post('/api/v1/auth/register/phone').send(registerBody({ code: lastCode() === '000000' ? '111111' : '000000' }));
      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('验证码');
      expect(db.users).toHaveLength(0);
    });

    it('验证码一次性：同一个验证码第二次提交失败', async () => {
      await boot();
      await sendCode(PHONE, 'register');
      const code = lastCode();
      expect((await http().post('/api/v1/auth/register/phone').send(registerBody())).status).toBe(201);
      db.users.length = 0; // 即便账号被清掉，旧验证码也不能再用
      const again = await http().post('/api/v1/auth/register/phone').send(registerBody({ code }));
      expect(again.status).toBe(400);
    });

    it('验证码过期（5 分钟）后失败', async () => {
      await boot();
      await sendCode(PHONE, 'register');
      advance(5 * 60_000 + 1000);
      const res = await http().post('/api/v1/auth/register/phone').send(registerBody());
      expect(res.status).toBe(400);
      expect(db.users).toHaveLength(0);
    });

    it('猜验证码：连错 5 次后，即使第 6 次输对也不行', async () => {
      await boot();
      await sendCode(PHONE, 'register');
      const good = lastCode();
      const wrong = good === '000000' ? '111111' : '000000';
      for (let i = 0; i < 5; i += 1) {
        expect((await http().post('/api/v1/auth/register/phone').send(registerBody({ code: wrong }))).status).toBe(400);
      }
      const res = await http().post('/api/v1/auth/register/phone').send(registerBody({ code: good }));
      expect(res.status).toBe(400);
      expect(db.users).toHaveLength(0);
    });

    it('拿注册用途的验证码去登录：不通过（用途隔离）', async () => {
      await boot();
      await sendCode(PHONE, 'register');
      db.users.push({ id: 'x', phone: PHONE, status: 'active', tenant_id: 't', email: 'a@b.com', role: 'owner' });
      db.tenants.push({ id: 't' });
      const res = await http().post('/api/v1/auth/login/sms').send({ phone: PHONE, code: lastCode() });
      expect([400, 401]).toContain(res.status);
    });

    it('手机号已被注册（并发抢注，唯一约束触发）：409 中文提示', async () => {
      await boot();
      await sendCode(PHONE, 'register');
      // 发送时还没人注册，提交前被别人抢注
      db.users.push({ id: 'x', phone: PHONE, status: 'active', tenant_id: 't', email: 'a@b.com' });
      const res = await http().post('/api/v1/auth/register/phone').send(registerBody());
      expect(res.status).toBe(409);
      expect(res.body.error.message).toContain('已注册');
      expect(db.users).toHaveLength(1);
    });

    it('多带不认识的字段（如 role）→ 400', async () => {
      await boot();
      await sendCode(PHONE, 'register');
      const res = await http().post('/api/v1/auth/register/phone').send(registerBody({ role: 'admin' }));
      expect(res.status).toBe(400);
    });
  });

  describe('短信验证码登录', () => {
    const seedUser = () => {
      db.tenants.push({ id: 't1' });
      db.users.push({ id: 'u9', tenant_id: 't1', phone: PHONE, phone_verified: true, status: 'active', email: 'phone-x@phone.invalid', role: 'owner', name: '小王', login_count: 0 });
    };

    it('成功：返回令牌，更新登录信息', async () => {
      await boot();
      seedUser();
      await sendCode(PHONE, 'login');
      const res = await http().post('/api/v1/auth/login/sms').send({ phone: PHONE, code: lastCode() });
      expect(res.status).toBe(200);
      expect(res.body.data.token).toBeTruthy();
      expect(res.body.data.user.id).toBe('u9');
      expect(res.body.data.user.email).toBe('');
      expect(db.users[0].login_count).toBe(1);
    });

    it('验证码错误 / 没有账号 / 账号已注销：都失败，且不能靠返回区分「没有这个账号」', async () => {
      await boot();
      seedUser();
      await sendCode(PHONE, 'login');
      const wrong = await http().post('/api/v1/auth/login/sms').send({ phone: PHONE, code: lastCode() === '000000' ? '111111' : '000000' });
      expect(wrong.status).toBeGreaterThanOrEqual(400);
      // 没有账号的手机号：根本没发过验证码，提交任何码都是同一个失败
      const unknown = await http().post('/api/v1/auth/login/sms').send({ phone: OTHER, code: '123456' });
      expect(unknown.status).toBe(400);
      expect(unknown.body.error.message).toBe('验证码已过期或未获取，请重新获取');
      // 账号已注销：登录不上
      db.users[0].status = 'deleted';
      await sendCode(PHONE, 'login');
      expect(sent).toHaveLength(1); // 已注销的账号不发短信
    });

    it('验证码一次性', async () => {
      await boot();
      seedUser();
      await sendCode(PHONE, 'login');
      const code = lastCode();
      expect((await http().post('/api/v1/auth/login/sms').send({ phone: PHONE, code })).status).toBe(200);
      expect((await http().post('/api/v1/auth/login/sms').send({ phone: PHONE, code })).status).toBe(400);
    });

    it('登录接口挂了每地址限流', async () => {
      expect(Reflect.getMetadata('THROTTLER:LIMITdefault', AuthController.prototype.loginWithSms)).toBeLessThanOrEqual(10);
      expect(Reflect.getMetadata('THROTTLER:LIMITdefault', AuthController.prototype.registerWithPhone)).toBeLessThanOrEqual(10);
    });
  });

  describe('登录后绑定手机号', () => {
    it('发送 → 提交：写入手机号并标记已验证', async () => {
      await boot();
      db.users.push({ id: ME.id, tenant_id: 't1', email: 'me@example.com', phone: null, phone_verified: false, status: 'active', role: 'owner' });
      const send = await http().post('/api/v1/auth/phone/bind/send').send({ phone: PHONE });
      expect(send.status).toBe(200);
      const res = await http().post('/api/v1/auth/phone/bind').send({ phone: PHONE, code: lastCode() });
      expect(res.status).toBe(200);
      expect(db.users[0].phone).toBe(PHONE);
      expect(db.users[0].phone_verified).toBe(true);
      expect(res.body.data.phone).toBe('138****5678');
    });

    it('该手机号已绑定在别的账号：409，不发短信', async () => {
      await boot();
      db.users.push({ id: ME.id, tenant_id: 't1', email: 'me@example.com', phone: null, status: 'active' });
      db.users.push({ id: 'other', tenant_id: 't2', email: 'o@example.com', phone: PHONE, status: 'active' });
      const res = await http().post('/api/v1/auth/phone/bind/send').send({ phone: PHONE });
      expect(res.status).toBe(409);
      expect(sent).toHaveLength(0);
    });

    it('验证码错误：不写入手机号', async () => {
      await boot();
      db.users.push({ id: ME.id, tenant_id: 't1', email: 'me@example.com', phone: null, status: 'active' });
      await http().post('/api/v1/auth/phone/bind/send').send({ phone: PHONE });
      const res = await http().post('/api/v1/auth/phone/bind').send({ phone: PHONE, code: lastCode() === '000000' ? '111111' : '000000' });
      expect(res.status).toBe(400);
      expect(db.users[0].phone).toBeNull();
    });
  });

  describe('邮箱注册也必须同意并留痕', () => {
    it('缺少 agreedToTerms → 400；带上 → 记录协议版本', async () => {
      await boot();
      const base = { email: 'new@example.com', password: 'secret12', name: '小李' };
      expect((await http().post('/api/v1/auth/register').send(base)).status).toBe(400);
      expect(db.users).toHaveLength(0);
      const ok = await http().post('/api/v1/auth/register').send({ ...base, agreedToTerms: true });
      expect(ok.status).toBe(201);
      expect(db.users[0].consent_version).toBe(CONSENT_VERSION);
      expect(db.users[0].consent_at).toBeInstanceOf(Date);
    });

    it('没填工作区名也没填姓名时不会得到「undefined的工作室」', async () => {
      await boot();
      await http().post('/api/v1/auth/register').send({ email: 'n@example.com', password: 'secret12', agreedToTerms: true });
      expect(db.tenants[0].name).not.toContain('undefined');
    });
  });

  describe('日志不含完整手机号与邮箱', () => {
    it('发送 / 注册 / 登录 / 绑定 / 邮箱注册登录全流程，所有日志里没有明文手机号、邮箱', async () => {
      await boot();
      await sendCode(PHONE, 'register');
      await http().post('/api/v1/auth/register/phone').send(registerBody());
      advance(61_000);
      await sendCode(PHONE, 'login');
      await http().post('/api/v1/auth/login/sms').send({ phone: PHONE, code: lastCode() });
      // 失败路径也不泄露
      await sendCode('13700001111', 'register');
      await http().post('/api/v1/auth/register/phone').send({ phone: '13700001111', code: '000000', agreedToTerms: true });
      const email = 'someone.private@example.com';
      await http().post('/api/v1/auth/register').send({ email, password: 'secret12', agreedToTerms: true });
      await http().post('/api/v1/auth/login').send({ email, password: 'secret12' });
      await http().post('/api/v1/auth/login').send({ email, password: 'wrong-password' });

      expect(logs.length).toBeGreaterThan(0);
      const all = logs.join('\n');
      expect(all).not.toContain(PHONE);
      expect(all).not.toContain('13700001111');
      expect(all).not.toContain(email);
      expect(all).not.toContain('someone.private');
      expect(all).toContain('138****5678'); // 脱敏后的仍可用于排查
    });

    it('短信服务商返回失败时，错误日志里也只有脱敏手机号', async () => {
      const failing: SmsGateway = { name: 'fail', sendVerificationCode: async () => { throw new Error(`upstream rejected ${PHONE}`); } };
      await boot(failing);
      const res = await sendCode(PHONE, 'register');
      expect(res.status).toBeGreaterThanOrEqual(500);
      expect(JSON.stringify(res.body)).not.toContain(PHONE);
      expect(res.body.error.message).toContain('短信发送失败');
      expect(logs.join('\n')).not.toContain(PHONE);
    });
  });
});
