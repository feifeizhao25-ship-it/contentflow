/**
 * 全站每周漏斗：上海时间周边界、各字段口径、只读令牌的范围、不出工作区或用户级数据。
 * 全部用内存里的假数据库，不连真实数据库、不调任何外部服务。
 */
import { CanActivate, ExecutionContext, INestApplication, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const request = require('supertest');
import { configureApp } from '../../../bootstrap';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PrismaService } from '../../../database/prisma.service';
import { HomeService } from '../../home/home.service';
import { UsageService } from '../../system/usage.service';
import { GrowthController } from '../growth.controller';
import { GrowthService } from '../growth.service';
import { GrowthTrafficService } from '../growth-traffic.service';
import { readonlyTokenMatches } from './readonly-token.guard';
import { SiteFunnelController } from './site-funnel.controller';
import {
  MAX_WEEKS, READONLY_TOKEN_ENV, SOURCE_TABLE_MISSING_NOTE, SiteFunnelService, WeekError,
  parseWeekStart, parseWeeks, shanghaiIso, weekRanges, weekStartOf, yuanToFen,
} from './weekly-funnel';

const RO_TOKEN = 'readonly-funnel-token-for-tests';
const USER_JWT = 'pretend-valid-user-jwt';
const sh = (text: string) => new Date(`${text}+08:00`);

// 2026-11-01（周日）开始的一周记作 A，2026-11-08（周日）开始的一周记作 B。
const WEEK_A = sh('2026-11-01T00:00:00');
const WEEK_B = sh('2026-11-08T00:00:00');
const SAT_LAST_SECOND_A = sh('2026-11-07T23:59:59');
const SUN_FIRST_SECOND_B = sh('2026-11-08T00:00:00');
const NOW = sh('2026-11-11T12:00:00'); // B 周的周三

type Row = Record<string, any>;

function matches(row: Row, where: Row = {}): boolean {
  return Object.entries(where).every(([field, cond]) => {
    const value = row[field];
    if (cond !== null && typeof cond === 'object' && !(cond instanceof Date)) {
      if ('in' in cond && !cond.in.includes(value)) return false;
      if ('not' in cond) {
        if (cond.not === null ? value === null || value === undefined : value === cond.not) return false;
      }
      const t = value instanceof Date ? value.getTime() : value;
      if ('gte' in cond && !(value != null && t >= cond.gte.getTime())) return false;
      if ('lt' in cond && !(value != null && t < cond.lt.getTime())) return false;
      return true;
    }
    return value === cond;
  });
}

function pick(row: Row, select?: Row): Row {
  if (!select) return row;
  return Object.fromEntries(Object.keys(select).map((k) => [k, row[k]]));
}

function table(rows: Row[]) {
  return {
    findMany: async ({ where, select }: Row = {}) => rows.filter((r) => matches(r, where)).map((r) => pick(r, select)),
    count: async ({ where }: Row = {}) => rows.filter((r) => matches(r, where)).length,
  };
}

