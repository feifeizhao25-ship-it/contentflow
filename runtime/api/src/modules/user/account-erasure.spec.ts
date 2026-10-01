/**
 * 注销与导出：不依赖数据库的部分。
 *
 * 真实 PostgreSQL 上的删除 / 保留 / 回滚 / 导出见 account-erasure.pg.spec.ts。
 */
import { INestApplication, ExecutionContext } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import * as fs from 'fs';
import * as path from 'path';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const request = require('supertest');
import { configureApp } from '../../bootstrap';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PrismaService } from '../../database/prisma.service';
import {
  AccountErasureService,
  PHONE_KEYED_TABLES,
  RETAINED_TABLES,
  TABLE_CLASSIFICATION,
  TENANT_OWNED_TABLES,
  USER_OWNED_TABLES,
} from './account-erasure.service';
import { UserController } from './user.controller';
import { UserService } from './user.service';

const SCHEMA = path.join(__dirname, '../../database/prisma/schema.prisma');

function tablesInSchema(): string[] {
  const text = fs.readFileSync(SCHEMA, 'utf8');
  const out: string[] = [];
  for (const m of text.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)) {
    const mapped = m[2].match(/@@map\("([^"]+)"\)/);
    out.push(mapped ? mapped[1] : m[1]);
  }
  return out;
}

describe('注销登记门禁：schema.prisma 里每张表都要回答「用户注销时怎么办」', () => {
  it('每张表都登记了归宿，登记里也没有已不存在的表', () => {
    const tables = tablesInSchema();
    expect(tables.length).toBeGreaterThan(30); // 扫描器没坏
    const unregistered = tables.filter((t) => !(t in TABLE_CLASSIFICATION));
    expect(unregistered).toEqual([]);
    const stale = Object.keys(TABLE_CLASSIFICATION).filter((t) => !tables.includes(t));
    expect(stale).toEqual([]);
  });

  it('删除清单与登记一致：登记为 user / tenant / retained 的表，与代码里实际处理的完全对应', () => {
    const of = (kind: string) =>
      Object.entries(TABLE_CLASSIFICATION).filter(([, v]) => v.kind === kind).map(([k]) => k).sort();
    // ContentAnnotation、ContentPrediction 既按 user_id 删，也随 Content 级联，登记为 user
    expect(USER_OWNED_TABLES.map((t) => t.table).sort()).toEqual(of('user'));
    expect([...TENANT_OWNED_TABLES].sort()).toEqual(of('tenant'));
    expect(RETAINED_TABLES.map((t) => t.table).sort()).toEqual(of('retained'));
    expect(PHONE_KEYED_TABLES.map((t) => t.table).sort()).toEqual(of('phone'));
  });

  it('依法保留的表，绝不出现在删除清单里', () => {
    const retained = new Set(RETAINED_TABLES.map((t) => t.table));
    for (const { table } of USER_OWNED_TABLES) expect(retained.has(table)).toBe(false);
    for (const table of TENANT_OWNED_TABLES) expect(retained.has(table)).toBe(false);
  });

  it('cascade / global 必须写明理由', () => {
    for (const [name, v] of Object.entries(TABLE_CLASSIFICATION)) {
      if (v.kind === 'cascade' || v.kind === 'global') expect(v.note?.trim()).toBeTruthy();
      void name;
    }
  });

  it('工作区行不能被删：PaymentOrder、Subscription 对 Tenant 是 ON DELETE CASCADE', () => {
    const migrations = path.join(__dirname, '../../database/prisma/migrations');
    const sql = fs
      .readdirSync(migrations)
      .filter((d) => fs.statSync(path.join(migrations, d)).isDirectory())
      .map((d) => fs.readFileSync(path.join(migrations, d, 'migration.sql'), 'utf8'))
      .join('\n');
    for (const table of ['PaymentOrder', 'Subscription']) {
      expect(sql).toMatch(new RegExp(`ALTER TABLE "${table}" ADD CONSTRAINT "[^"]+" FOREIGN KEY \\("tenant_id"\\) REFERENCES "Tenant"\\("id"\\) ON DELETE CASCADE`));
    }
    // 因此 erase 里对 Tenant / User 只有 UPDATE（匿名化），没有 DELETE
    const src = fs.readFileSync(path.join(__dirname, 'account-erasure.service.ts'), 'utf8');
    expect(src).not.toMatch(/DELETE FROM "(Tenant|User)"/);
  });
});

