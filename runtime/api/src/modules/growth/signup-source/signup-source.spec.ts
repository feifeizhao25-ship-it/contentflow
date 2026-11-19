/**
 * 注册来源题「从哪知道我们」：默认关闭、只在国内版生效、只存枚举代码、
 * 不在任何响应和日志里和身份信息一起出现。
 */
import { ExecutionContext, INestApplication, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const request = require('supertest');
import { configureApp } from '../../../bootstrap';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PrismaService } from '../../../database/prisma.service';
import { AuthController } from '../../auth/auth.controller';
import { AuthService } from '../../auth/auth.service';
import { MemoryStore } from '../../auth/sms/memory-sms-code-store.testing';
import { SMS_CODE_STORE, SmsCodeService } from '../../auth/sms/sms-code.service';
import { SMS_GATEWAY, SmsGateway } from '../../auth/sms/sms.types';
import { TABLE_CLASSIFICATION } from '../../user/account-erasure.service';
import { GrowthPublicController } from '../growth.controller';
import { GrowthTrafficService } from '../growth-traffic.service';
import {
  SIGNUP_SOURCES,
  normalizeSignupSource,
  publicSignupSourceOptions,
  recordSignupEvent,
  signupSourceEnabled,
} from './signup-source';

const LABELS = ['小红书', '抖音', '视频号', '公众号', '知乎', '哔哩哔哩', '搜索', '朋友推荐', '其他'];
const EMAIL = 'source-tester@example.cn';
const PHONE = '13812345678';

describe('注册来源题：纯函数', () => {
  it('选项正好是这 9 个，顺序固定，代码不重复', () => {
    expect(SIGNUP_SOURCES.map((s) => s.label)).toEqual(LABELS);
    expect(new Set(SIGNUP_SOURCES.map((s) => s.code)).size).toBe(9);
  });

  it('开关默认关闭，只认字符串 true；国际版无论如何都关闭', () => {
    expect(signupSourceEnabled({})).toBe(false);
    expect(signupSourceEnabled({ SIGNUP_SOURCE_ENABLED: '1' })).toBe(false);
    expect(signupSourceEnabled({ SIGNUP_SOURCE_ENABLED: 'TRUE' })).toBe(false);
    expect(signupSourceEnabled({ SIGNUP_SOURCE_ENABLED: 'true' })).toBe(true);
    expect(signupSourceEnabled({ SIGNUP_SOURCE_ENABLED: 'true', MARKET_REGION: 'cn' })).toBe(true);
    expect(signupSourceEnabled({ SIGNUP_SOURCE_ENABLED: 'true', MARKET_REGION: 'global' })).toBe(false);
  });

  it('只认枚举代码：显示名、大小写不符、自由文本、非字符串都丢弃', () => {
    expect(normalizeSignupSource('zhihu')).toBe('zhihu');
    for (const bad of ['', '知乎', 'Zhihu', 'zhihu ', '我在电梯广告看到的', null, undefined, 3, ['zhihu']]) {
      expect(normalizeSignupSource(bad)).toBeNull();
    }
  });

  it('公开选项：关着时不给题目，开着时给 9 个选项', () => {
    expect(publicSignupSourceOptions({})).toEqual({ enabled: false, options: [] });
    const on = publicSignupSourceOptions({ SIGNUP_SOURCE_ENABLED: 'true' });
    expect(on.enabled).toBe(true);
    expect(on.options.map((o) => o.label)).toEqual(LABELS);
  });

  it('写入：开着时记一条 signup 事件，来源只作为嵌套的枚举代码，不带身份字段', async () => {
    const created: any[] = [];
    const prisma = { growthEvent: { create: async (args: any) => { created.push(args.data); return args.data; } } };
    const ok = await recordSignupEvent(prisma, { userId: 'u1', tenantId: 't1' }, 'douyin', { SIGNUP_SOURCE_ENABLED: 'true' }, () => 'v-fixed');
    expect(ok).toBe(true);
    expect(created).toEqual([
      { tenant_id: 't1', user_id: 'u1', visitor_id: 'v-fixed', event: 'signup', signup_source: { create: { source: 'douyin' } } },
    ]);
    expect(Object.keys(created[0].signup_source.create)).toEqual(['source']);
  });

  it('写入：跳过或未知值时仍记 signup 事件，但不挂来源', async () => {
    const created: any[] = [];
    const prisma = { growthEvent: { create: async (args: any) => { created.push(args.data); return args.data; } } };
    expect(await recordSignupEvent(prisma, { userId: 'u1' }, undefined, { SIGNUP_SOURCE_ENABLED: 'true' })).toBe(false);
    expect(await recordSignupEvent(prisma, { userId: 'u2' }, '电视广告', { SIGNUP_SOURCE_ENABLED: 'true' })).toBe(false);
    expect(created).toHaveLength(2);
    for (const row of created) expect(row).not.toHaveProperty('signup_source');
  });

  it('写入：开关关着或国际版时什么都不写；数据库出错不影响注册', async () => {
    const create = jest.fn(async () => { throw new Error('db down'); });
    expect(await recordSignupEvent({ growthEvent: { create } }, { userId: 'u' }, 'zhihu', {})).toBe(false);
    expect(await recordSignupEvent({ growthEvent: { create } }, { userId: 'u' }, 'zhihu', { SIGNUP_SOURCE_ENABLED: 'true', MARKET_REGION: 'global' })).toBe(false);
    expect(create).not.toHaveBeenCalled();
    await expect(recordSignupEvent({ growthEvent: { create } }, { userId: 'u' }, 'zhihu', { SIGNUP_SOURCE_ENABLED: 'true' })).resolves.toBe(false);
    expect(create).toHaveBeenCalledTimes(1);
    expect(await recordSignupEvent({}, { userId: 'u' }, 'zhihu', { SIGNUP_SOURCE_ENABLED: 'true' })).toBe(false);
  });

  it('注销分类：来源表随 signup 事件级联删除', () => {
    expect(TABLE_CLASSIFICATION.GrowthSignupSource?.kind).toBe('cascade');
  });
});