function fakePrisma(withSourceTable: boolean) {
  const users: Row[] = [
    { id: 'u-a', tenant_id: 't-1', email: 'a@example.com', phone: '13800000001', created_at: SAT_LAST_SECOND_A },
    { id: 'u-b', tenant_id: 't-2', email: 'b@example.com', phone: '13800000002', created_at: SUN_FIRST_SECOND_B },
    { id: 'u-b2', tenant_id: 't-2', email: 'b2@example.com', created_at: sh('2026-11-11T11:00:00') },
    { id: 'u-old', tenant_id: 't-9', email: 'old@example.com', created_at: new Date(WEEK_A.getTime() - 1000) },
  ];
  const order = (n: number, tenant: string, paidAt: Date | null, extra: Row = {}): Row => ({
    id: `id${n}`, order_no: `CFORDER${n}`, tenant_id: tenant, amount: '99.00', currency: 'CNY',
    status: 'paid', paid_at: paidAt, updated_at: paidAt ?? WEEK_A, ...extra,
  });
  const orders: Row[] = [
    order(1, 't-1', SAT_LAST_SECOND_A), // t-1 首付在 A
    order(2, 't-1', SUN_FIRST_SECOND_B, { amount: '990.00' }), // t-1 在 B 续费
    order(3, 't-2', new Date(SUN_FIRST_SECOND_B.getTime() + 3_600_000), { status: 'refunded', updated_at: sh('2026-11-09T10:00:00') }),
    order(4, 't-3', SUN_FIRST_SECOND_B, { status: 'refund_pending', amount: '199.50' }),
    order(5, 't-4', null, { status: 'pending' }),
    order(6, 't-5', null, { status: 'closed' }),
    order(7, 't-6', SUN_FIRST_SECOND_B, { currency: 'USD' }),
    order(8, 't-7', sh('2026-10-20T09:00:00'), { status: 'refunded', updated_at: SAT_LAST_SECOND_A }), // 10 月付款，A 周退款
  ];
  const subs: Row[] = [
    { tenant_id: 't-e1', status: 'active', plan: 'pro', current_period_end: SAT_LAST_SECOND_A }, // A 到期
    { tenant_id: 't-e2', status: 'active', plan: 'team', current_period_end: SUN_FIRST_SECOND_B }, // B 到期（已过）
    { tenant_id: 't-e3', status: 'active', plan: 'pro', current_period_end: sh('2026-11-12T00:00:00') }, // B 周还没到
    { tenant_id: 't-e4', status: 'refunded', plan: 'pro', current_period_end: SUN_FIRST_SECOND_B },
    { tenant_id: 't-e5', status: 'active', plan: 'free', current_period_end: SUN_FIRST_SECOND_B },
    { tenant_id: 't-1', status: 'active', plan: 'pro', current_period_end: sh('2027-11-08T00:00:00') },
  ];
  const events: Row[] = [
    { id: 'ev-a', event: 'signup', created_at: SAT_LAST_SECOND_A },
    { id: 'ev-b1', event: 'signup', created_at: SUN_FIRST_SECOND_B },
    { id: 'ev-b2', event: 'signup', created_at: SUN_FIRST_SECOND_B },
    { id: 'ev-b3', event: 'signup', created_at: SUN_FIRST_SECOND_B },
    { id: 'ev-v', event: 'landing_view', created_at: SUN_FIRST_SECOND_B },
  ];
  const sources: Row[] = [
    { event_id: 'ev-a', source: 'xiaohongshu' },
    { event_id: 'ev-b1', source: 'douyin' },
    { event_id: 'ev-b2', source: 'douyin' },
  ];
  const writes: string[] = [];
  const deny = (name: string) => async () => { writes.push(name); throw new Error('read-only test db'); };
  const readOnly = (t: ReturnType<typeof table>, name: string) => ({
    ...t, create: deny(`${name}.create`), update: deny(`${name}.update`), updateMany: deny(`${name}.updateMany`),
    delete: deny(`${name}.delete`), deleteMany: deny(`${name}.deleteMany`), upsert: deny(`${name}.upsert`),
  });
  return {
    writes,
    user: readOnly(table(users), 'user'),
    paymentOrder: readOnly(table(orders), 'paymentOrder'),
    subscription: readOnly(table(subs), 'subscription'),
    growthEvent: readOnly(table(events), 'growthEvent'),
    $queryRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const sql = strings.join('?');
      if (sql.includes('to_regclass')) return [{ present: withSourceTable }];
      if (!withSourceTable) throw new Error('relation "GrowthSignupSource" does not exist');
      const [start, end] = values as Date[];
      const counts = new Map<string, number>();
      for (const s of sources) {
        const ev = events.find((e) => e.id === s.event_id);
        if (ev && ev.event === 'signup' && ev.created_at >= start && ev.created_at < end) {
          counts.set(s.source, (counts.get(s.source) ?? 0) + 1);
        }
      }
      return [...counts].map(([source, n]) => ({ source, n }));
    },
  };
}

