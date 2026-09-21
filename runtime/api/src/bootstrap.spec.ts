import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import * as fs from 'fs';
import * as path from 'path';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const request = require('supertest');
import { configureApp } from './bootstrap';
import { SystemController } from './modules/system/system.controller';
import { PrismaService } from './database/prisma.service';
import { AuthController } from './modules/auth/auth.controller';
import { AuthService } from './modules/auth/auth.service';

/**
 * 容器健康检查打的路径必须真实存在。
 *
 * 原来 compose 与 Dockerfile 都打 `/api/v1/health/ready`，而后端只有 `/health`
 * （`health` 被排除在 api/v1 前缀之外，也没有 ready 子路由）——永远 404，
 * api-cn 永远 unhealthy，依赖它的 web-cn 与网关一个都起不来。
 */
const RUNTIME = path.resolve(__dirname, '../..');

function healthcheckPaths(): string[] {
  const files = ['api/Dockerfile', 'docker-compose.production.yml', 'docker-compose.global.yml'];
  const found: string[] = [];
  for (const file of files) {
    const text = fs.readFileSync(path.join(RUNTIME, file), 'utf8');
    for (const match of text.matchAll(/http:\/\/127\.0\.0\.1:4000(\/[^\s"'>]*)/g)) found.push(match[1]);
  }
  return found;
}

async function makeApp(overrides: { db?: () => Promise<unknown>; redis?: () => Promise<string> } = {}) {
  const moduleRef = await Test.createTestingModule({
    imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }])],
    controllers: [SystemController, AuthController],
    providers: [
      { provide: PrismaService, useValue: { $queryRaw: overrides.db ?? (async () => [{ 1: 1 }]) } },
      { provide: 'REDIS_CLIENT', useValue: { ping: overrides.redis ?? (async () => 'PONG') } },
      { provide: AuthService, useValue: { login: async () => { throw new (require('@nestjs/common').UnauthorizedException)('邮箱或密码错误'); } } },
      { provide: APP_GUARD, useClass: ThrottlerGuard },
    ],
  }).compile();
  const app: INestApplication = moduleRef.createNestApplication();
  configureApp(app, []);
  await app.init();
  return app;
}

describe('container healthcheck contract', () => {
  let app: INestApplication;
  afterEach(async () => app && app.close());

  it('every healthcheck path in Dockerfile and compose answers 200 when dependencies are up', async () => {
    app = await makeApp();
    const paths = healthcheckPaths();
    expect(paths.length).toBeGreaterThanOrEqual(3);
    for (const p of paths) {
      const res = await request(app.getHttpServer()).get(p);
      expect({ path: p, status: res.status }).toEqual({ path: p, status: 200 });
    }
  });

  it('readiness fails when the database is down', async () => {
    app = await makeApp({ db: async () => { throw new Error('down'); } });
    const res = await request(app.getHttpServer()).get('/health/ready');
    expect(res.status).toBe(503);
  });

  it('readiness fails when redis is down', async () => {
    app = await makeApp({ redis: async () => { throw new Error('down'); } });
    const res = await request(app.getHttpServer()).get('/health/ready');
    expect(res.status).toBe(503);
  });
});

describe('rate limiting', () => {
  let app: INestApplication;
  afterEach(async () => app && app.close());

  it('the global limit is per minute, not per 60 milliseconds', () => {
    const src = fs.readFileSync(path.join(__dirname, 'app.module.ts'), 'utf8');
    const ttl = /ThrottlerModule\.forRoot\(\[\s*\{\s*ttl:\s*([\d_]+)/.exec(src);
    expect(ttl).not.toBeNull();
    expect(Number(ttl![1].replace(/_/g, ''))).toBe(60_000);
  });

  it('login is limited to 10 attempts per minute per client address', async () => {
    app = await makeApp();
    const server = app.getHttpServer();
    const codes: number[] = [];
    for (let i = 0; i < 12; i += 1) {
      const res = await request(server)
        .post('/api/v1/auth/login')
        .set('X-Forwarded-For', '203.0.113.7')
        .send({ email: 'a@b.cn', password: 'wrongpass' });
      codes.push(res.status);
    }
    expect(codes.slice(0, 10).every((c) => c === 401)).toBe(true);
    expect(codes.slice(10)).toEqual([429, 429]);
    // 另一个客户端地址不受影响（经 web-cn 转发时也能区分）
    const other = await request(server)
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', '198.51.100.9')
      .send({ email: 'a@b.cn', password: 'wrongpass' });
    expect(other.status).toBe(401);
  });
});