class FakeDb {
  users: any[] = [];
  tenants: any[] = [];
  events: any[] = [];
  seq = 0;
  user = {
    findFirst: async ({ where }: any) => this.users.find((u) => Object.entries(where).every(([k, v]) => u[k] === v)) ?? null,
    findUnique: async ({ where }: any) => this.users.find((u) => u.id === where.id) ?? null,
    create: async ({ data }: any) => {
      const row = { id: data.id ?? `u${++this.seq}`, status: 'active', role: 'member', phone: null, phone_verified: false, real_name_verified: false, name: null, ...data };
      this.users.push(row);
      return row;
    },
    update: async ({ where }: any) => this.users.find((u) => u.id === where.id),
  };
  tenant = {
    create: async ({ data }: any) => { const row = { id: `t${++this.seq}`, ...data }; this.tenants.push(row); return row; },
    findUnique: async ({ where }: any) => this.tenants.find((t) => t.id === where.id) ?? null,
  };
  growthEvent = {
    create: async ({ data }: any) => { const row = { id: `ge${++this.seq}`, ...data }; this.events.push(row); return row; },
  };
  $transaction = async (fn: any) => fn(this);
}

describe('注册来源题：接口层', () => {
  let app: INestApplication;
  let db: FakeDb;
  let logs: string[];
  let sent: Array<{ phone: string; code: string }>;
  const saved = { flag: process.env.SIGNUP_SOURCE_ENABLED, region: process.env.MARKET_REGION };

  async function boot() {
    const config = new ConfigService({ NODE_ENV: 'test', JWT_SECRET: 'j'.repeat(40), JWT_REFRESH_SECRET: 'r'.repeat(40), SMS_CODE_HMAC_SECRET: 's'.repeat(40) });
    const store = new MemoryStore();
    const gateway: SmsGateway = { name: 'fake', sendVerificationCode: async (phone, code) => { sent.push({ phone, code }); } };
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController, GrowthPublicController],
      providers: [
        AuthService,
        { provide: GrowthTrafficService, useValue: {} },
        { provide: PrismaService, useValue: db },
        { provide: ConfigService, useValue: config },
        { provide: JwtService, useValue: new JwtService({ secret: 'j'.repeat(40) }) },
        { provide: SMS_CODE_STORE, useValue: store },
        { provide: SMS_GATEWAY, useValue: gateway },
        { provide: SmsCodeService, useFactory: () => new SmsCodeService(store, gateway, config, () => new Date()) },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: (_ctx: ExecutionContext) => true })
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app, []);
    await app.init();
  }

  beforeEach(() => {
    db = new FakeDb();
    logs = [];
    sent = [];
    delete process.env.SIGNUP_SOURCE_ENABLED;
    delete process.env.MARKET_REGION;
    for (const level of ['log', 'warn', 'error', 'debug', 'verbose'] as const) {
      jest.spyOn(Logger.prototype, level).mockImplementation((...args: any[]) => { logs.push(args.map(String).join(' ')); });
    }
  });
  afterEach(async () => {
    await app?.close();
    jest.restoreAllMocks();
    if (saved.flag === undefined) delete process.env.SIGNUP_SOURCE_ENABLED; else process.env.SIGNUP_SOURCE_ENABLED = saved.flag;
    if (saved.region === undefined) delete process.env.MARKET_REGION; else process.env.MARKET_REGION = saved.region;
  });

  const http = () => request(app.getHttpServer());
  const emailBody = (over: Record<string, unknown> = {}) => ({ email: EMAIL, password: 'passw0rd!', name: '测试姓名', agreedToTerms: true, confirmedAge16: true, ...over });
  const allSources = () => db.events.map((e) => e.signup_source?.create?.source ?? null);

  it('默认关闭：公开接口不给题目；带了来源也不记任何事件', async () => {
    await boot();
    const options = await http().get('/api/v1/growth/signup-source');
    expect(options.status).toBe(200);
    expect(JSON.stringify(options.body)).toContain('"enabled":false');
    expect(JSON.stringify(options.body)).not.toContain('小红书');
    const res = await http().post('/api/v1/auth/register').send(emailBody({ signupSource: 'zhihu' }));
    expect(res.status).toBe(201);
    expect(db.events).toHaveLength(0);
  });

  it('打开后：公开接口给出 9 个选项', async () => {
    process.env.SIGNUP_SOURCE_ENABLED = 'true';
    await boot();
    const res = await http().get('/api/v1/growth/signup-source');
    const body = res.body.data ?? res.body;
    expect(body.enabled).toBe(true);
    expect(body.options.map((o: any) => o.label)).toEqual(LABELS);
  });

  it('邮箱注册：来源挂在 signup 事件上，响应和日志都不出现来源', async () => {
    process.env.SIGNUP_SOURCE_ENABLED = 'true';
    await boot();
    const res = await http().post('/api/v1/auth/register').send(emailBody({ signupSource: 'xiaohongshu' }));
    expect(res.status).toBe(201);
    expect(allSources()).toEqual(['xiaohongshu']);
    expect(db.events[0]).toMatchObject({ event: 'signup', user_id: db.users[0].id, tenant_id: db.tenants[0].id });
    const text = JSON.stringify(res.body);
    expect(text).not.toContain('xiaohongshu');
    expect(text).not.toContain('小红书');
    expect(text).not.toContain('signupSource');
    for (const line of logs) {
      expect(line).not.toContain('xiaohongshu');
      expect(line).not.toContain('小红书');
    }
  });

  it('手机号注册：同样只记枚举代码', async () => {
    process.env.SIGNUP_SOURCE_ENABLED = 'true';
    await boot();
    expect((await http().post('/api/v1/auth/sms/send').send({ phone: PHONE, purpose: 'register' })).status).toBe(200);
    const res = await http().post('/api/v1/auth/register/phone').send({ phone: PHONE, code: sent[sent.length - 1].code, agreedToTerms: true, confirmedAge16: true, signupSource: 'friend' });
    expect(res.status).toBe(201);
    expect(allSources()).toEqual(['friend']);
    expect(JSON.stringify(res.body)).not.toContain('friend');
  });

  it('未知值不让注册失败，只是不记来源；跳过时同样只记事件', async () => {
    process.env.SIGNUP_SOURCE_ENABLED = 'true';
    await boot();
    expect((await http().post('/api/v1/auth/register').send(emailBody({ signupSource: '电视广告' }))).status).toBe(201);
    expect((await http().post('/api/v1/auth/register').send(emailBody({ email: 'skip@example.cn' }))).status).toBe(201);
    expect(allSources()).toEqual([null, null]);
  });

  it('不收自由文本：多带一个说明字段直接 400，不建账号', async () => {
    process.env.SIGNUP_SOURCE_ENABLED = 'true';
    await boot();
    const res = await http().post('/api/v1/auth/register').send(emailBody({ signupSource: 'other', signupSourceText: '我在地铁上看到的' }));
    expect(res.status).toBe(400);
    expect(db.users).toHaveLength(0);
    expect(db.events).toHaveLength(0);
  });

  it('来源代码超长直接 400（防止把长文本塞进来源字段）', async () => {
    process.env.SIGNUP_SOURCE_ENABLED = 'true';
    await boot();
    const res = await http().post('/api/v1/auth/register').send(emailBody({ signupSource: 'x'.repeat(33) }));
    expect(res.status).toBe(400);
    expect(db.events).toHaveLength(0);
  });

  it('国际版部署：开关打开也不出题、不记录', async () => {
    process.env.SIGNUP_SOURCE_ENABLED = 'true';
    process.env.MARKET_REGION = 'global';
    await boot();
    const options = await http().get('/api/v1/growth/signup-source');
    expect(JSON.stringify(options.body)).toContain('"enabled":false');
    await http().post('/api/v1/auth/register').send(emailBody({ signupSource: 'zhihu' }));
    expect(db.events).toHaveLength(0);
  });
});