function service(withSourceTable = false) {
  const prisma = fakePrisma(withSourceTable);
  return { prisma, svc: new SiteFunnelService(prisma as unknown as PrismaService) };
}

// ---------- 周边界 ----------

describe('上海时间的周', () => {
  it('周六 23:59:59 归上一周，周日 00:00 归下一周；UTC 表达同样成立', () => {
    expect(weekStartOf(SAT_LAST_SECOND_A)).toEqual(WEEK_A);
    expect(weekStartOf(SUN_FIRST_SECOND_B)).toEqual(WEEK_B);
    expect(weekStartOf(new Date('2026-11-07T15:59:59Z'))).toEqual(WEEK_A);
    expect(weekStartOf(new Date('2026-11-07T16:00:00Z'))).toEqual(WEEK_B);
    // UTC 仍是周六白天，但上海已经是周日
    expect(weekStartOf(new Date('2026-11-07T17:00:00Z'))).toEqual(WEEK_B);
    expect(shanghaiIso(WEEK_B)).toBe('2026-11-08T00:00:00+08:00');
  });

  it('周区间首尾相接，参数校验', () => {
    const ranges = weekRanges(WEEK_B, 3);
    expect(ranges.map((r) => shanghaiIso(r.start))).toEqual([
      '2026-10-25T00:00:00+08:00', '2026-11-01T00:00:00+08:00', '2026-11-08T00:00:00+08:00']);
    for (let i = 1; i < ranges.length; i += 1) expect(ranges[i].start).toEqual(ranges[i - 1].end);
    expect(parseWeekStart('2026-11-08')).toEqual(WEEK_B);
    expect(() => parseWeekStart('2026-11-07')).toThrow(WeekError); // 周六
    expect(() => parseWeekStart('2026-02-30')).toThrow(WeekError);
    expect(() => parseWeekStart('nope')).toThrow(WeekError);
    expect(parseWeeks(undefined)).toBe(4);
    expect(parseWeeks('2')).toBe(2);
    expect(() => parseWeeks('0')).toThrow(WeekError);
    expect(() => parseWeeks(String(MAX_WEEKS + 1))).toThrow(WeekError);
    expect(() => parseWeeks('1.5')).toThrow(WeekError);
    expect(yuanToFen('199.50')).toBe(19950);
    expect(yuanToFen({ toString: () => '0.1' })).toBe(10);
  });
});

// ---------- 各字段 ----------

