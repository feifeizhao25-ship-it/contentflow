/**
 * 真实 PostgreSQL 上的额度预占。
 * 并发用例拉起两个独立 Node 进程，连同一个库，确认条件更新不会让两个实例一起超用。
 *
 *   CF_TEST_PG_DSN=postgresql://cf:cf@127.0.0.1:5432/postgres npx jest ai-quota-reservation.pg
 */
import { execFileSync } from 'child_process';
import { fork } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { UsageService } from './usage.service';

const DSN = process.env.CF_TEST_PG_DSN || '';
const d = DSN ? describe : describe.skip;

d('AI 额度预占 × PostgreSQL（两个进程）', () => {
  let admin: any;
  let dbName: string;
  let databaseUrl: string;
  let prisma: PrismaClient;
  let usage: UsageService;
  const procJs = path.join(__dirname, '../../../dist/modules/system/ai-quota-reservation.proc.js');

  beforeAll(async () => {
    execFileSync('npx', ['tsc', '--pretty', 'false', '--incremental', 'false'], {
      cwd: path.join(__dirname, '../../..'),
      stdio: 'inherit',
    });
    const { Client } = require('pg') as typeof import('pg');
    admin = new Client({ connectionString: DSN });
    await admin.connect();
    dbName = `cfq_${randomUUID().replace(/-/g, '').slice(0, 10)}`;
    await admin.query(`CREATE DATABASE "${dbName}"`);
    const url = new URL(DSN);
    url.pathname = `/${dbName}`;
    databaseUrl = url.toString();
    const db = new Client({ connectionString: databaseUrl });
    await db.connect();
    const dir = path.join(__dirname, '../../database/prisma/migrations');
    for (const name of fs.readdirSync(dir).filter((item) => fs.statSync(path.join(dir, item)).isDirectory()).sort()) {
      await db.query(fs.readFileSync(path.join(dir, name, 'migration.sql'), 'utf8'));
    }
    await db.end();
    prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    await prisma.$connect();
    usage = new UsageService(prisma as never);
  }, 120_000);

  afterAll(async () => {
    await prisma?.$disconnect();
    await admin?.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);
    await admin?.end();
  });

  async function tenant(limit: number) {
    const slug = `q-${randomUUID().slice(0, 8)}`;
    return prisma.tenant.create({
      data: { name: slug, slug, plan: 'pro', limits: { max_ai_tokens_monthly: limit } },
    });
  }

  function reserveInProcess(tenantId: string, holdTokens: number, idempotencyKey: string) {
    return new Promise<{ action: string; reservationId?: string }>((resolve, reject) => {
      const child = fork(procJs, [tenantId, String(holdTokens), idempotencyKey], {
        env: { ...process.env, DATABASE_URL: databaseUrl },
        stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      });
      let out = '';
      let err = '';
      child.stdout?.on('data', (chunk) => { out += String(chunk); });
      child.stderr?.on('data', (chunk) => { err += String(chunk); });
      child.on('exit', (code) => {
        const line = out.trim().split('\n').filter(Boolean).pop();
        if (!line) {
          reject(new Error(`预占进程没有输出（退出码 ${code}）：${err}`));
          return;
        }
        const parsed = JSON.parse(line) as { ok: boolean; result?: { action: string; reservationId?: string }; message?: string };
        if (!parsed.ok) {
          reject(new Error(parsed.message || err || '预占进程失败'));
          return;
        }
        resolve(parsed.result as { action: string; reservationId?: string });
      });
    });
  }

  it('两个进程同时各占 6000，额度只有 10000 时只有一个成功', async () => {
    const row = await tenant(10000);
    const [left, right] = await Promise.all([
      reserveInProcess(row.id, 6000, 'proc-a-hold-0001'),
      reserveInProcess(row.id, 6000, 'proc-b-hold-0002'),
    ]);
    const actions = [left.action, right.action].sort();
    expect(actions).toEqual(['quota', 'reserved']);
    const meter = await prisma.usageMeter.findFirst({ where: { tenant_id: row.id } });
    expect(meter).toMatchObject({ ai_tokens: 0, ai_tokens_reserved: 6000 });
    expect(await prisma.aiQuotaReservation.count({ where: { tenant_id: row.id, status: 'held' } })).toBe(1);
  });

  it('两个进程用同一个幂等键不会占两次', async () => {
    const row = await tenant(10000);
    const [left, right] = await Promise.all([
      reserveInProcess(row.id, 4000, 'same-key-0001'),
      reserveInProcess(row.id, 4000, 'same-key-0001'),
    ]);
    const actions = [left.action, right.action].sort();
    expect(actions).toEqual(['in_progress', 'reserved']);
    const meter = await prisma.usageMeter.findFirst({ where: { tenant_id: row.id } });
    expect(meter?.ai_tokens_reserved).toBe(4000);
    expect(await prisma.aiQuotaReservation.count({ where: { tenant_id: row.id } })).toBe(1);
  });

  it('模型已成功但入账失败时，对账只补记一次，不再调用模型', async () => {
    const row = await tenant(20000);
    const user = await prisma.user.create({ data: { tenant_id: row.id, email: `${row.slug}@example.com` } });
    const reserved = await usage.reserveAiTokens({
      tenantId: row.id, holdTokens: 8000, kind: 'article', idempotencyKey: 'settle-key-0001',
    });
    expect(reserved.action).toBe('reserved');
    if (reserved.action !== 'reserved') return;
    await usage.saveAiSettlement(reserved.reservationId, {
      tokens: 9000,
      images: 0,
      type: 'article',
      attachContentId: null,
      response: { text: '已生成' },
      generation: {
        userId: user.id,
        generationType: 'article',
        inputParams: { topic: '测试' },
        outputContent: '已生成',
        status: 'success',
      },
    });
    const first = await usage.reconcileAiReservations();
    expect(first.committed).toBe(1);
    const meter = await prisma.usageMeter.findFirst({ where: { tenant_id: row.id } });
    expect(meter).toMatchObject({ ai_tokens: 9000, ai_tokens_reserved: 0 });
    expect(await prisma.aIGeneration.count({ where: { tenant_id: row.id } })).toBe(1);
    expect(await prisma.costLedger.count({ where: { tenant_id: row.id, ref_id: reserved.reservationId } })).toBe(1);
    const second = await usage.reconcileAiReservations();
    expect(second.committed).toBe(0);
    expect(await prisma.aIGeneration.count({ where: { tenant_id: row.id } })).toBe(1);
    const replay = await usage.reserveAiTokens({
      tenantId: row.id, holdTokens: 8000, kind: 'article', idempotencyKey: 'settle-key-0001',
    });
    expect(replay.action).toBe('replay');
  });

  it('模型调用失败时退回预占', async () => {
    const row = await tenant(10000);
    await expect(usage.withAiHold(
      { tenantId: row.id, holdTokens: 3000, kind: 'article', idempotencyKey: 'fail-key-0001' },
      async () => { throw new Error('模型失败'); },
    )).rejects.toThrow('模型失败');
    const meter = await prisma.usageMeter.findFirst({ where: { tenant_id: row.id } });
    expect(meter).toMatchObject({ ai_tokens: 0, ai_tokens_reserved: 0 });
    const again = await usage.reserveAiTokens({
      tenantId: row.id, holdTokens: 3000, kind: 'article', idempotencyKey: 'fail-key-0001',
    });
    expect(again.action).toBe('reserved');
  });
});
