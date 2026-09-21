import { Test } from '@nestjs/testing';
import { INestApplication, UnauthorizedException } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import * as fs from 'fs';
import * as path from 'path';
import { JwtStrategy } from './jwt.strategy';
import { PrismaService } from '../../../database/prisma.service';
import { PointsController } from '../../points/points.controller';
import { PointsService } from '../../points/points.service';
import { configureApp } from '../../../bootstrap';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const request = require('supertest');

const SECRET = 's'.repeat(40);
const USERS: Record<string, any> = {
  'u-alice': { id: 'u-alice', email: 'a@x.cn', tenant_id: 't-1', role: 'owner', status: 'active' },
  'u-gone': { id: 'u-gone', email: 'g@x.cn', tenant_id: 't-1', role: 'owner', status: 'disabled' },
};
const prisma = { user: { findUnique: async ({ where }: any) => USERS[where.id] ?? null } };

function strategy() {
  return new JwtStrategy({ getOrThrow: () => SECRET } as any, prisma as any);
}

describe('JwtStrategy.validate', () => {
  it('exposes the user id as both id and sub', async () => {
    const user = await strategy().validate({ sub: 'u-alice', email: 'old@x.cn', tenantId: 't-old', role: 'viewer' });
    expect(user).toEqual({ id: 'u-alice', sub: 'u-alice', email: 'a@x.cn', tenantId: 't-1', role: 'owner' });
  });

  it('rejects disabled or deleted accounts even with a valid token', async () => {
    await expect(strategy().validate({ sub: 'u-gone', email: '', tenantId: 't-1', role: 'owner' })).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(strategy().validate({ sub: 'u-missing', email: '', tenantId: 't-1', role: 'owner' })).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects refresh tokens used as access tokens', async () => {
    await expect(strategy().validate({ sub: 'u-alice', type: 'refresh' } as any)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

describe('controllers only read identity fields the strategy provides', () => {
  const provided = new Set(['id', 'sub', 'email', 'tenantId', 'role']);
  const modulesDir = path.resolve(__dirname, '../..');
  const offenders: string[] = [];
  for (const mod of fs.readdirSync(modulesDir)) {
    const dir = path.join(modulesDir, mod);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith('.controller.ts')) continue;
      const src = fs.readFileSync(path.join(dir, file), 'utf8');
      for (const m of src.matchAll(/req\.user\??\.(\w+)/g)) {
        if (!provided.has(m[1])) offenders.push(`${mod}/${file}: req.user.${m[1]}`);
      }
    }
  }
  it('has no reads of missing fields', () => expect(offenders).toEqual([]));
});

describe('points endpoints resolve to the caller, not to every user', () => {
  let app: INestApplication;
  const calls: unknown[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ ignoreEnvFile: true, load: [() => ({ JWT_SECRET: SECRET })] }),
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({ secret: SECRET }),
      ],
      controllers: [PointsController],
      providers: [
        JwtStrategy,
        { provide: PrismaService, useValue: prisma },
        { provide: PointsService, useValue: { getPointsLogs: async (userId: unknown) => { calls.push(userId); return []; } } },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app, []);
    await app.init();
  });
  afterAll(async () => app.close());

  it('passes the authenticated user id to the service', async () => {
    const token = app.get(JwtService).sign({ sub: 'u-alice', email: 'a@x.cn', tenantId: 't-1', role: 'owner' });
    const res = await request(app.getHttpServer()).get('/api/v1/points/logs').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(calls).toEqual(['u-alice']);
  });

  it('a disabled account is refused', async () => {
    const token = app.get(JwtService).sign({ sub: 'u-gone', email: 'g@x.cn', tenantId: 't-1', role: 'owner' });
    const res = await request(app.getHttpServer()).get('/api/v1/points/logs').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
  });
});