describe('POST /users/me/delete-account 与 GET /users/me/export（接口层）', () => {
  let app: INestApplication;
  const prisma: any = {
    user: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), update: jest.fn() },
    $transaction: jest.fn(),
  };
  const ME = { id: 'u-1', sub: 'u-1', tenantId: 't-1', role: 'owner', email: 'me@example.com' };

  beforeEach(async () => {
    jest.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [UserController],
      providers: [UserService, AccountErasureService, { provide: PrismaService, useValue: prisma }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (ctx: ExecutionContext) => {
          ctx.switchToHttp().getRequest().user = ME;
          return true;
        },
      })
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app, []);
    await app.init();
  });
  afterEach(async () => app.close());

  it('没有 confirm=true：400，什么都不执行', async () => {
    for (const body of [{}, { confirm: false }, { confirm: 'yes' }, { confirm: 'false' }, { confirm: 1 }]) {
      await request(app.getHttpServer()).post('/api/v1/users/me/delete-account').send(body).expect(400);
    }
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('请求体里塞别人的 user_id：被拒绝（身份只取自令牌）', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/users/me/delete-account')
      .send({ confirm: true, user_id: 'someone-else' })
      .expect(400);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('有密码的账号：密码不对 401，不对就不执行', async () => {
    prisma.user.findUnique.mockResolvedValue({ password_hash: await bcrypt.hash('right-pass', 4), status: 'active' });
    await request(app.getHttpServer()).post('/api/v1/users/me/delete-account').send({ confirm: true }).expect(401);
    await request(app.getHttpServer())
      .post('/api/v1/users/me/delete-account')
      .send({ confirm: true, password: 'wrong' })
      .expect(401);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('密码正确：执行注销，返回保留说明；注销的是令牌里的人', async () => {
    prisma.user.findUnique.mockResolvedValue({ password_hash: await bcrypt.hash('right-pass', 4), status: 'active' });
    prisma.$transaction.mockImplementation(async (fn: any) => {
      const tx = {
        $queryRawUnsafe: jest.fn().mockImplementation(async (sql: string) =>
          sql.includes('FROM "User" WHERE id = $1')
            ? [{ id: 'u-1', tenant_id: 't-1', role: 'owner', status: 'active' }]
            : [],
        ),
        $executeRawUnsafe: jest.fn().mockResolvedValue(1),
      };
      const result = await fn(tx);
      prisma.__tx = tx;
      return result;
    });
    const res = await request(app.getHttpServer())
      .post('/api/v1/users/me/delete-account')
      .send({ confirm: true, password: 'right-pass' })
      .expect(200);
    expect(JSON.stringify(res.body)).toContain('deleted');
    expect(JSON.stringify(res.body)).toContain('PaymentOrder');
    const firstQuery = prisma.__tx.$queryRawUnsafe.mock.calls[0];
    expect(firstQuery[1]).toBe('u-1');
  });

  it('账号已注销：404', async () => {
    prisma.user.findUnique.mockResolvedValue({ password_hash: null, status: 'deleted' });
    await request(app.getHttpServer()).post('/api/v1/users/me/delete-account').send({ confirm: true }).expect(404);
  });

  it('导出路由存在，且不会被 :id 抢走', async () => {
    prisma.$transaction.mockImplementation(async (fn: any) =>
      fn({
        $queryRawUnsafe: jest.fn().mockResolvedValue([]),
        $executeRawUnsafe: jest.fn(),
      }),
    );
    // 账号不存在 → 404（若被 :id 抢走，会走 findInTenant 得到别的响应体）
    const res = await request(app.getHttpServer()).get('/api/v1/users/me/export');
    expect(res.status).toBe(404);
    expect(prisma.user.findFirst).not.toHaveBeenCalled();
  });
});

describe('注销时手机号相关数据（验证码记录、同意记录、实名标记）', () => {
  const PHONE = '13800138000';
  const run = async (config: any) => {
    const calls: Array<{ sql: string; params: unknown[] }> = [];
    const tx = {
      $queryRawUnsafe: jest.fn(async (sql: string, ...params: unknown[]) => {
        calls.push({ sql, params });
        if (/FROM "User" WHERE id = \$1 FOR UPDATE/.test(sql)) {
          return [{ id: 'u-1', tenant_id: 't-1', role: 'owner', status: 'active', phone: PHONE }];
        }
        return [];
      }),
      $executeRawUnsafe: jest.fn(async (sql: string, ...params: unknown[]) => {
        calls.push({ sql, params });
        return 0;
      }),
    };
    const runner = { $transaction: async (fn: any) => fn(tx) };
    const service = new AccountErasureService(runner as any, config);
    await service.erase('u-1');
    return calls;
  };

  it('按手机号哈希删除该手机号的全部验证码记录，且在手机号被清空之前', async () => {
    const config = { get: (k: string) => ({ SMS_CODE_HMAC_SECRET: 'x'.repeat(32), NODE_ENV: 'production' } as any)[k] };
    const calls = await run(config);
    const del = calls.findIndex((c) => /DELETE FROM "SmsVerificationCode" WHERE phone_hash = \$1/.test(c.sql));
    const anonymise = calls.findIndex((c) => /UPDATE "User" SET/.test(c.sql));
    expect(del).toBeGreaterThanOrEqual(0);
    expect(anonymise).toBeGreaterThan(del);
    // 参数是哈希，不是明文手机号
    expect(calls[del].params).toHaveLength(1);
    expect(String(calls[del].params[0])).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(calls[del].params)).not.toContain(PHONE);
  });

  it('匿名化 User 时一并清掉手机号、实名标记与同意记录', async () => {
    const config = { get: (k: string) => ({ SMS_CODE_HMAC_SECRET: 'x'.repeat(32) } as any)[k] };
    const calls = await run(config);
    const update = calls.find((c) => /UPDATE "User" SET/.test(c.sql))!;
    expect(update.sql).toMatch(/phone = NULL/);
    expect(update.sql).toMatch(/real_name_verified = FALSE/);
    expect(update.sql).toMatch(/consent_version = NULL/);
    expect(update.sql).toMatch(/consent_at = NULL/);
  });

  it('没配置短信密钥时没有验证码可删：不报错，也不拿空密钥算哈希', async () => {
    const calls = await run({ get: () => undefined });
    expect(calls.some((c) => /SmsVerificationCode/.test(c.sql))).toBe(false);
  });
});

describe('导出个人信息包含手机号', () => {
  it('账号块来自整行 to_jsonb(u)，只排除口令哈希、第三方登录、权限，手机号与同意记录会导出', () => {
    const src = fs.readFileSync(path.join(__dirname, 'account-erasure.service.ts'), 'utf8');
    expect(src).toMatch(/to_jsonb\(u\) - 'password_hash' - 'oauth_providers' - 'permissions'/);
  });

  it('导出结果里确有 phone / consent_version（行为测试）', async () => {
    const row = { id: 'u-1', tenant_id: 't-1', phone: '13800138000', phone_verified: true, consent_version: '2026-08-22' };
    const tx = {
      $queryRawUnsafe: jest.fn(async (sql: string) => (/to_jsonb\(u\)/.test(sql) ? [{ row }] : [])),
      $executeRawUnsafe: jest.fn(),
    };
    const service = new AccountErasureService({ $transaction: async (fn: any) => fn(tx) } as any);
    const out: any = await service.export('u-1');
    expect(out.account.phone).toBe('13800138000');
    expect(out.account.consent_version).toBe('2026-08-22');
  });
});
