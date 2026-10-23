/**
 * 注销与导出：真实 PostgreSQL。
 *
 * 用项目自己的迁移文件建库，再把 pg 连接包成 Prisma 事务客户端的最小接口交给服务。
 * 需要环境变量 CF_TEST_PG_DSN（能 CREATE DATABASE 的账号）；没有则整组跳过。
 *
 *   CF_TEST_PG_DSN=postgresql://postgres@127.0.0.1:5432/postgres npx jest account-erasure.pg
 */
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { ConflictException, NotFoundException } from '@nestjs/common';
import {
  AccountErasureService,
  RETAINED_TABLES,
  SqlTx,
  TENANT_OWNED_TABLES,
  TxRunner,
} from './account-erasure.service';

const DSN = process.env.CF_TEST_PG_DSN || '';
const d = DSN ? describe : describe.skip;

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Client } = DSN ? require('pg') : { Client: null };

class PgTx implements SqlTx {
  constructor(private readonly c: any) {}
  async $executeRawUnsafe(sql: string, ...p: unknown[]) {
    return (await this.c.query(sql, p)).rowCount ?? 0;
  }
  async $queryRawUnsafe<T = any>(sql: string, ...p: unknown[]): Promise<T> {
    return (await this.c.query(sql, p)).rows as T;
  }
}