describe('每个字段的口径', () => {
  it('注册、新付费、续费、订单金额、退款金额、到期各自只算该算的', async () => {
    const { svc, prisma } = service();
    const [a, b] = await svc.summarize(weekRanges(WEEK_B, 2), NOW);

    expect(a.week_start).toBe('2026-11-01T00:00:00+08:00');
    expect(a.week_end).toBe('2026-11-07T23:59:59+08:00');
    expect(a.complete).toBe(true);
    expect(b.complete).toBe(false);

    expect(a.new_signups).toBe(1);
    expect(b.new_signups).toBe(2);

    // 新付费按工作区去重：A 只有 t-1（t-7 在 10 月首付）；B 是 t-2、t-3（退款中/已退款也算付款那周）
    expect(a.new_paid).toBe(1);
    expect(b.new_paid).toBe(2);
    expect(a.renewals).toBe(0);
    expect(b.renewals).toBe(1);

    // 金额（分）：只算 CNY 且已付款（paid / refund_pending / refunded）
    expect(a.order_amount_fen).toBe(9900);
    expect(b.order_amount_fen).toBe(99000 + 9900 + 19950);

    // 退款金额（分）：status=refunded，按 updated_at 归周；refund_pending 不算
    expect(a.refund_amount_fen).toBe(9900);
    expect(b.refund_amount_fen).toBe(9900);

    // 到期：active、非免费、到期时间在本周且已过去
    expect(a.expirations).toBe(1);
    expect(b.expirations).toBe(1);

    expect(prisma.writes).toEqual([]);
  });

  it('来源表不存在：signups_by_source 为 null 并附说明', async () => {
    const { svc } = service(false);
    const [a] = await svc.summarize(weekRanges(WEEK_B, 1), NOW);
    expect(a.signups_by_source).toBeNull();
    expect(a.signups_by_source_note).toBe(SOURCE_TABLE_MISSING_NOTE);
  });

  it('来源表存在：按周出各选项计数和 unanswered', async () => {
    const { svc } = service(true);
    const [a, b] = await svc.summarize(weekRanges(WEEK_B, 2), NOW);
    expect(a.signups_by_source).toMatchObject({ xiaohongshu: 1, douyin: 0, unanswered: 0 });
    expect(b.signups_by_source).toMatchObject({ xiaohongshu: 0, douyin: 2, unanswered: 1 });
    expect(Object.keys(b.signups_by_source!)).toEqual([
      'xiaohongshu', 'douyin', 'shipinhao', 'gongzhonghao', 'zhihu', 'bilibili', 'search', 'friend', 'other', 'unanswered']);
    expect(b.signups_by_source_note).toBeUndefined();
  });

  it('不能查未来的周；不传 week_start 就是本周', async () => {
    const { svc } = service();
    await expect(svc.report({ week_start: '2026-11-15' }, NOW)).rejects.toThrow(WeekError);
    const report = await svc.report({ weeks: '1' }, NOW);
    expect(report.weeks).toHaveLength(1);
    expect(report.weeks[0].week_start).toBe('2026-11-08T00:00:00+08:00');
    expect(report.generated_at).toBe('2026-11-11T12:00:00+08:00');
    expect(report.money_unit).toBe('分');
  });
});

// ---------- HTTP：令牌范围 ----------

class FakeJwtGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    if (req.headers.authorization !== `Bearer ${USER_JWT}`) throw new UnauthorizedException('请先登录');
    req.user = { id: 'u-a', tenantId: 't-1' };
    return true;
  }
}

const FORBIDDEN_KEYS = ['tenant_id', 'tenantId', 'user_id', 'userId', 'id', 'email', 'phone', 'name', 'order_no', 'event_id', 'visitor_id'];

function allKeys(value: unknown, out: string[] = []): string[] {
  if (Array.isArray(value)) value.forEach((v) => allKeys(v, out));
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) { out.push(k); allKeys(v, out); }
  }
  return out;
}

