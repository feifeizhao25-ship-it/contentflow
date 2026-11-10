/**
 * 真实 PostgreSQL 上的邀请并发。
 * CF_TEST_PG_DSN=postgresql://cf:cf@127.0.0.1:5432/postgres npx jest team-invites.pg
 */
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import { TeamService } from './team.service';
import { RecordingTeamInviteMailer } from './team-invite.mailer';

const DSN = process.env.CF_TEST_PG_DSN || '';
const d = DSN ? describe : describe.skip;

d('团队邀请并发 × PostgreSQL', () => {
  let admin: any;
  let dbName: string;
  let prisma: PrismaClient;
  const now = new Date('2026-11-10T00:00:00Z');

  beforeAll(async () => {
    const { Client } = require('pg') as typeof import('pg');
    admin = new Client({ connectionString: DSN });
    await admin.connect();
    dbName = `cfinv_${randomUUID().replace(/-/g, '').slice(0, 10)}`;
    await admin.query(`CREATE DATABASE "${dbName}"`);
    const url = new URL(DSN);
    url.pathname = `/${dbName}`;
    const db = new Client({ connectionString: url.toString() });
    await db.connect();
    const dir = path.join(__dirname, '../../database/prisma/migrations');
    for (const name of fs.readdirSync(dir).filter((item) => fs.statSync(path.join(dir, item)).isDirectory()).sort()) {
      await db.query(fs.readFileSync(path.join(dir, name, 'migration.sql'), 'utf8'));
    }
    await db.end();
    prisma = new PrismaClient({ datasources: { db: { url: url.toString() } } });
    await prisma.$connect();
  }, 120_000);

  afterAll(async () => {
    await prisma?.$disconnect();
    await admin?.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);
    await admin?.end();
  });

  async function ownerOn(plan: string) {
    const slug = `t-${randomUUID().slice(0, 8)}`;
    const tenant = await prisma.tenant.create({ data: { name: slug, slug, plan, limits: {} } });
    const owner = await prisma.user.create({
      data: { tenant_id: tenant.id, email: `${slug}@example.com`, role: 'owner', status: 'active' },
    });
    return { tenant, owner };
  }

  async function solo(email: string) {
    const slug = `s-${randomUUID().slice(0, 8)}`;
    const tenant = await prisma.tenant.create({ data: { name: slug, slug, plan: 'free', limits: {} } });
    return prisma.user.create({ data: { tenant_id: tenant.id, email, role: 'owner', status: 'active' } });
  }

  it('同一个链接的两次接受只有一次成功', async () => {
    const { tenant, owner } = await ownerOn('team');
    const left = await solo(`left-${tenant.slug}@example.com`);
    const right = await solo(`right-${tenant.slug}@example.com`);
    const service = new TeamService(prisma as never, new RecordingTeamInviteMailer());
    const invite = await service.createInvite(tenant.id, owner.id, {}, now);
    const results = await Promise.allSettled([
      service.acceptInvite(left.id, invite.token, now),
      service.acceptInvite(right.id, invite.token, now),
    ]);
    expect(results.filter((item) => item.status === 'fulfilled')).toHaveLength(1);
    const joined = await prisma.user.count({ where: { tenant_id: tenant.id, status: 'active', role: { not: 'owner' } } });
    expect(joined).toBe(1);
    expect(await prisma.teamInvite.count({ where: { id: invite.id, status: 'accepted' } })).toBe(1);
  });

  it('只剩一个席位时同时创建多份邀请，只有一份成功', async () => {
    const { tenant, owner } = await ownerOn('team');
    const service = new TeamService(prisma as never, new RecordingTeamInviteMailer());
    for (let i = 0; i < 3; i += 1) {
      await service.createInvite(tenant.id, owner.id, { email: `held-${i}-${tenant.slug}@example.com` }, now);
    }
    const results = await Promise.allSettled(
      Array.from({ length: 6 }, (_, i) => service.createInvite(tenant.id, owner.id, { email: `race-${i}-${tenant.slug}@example.com` }, now)),
    );
    expect(results.filter((item) => item.status === 'fulfilled')).toHaveLength(1);
    expect(await prisma.teamInvite.count({ where: { tenant_id: tenant.id, status: 'pending' } })).toBe(4);
  });
});