d('AccountErasureService × PostgreSQL', () => {
  let admin: any;
  let db: any;
  let dbName: string;
  let service: AccountErasureService;

  const runner = (client: any): TxRunner & { user: any } => ({
    user: {
      findUnique: async () => null,
    },
    async $transaction<T>(fn: (tx: SqlTx) => Promise<T>): Promise<T> {
      await client.query('BEGIN');
      try {
        const r = await fn(new PgTx(client));
        await client.query('COMMIT');
        return r;
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      }
    },
  });

  beforeAll(async () => {
    admin = new Client({ connectionString: DSN });
    await admin.connect();
    dbName = `cf_${randomUUID().replace(/-/g, '').slice(0, 10)}`;
    await admin.query(`CREATE DATABASE "${dbName}"`);
    const u = new URL(DSN);
    u.pathname = `/${dbName}`;
    db = new Client({ connectionString: u.toString() });
    await db.connect();
    const dir = path.join(__dirname, '../../database/prisma/migrations');
    for (const m of fs.readdirSync(dir).filter((x) => fs.statSync(path.join(dir, x)).isDirectory()).sort()) {
      await db.query(fs.readFileSync(path.join(dir, m, 'migration.sql'), 'utf8'));
    }
    service = new AccountErasureService(runner(db) as any);
  });

  afterAll(async () => {
    await db?.end();
    await admin?.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);
    await admin?.end();
  });

  const q = async (sql: string, ...p: unknown[]) => (await db.query(sql, p)).rows;
  const count = async (sql: string, ...p: unknown[]) => Number((await q(sql, ...p))[0].n);

  /** 造一个工作区、一个所有者，以及各表里属于他们的数据。tag 会写进正文，用来在库里全文搜索残留。 */
  async function seedWorkspace(tag: string, opts: { members?: number } = {}) {
    const tenant = `t-${tag}`;
    const owner = `u-${tag}`;
    await db.query(`INSERT INTO "Tenant" (id, name, slug, updated_at, plan) VALUES ($1, $2, $3, NOW(), 'pro')`, [tenant, `工作室-${tag}`, `slug-${tag}`]);
    await db.query(
      `INSERT INTO "User" (id, tenant_id, email, phone, password_hash, name, role, updated_at) VALUES ($1,$2,$3,$4,$5,$6,'owner',NOW())`,
      [owner, tenant, `${tag}@example.com`, `138${tag}`, `hash-secret-${tag}`, `姓名-${tag}`],
    );
    const members: string[] = [];
    for (let i = 0; i < (opts.members ?? 0); i++) {
      const id = `m${i}-${tag}`;
      members.push(id);
      await db.query(`INSERT INTO "User" (id, tenant_id, email, role, updated_at) VALUES ($1,$2,$3,'member',NOW())`, [id, tenant, `${id}@example.com`]);
    }
    const s = (n: string) => `${n}-${tag}`;
    await db.query(`INSERT INTO "Content" (id, tenant_id, created_by, content_type, title, body, updated_at) VALUES ($1,$2,$3,'article',$4,$5,NOW())`, [s('c'), tenant, owner, `标题-${tag}`, `正文-${tag}`]);
    await db.query(`INSERT INTO "PlatformAccount" (id, tenant_id, created_by, platform, auth_type, auth_data_encrypted, auth_refresh_token_encrypted, account_name, updated_at) VALUES ($1,$2,$3,'douyin','oauth',$5,$6,$4,NOW())`, [s('pa'), tenant, owner, `账号名-${tag}`, `TOKEN-SECRET-${tag}`, `REFRESH-SECRET-${tag}`]);
    await db.query(`INSERT INTO "PublishTask" (id, tenant_id, content_id, created_by, updated_at) VALUES ($1,$2,$3,$4,NOW())`, [s('pt'), tenant, s('c'), owner]);
    await db.query(`INSERT INTO "Material" (id, tenant_id, created_by, material_type, name, file_url, updated_at) VALUES ($1,$2,$3,'image',$4,'https://x/y.png',NOW())`, [s('mat'), tenant, owner, `素材-${tag}`]);
    await db.query(`INSERT INTO "AIGeneration" (id, tenant_id, user_id, generation_type, input_params, output_content) VALUES ($1,$2,$3,'text','{}'::jsonb,$4)`, [s('ai'), tenant, owner, `生成内容-${tag}`]);
    await db.query(`INSERT INTO "ApiKey" (id, tenant_id, created_by, name, key_prefix, key_hash) VALUES ($1,$2,$3,'k','pre','hash')`, [s('key'), tenant, owner]);
    await db.query(`INSERT INTO "UserNotification" (id, user_id, notification_type, title, content) VALUES ($1,$2,'sys',$3,$4)`, [s('n'), owner, '通知', `通知正文-${tag}`]);
    await db.query(`INSERT INTO "UserSession" (id, user_id, token_hash) VALUES ($1,$2,$3)`, [s('sess'), owner, s('th')]);
    await db.query(`INSERT INTO "UserPoints" (id, user_id, updated_at) VALUES ($1,$2,NOW())`, [s('up'), owner]);
    await db.query(`INSERT INTO "PointsLog" (id, user_id, points_change, balance_before, balance_after, log_type) VALUES ($1,$2,5,0,5,'checkin')`, [s('pl'), s('up')]);
    await db.query(`INSERT INTO "GrowthGoal" (id, user_id, target_type, target_value, start_date, end_date, updated_at) VALUES ($1,$2,'followers',100,NOW(),NOW(),NOW())`, [s('g'), owner]);
    // 依法保留
    await db.query(`INSERT INTO "Subscription" (id, tenant_id, plan, billing_cycle, current_period_start, current_period_end, updated_at) VALUES ($1,$2,'pro','monthly',NOW(),NOW() + interval '30 day',NOW())`, [s('sub'), tenant]);
    await db.query(`INSERT INTO "PaymentOrder" (id, tenant_id, subscription_id, order_no, order_type, amount, updated_at, idempotency_key, plan_id, billing_cycle) VALUES ($1,$2,$3,$4,'subscription',99,NOW(),$5,'pro','monthly')`, [s('po'), tenant, s('sub'), `NO-${tag}`, s('idem')]);
    await db.query(`INSERT INTO "ActivityLog" (id, tenant_id, user_id, action, resource_type, details, ip_address) VALUES ($1,$2,$3,'login','user','{}'::jsonb,'1.2.3.4')`, [s('al'), tenant, owner]);
    await db.query(`INSERT INTO "UsageRecord" (id, tenant_id, usage_type) VALUES ($1,$2,'ai')`, [s('ur'), tenant]);
    return { tenant, owner, members, tag };
  }

  it('唯一在职成员注销：个人数据与工作区业务数据全部删除，订单/订阅/日志保留，行匿名化', async () => {
    const a = await seedWorkspace('solo');
    const b = await seedWorkspace('bystander'); // 别的工作区，必须原样不动

    const r = await service.erase(a.owner);
    expect(r.workspaceDeleted).toBe(true);

    for (const t of ['Content', 'PlatformAccount', 'PublishTask', 'Material', 'AIGeneration', 'ApiKey']) {
      expect(await count(`SELECT count(*) n FROM "${t}" WHERE tenant_id = $1`, a.tenant)).toBe(0);
    }
    for (const [t, col] of [['UserNotification', 'user_id'], ['UserSession', 'user_id'], ['UserPoints', 'user_id'], ['GrowthGoal', 'user_id']]) {
      expect(await count(`SELECT count(*) n FROM "${t}" WHERE ${col} = $1`, a.owner)).toBe(0);
    }
    expect(await count(`SELECT count(*) n FROM "PointsLog" WHERE id = 'pl-solo'`)).toBe(0); // 随 UserPoints 级联

    // 依法保留
    expect(await count(`SELECT count(*) n FROM "PaymentOrder" WHERE tenant_id = $1`, a.tenant)).toBe(1);
    expect(await count(`SELECT count(*) n FROM "Subscription" WHERE tenant_id = $1`, a.tenant)).toBe(1);
    expect(await count(`SELECT count(*) n FROM "ActivityLog" WHERE tenant_id = $1`, a.tenant)).toBe(1);
    expect(await count(`SELECT count(*) n FROM "UsageRecord" WHERE tenant_id = $1`, a.tenant)).toBe(1);
    expect((await q(`SELECT status, cancel_at_period_end FROM "Subscription" WHERE tenant_id = $1`, a.tenant))[0]).toEqual({ status: 'cancelled', cancel_at_period_end: true });

    // 匿名化而不是删除
    const t = (await q(`SELECT name, slug, logo_url, status FROM "Tenant" WHERE id = $1`, a.tenant))[0];
    expect(t).toEqual({ name: '已注销工作区', slug: `deleted-${a.tenant}`, logo_url: null, status: 'deleted' });
    const u = (await q(`SELECT email, phone, password_hash, name, avatar_url, status FROM "User" WHERE id = $1`, a.owner))[0];
    expect(u).toEqual({ email: `deleted-${a.owner}@deleted.invalid`, phone: null, password_hash: null, name: null, avatar_url: null, status: 'deleted' });

    // 全库文本搜索：除了依法保留的表，任何地方都不应再出现这个人的标记文字与凭据
    const leftovers: string[] = [];
    const tables = (await q(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'`)).map((x: any) => x.table_name);
    const retained = new Set(RETAINED_TABLES.map((x) => x.table));
    for (const table of tables) {
      if (retained.has(table)) continue;
      const rows = await q(`SELECT to_jsonb(t)::text AS j FROM "${table}" t`);
      for (const row of rows) {
        if (/(标题|正文|账号名|素材|生成内容|通知正文|姓名)-solo|SECRET-solo|solo@example\.com/.test(row.j)) leftovers.push(`${table}: ${row.j.slice(0, 80)}`);
      }
    }
    expect(leftovers).toEqual([]);

    // 别的工作区一行没动
    expect(await count(`SELECT count(*) n FROM "Content" WHERE tenant_id = $1`, b.tenant)).toBe(1);
    expect(await count(`SELECT count(*) n FROM "PlatformAccount" WHERE tenant_id = $1 AND auth_data_encrypted = 'TOKEN-SECRET-bystander'`, b.tenant)).toBe(1);
    expect((await q(`SELECT status FROM "Subscription" WHERE tenant_id = $1`, b.tenant))[0].status).toBe('active');
    expect((await q(`SELECT status, name FROM "User" WHERE id = $1`, b.owner))[0]).toEqual({ status: 'active', name: '姓名-bystander' });

    // 再注销一次：明确报「不存在」
    await expect(service.erase(a.owner)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('工作区还有其他成员时，所有者不能注销（409），一行都不动', async () => {
    const w = await seedWorkspace('team', { members: 1 });
    await expect(service.erase(w.owner)).rejects.toBeInstanceOf(ConflictException);
    expect(await count(`SELECT count(*) n FROM "Content" WHERE tenant_id = $1`, w.tenant)).toBe(1);
    expect(await count(`SELECT count(*) n FROM "UserNotification" WHERE user_id = $1`, w.owner)).toBe(1);
    expect((await q(`SELECT status FROM "User" WHERE id = $1`, w.owner))[0].status).toBe('active');
  });

  it('普通成员注销：只删自己的个人数据，工作区的内容属于工作区，保留', async () => {
    const w = await seedWorkspace('crew', { members: 1 });
    const member = w.members[0];
    await db.query(`INSERT INTO "UserNotification" (id, user_id, notification_type, title, content) VALUES ('n-member', $1, 'sys', 't', '成员通知')`, [member]);
    await db.query(`INSERT INTO "Content" (id, tenant_id, created_by, content_type, title, updated_at) VALUES ('c-by-member', $1, $2, 'article', '成员写的', NOW())`, [w.tenant, member]);

    const r = await service.erase(member);
    expect(r.workspaceDeleted).toBe(false);
    expect(await count(`SELECT count(*) n FROM "UserNotification" WHERE user_id = $1`, member)).toBe(0);
    expect(await count(`SELECT count(*) n FROM "Content" WHERE tenant_id = $1`, w.tenant)).toBe(2); // 工作区内容还在
    expect((await q(`SELECT status FROM "Tenant" WHERE id = $1`, w.tenant))[0].status).toBe('active');
    expect((await q(`SELECT status FROM "Subscription" WHERE tenant_id = $1`, w.tenant))[0].status).toBe('active');
    expect((await q(`SELECT status, email FROM "User" WHERE id = $1`, member))[0]).toEqual({ status: 'deleted', email: `deleted-${member}@deleted.invalid` });
    // 所有者不受影响
    expect((await q(`SELECT status FROM "User" WHERE id = $1`, w.owner))[0].status).toBe('active');
  });

  it('全有或全无：中途任何一步失败，前面已执行的删除也回滚', async () => {
    const w = await seedWorkspace('atomic');
    (TENANT_OWNED_TABLES as string[]).push('no_such_table');
    try {
      await expect(service.erase(w.owner)).rejects.toThrow();
    } finally {
      (TENANT_OWNED_TABLES as string[]).pop();
    }
    expect(await count(`SELECT count(*) n FROM "UserNotification" WHERE user_id = $1`, w.owner)).toBe(1);
    expect(await count(`SELECT count(*) n FROM "Content" WHERE tenant_id = $1`, w.tenant)).toBe(1);
    expect((await q(`SELECT status FROM "User" WHERE id = $1`, w.owner))[0].status).toBe('active');
  });

  it('并发：同一个人同时注销两次，只有一次成功', async () => {
    const w = await seedWorkspace('race');
    // 两个独立连接，才能真正并发
    const u = new URL(DSN);
    u.pathname = `/${dbName}`;
    const c2 = new Client({ connectionString: u.toString() });
    await c2.connect();
    try {
      const s1 = new AccountErasureService(runner(db) as any);
      const s2 = new AccountErasureService(runner(c2) as any);
      const results = await Promise.allSettled([s1.erase(w.owner), s2.erase(w.owner)]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
    } finally {
      await c2.end();
    }
  });

  it('导出：含本人的数据；不含口令哈希、平台授权凭据；不含别的工作区', async () => {
    const mine = await seedWorkspace('exp');
    await seedWorkspace('other-exp');
    const data: any = await service.export(mine.owner);
    const text = JSON.stringify(data);
    expect(data.account.email).toBe('exp@example.com');
    expect(text).toContain('通知正文-exp');
    expect(text).toContain('标题-exp');
    expect(text).toContain('生成内容-exp');
    expect(data.orders).toHaveLength(1);
    for (const secret of ['hash-secret-exp', 'TOKEN-SECRET-exp', 'REFRESH-SECRET-exp', 'password_hash', 'auth_data_encrypted', 'payment_url', 'idempotency_key']) {
      expect(text).not.toContain(secret);
    }
    expect(text).not.toContain('-other-exp');
    // 注销后不能再导出
    await service.erase(mine.owner);
    await expect(service.export(mine.owner)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('同一邮箱可以重新注册（新工作区、新账号）', async () => {
    const w = await seedWorkspace('again');
    await service.erase(w.owner);
    await db.query(`INSERT INTO "Tenant" (id, name, slug, updated_at) VALUES ('t-again2', 'n', 'slug-again2', NOW())`);
    await db.query(`INSERT INTO "User" (id, tenant_id, email, role, updated_at) VALUES ('u-again2', 't-again2', 'again@example.com', 'owner', NOW())`);
    expect(await count(`SELECT count(*) n FROM "User" WHERE email = 'again@example.com' AND status <> 'deleted'`)).toBe(1);
  });
});