describe('只读令牌只开这一条 GET', () => {
  let app: INestApplication;
  const previous = process.env[READONLY_TOKEN_ENV];
  const tenantFunnel = jest.fn(() => ({ scope: 'tenant' }));

  beforeAll(async () => {
    jest.useFakeTimers({ now: new Date('2026-11-19T03:00:00+08:00'), doNotFake: ['nextTick', 'setImmediate', 'setTimeout', 'setInterval', 'queueMicrotask'] });
    const moduleRef = await Test.createTestingModule({
      controllers: [GrowthController, SiteFunnelController],
      providers: [
        SiteFunnelService,
        { provide: PrismaService, useValue: fakePrisma(false) },
        { provide: GrowthService, useValue: { getGrowthPlan: jest.fn(), updateGrowthPlan: jest.fn() } },
        { provide: GrowthTrafficService, useValue: { funnelForTenant: tenantFunnel, listSkills: () => [], ragStatus: () => ({}), recordForUser: jest.fn() } },
        { provide: HomeService, useValue: { signalsForUser: jest.fn() } },
        { provide: UsageService, useValue: { checkQuota: jest.fn() } },
      ],
    }).overrideGuard(JwtAuthGuard).useClass(FakeJwtGuard).compile();
    app = moduleRef.createNestApplication();
    configureApp(app, []);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    jest.useRealTimers();
    if (previous === undefined) delete process.env[READONLY_TOKEN_ENV];
    else process.env[READONLY_TOKEN_ENV] = previous;
  });

  beforeEach(() => { process.env[READONLY_TOKEN_ENV] = RO_TOKEN; });

  const ro = { Authorization: `Bearer ${RO_TOKEN}` };
  const path = '/api/v1/growth/site-funnel/weekly';

  it('只读令牌能读，响应里没有工作区或用户级字段', async () => {
    const res = await request(app.getHttpServer()).get(`${path}?week_start=2026-11-08&weeks=2`).set(ro);
    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(data.scope).toBe('site');
    expect(data.weeks.map((w: any) => w.week_start)).toEqual(['2026-11-01T00:00:00+08:00', '2026-11-08T00:00:00+08:00']);
    expect(data.weeks[1].order_amount_fen).toBe(99000 + 9900 + 19950);
    const keys = allKeys(res.body);
    for (const k of FORBIDDEN_KEYS) expect(keys).not.toContain(k);
    const text = JSON.stringify(res.body);
    for (const marker of ['t-1', 't-2', 'u-a', 'example.com', '138000', 'CFORDER']) expect(text).not.toContain(marker);
  });

  it('只读令牌调不了别的接口，也不能写', async () => {
    const server = app.getHttpServer();
    expect((await request(server).get('/api/v1/growth/funnel').set(ro)).status).toBe(401);
    expect((await request(server).get('/api/v1/growth/plan').set(ro)).status).toBe(401);
    expect((await request(server).post('/api/v1/growth/events').set(ro).send({ event: 'signup' })).status).toBe(401);
    expect((await request(server).put('/api/v1/growth/plan').set(ro).send({})).status).toBe(401);
    expect([403, 404]).toContain((await request(server).post(path).set(ro).send({})).status);
    expect([403, 404]).toContain((await request(server).delete(path).set(ro)).status);
    expect(tenantFunnel).not.toHaveBeenCalled();
  });

  it('当前工作区的 /growth/funnel 不变：登录令牌照常可用，且登录令牌不能读全站汇总', async () => {
    const server = app.getHttpServer();
    const tenant = await request(server).get('/api/v1/growth/funnel').set({ Authorization: `Bearer ${USER_JWT}` });
    expect(tenant.status).toBe(200);
    expect(tenantFunnel).toHaveBeenCalledWith('t-1');
    expect((await request(server).get(path).set({ Authorization: `Bearer ${USER_JWT}` })).status).toBe(403);
  });

  it('缺令牌 401、错令牌 403、未配置或为空即关闭', async () => {
    const server = app.getHttpServer();
    expect((await request(server).get(path)).status).toBe(401);
    expect((await request(server).get(path).set({ Authorization: 'Bearer wrong-token' })).status).toBe(403);
    expect((await request(server).get(path).set({ Authorization: RO_TOKEN })).status).toBe(401); // 不是 Bearer
    delete process.env[READONLY_TOKEN_ENV];
    expect((await request(server).get(path).set(ro)).status).toBe(403);
    process.env[READONLY_TOKEN_ENV] = '';
    expect((await request(server).get(path).set(ro)).status).toBe(403);
  });

  it('参数不对返回 422', async () => {
    const server = app.getHttpServer();
    expect((await request(server).get(`${path}?week_start=2026-11-07`).set(ro)).status).toBe(422);
    expect((await request(server).get(`${path}?weeks=27`).set(ro)).status).toBe(422);
    expect((await request(server).get(`${path}?week_start=2027-01-03`).set(ro)).status).toBe(422);
  });

  it('令牌比较走摘要，环境变量没设就不匹配', () => {
    expect(readonlyTokenMatches(RO_TOKEN, { [READONLY_TOKEN_ENV]: RO_TOKEN })).toBe(true);
    expect(readonlyTokenMatches(`${RO_TOKEN}x`, { [READONLY_TOKEN_ENV]: RO_TOKEN })).toBe(false);
    expect(readonlyTokenMatches('', { [READONLY_TOKEN_ENV]: RO_TOKEN })).toBe(false);
    expect(readonlyTokenMatches(RO_TOKEN, {})).toBe(false);
  });
});
