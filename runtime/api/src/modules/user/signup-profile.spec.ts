/**
 * 注册三问和省份只能由当前登录用户读写。
 * 走真实的 configureApp（同一套 ValidationPipe），只替换登录守卫与数据库。
 */
import { INestApplication, ExecutionContext } from '@nestjs/common';
import { Test } from '@nestjs/testing';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const request = require('supertest');
import { configureApp } from '../../bootstrap';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PrismaService } from '../../database/prisma.service';
import { AccountErasureService } from './account-erasure.service';
import { UserController } from './user.controller';
import { UserService } from './user.service';

const ME = { id: 'u-me', sub: 'u-me', tenantId: 't-mine', role: 'member', email: 'me@example.com' };

describe('注册画像 /users/me/signup-profile', () => {
  let app: INestApplication;
  const rows = new Map<string, any>();
  const prisma = {
    user: {
      findUnique: jest.fn(async ({ where, select }: any) => {
        const row = rows.get(where.id);
        if (!row) return null;
        if (!select) return row;
        const out: Record<string, unknown> = {};
        for (const key of Object.keys(select)) if (select[key]) out[key] = row[key];
        return out;
      }),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(async ({ where, data, select }: any) => {
        const row = rows.get(where.id);
        if (!row) throw new Error('missing');
        Object.assign(row, data);
        const out: Record<string, unknown> = {};
        for (const key of Object.keys(select ?? {})) out[key] = row[key];
        return out;
      }),
    },
  };

  beforeEach(async () => {
    rows.clear();
    rows.set('u-me', {
      id: 'u-me', status: 'active', tenant_id: 't-mine',
      industry: null, job_role: null, growth_stage: null, province: null,
      preferences: {},
    });
    rows.set('u-other', {
      id: 'u-other', status: 'active', tenant_id: 't-other',
      industry: '别人的行业', job_role: '别人的岗位', growth_stage: '别人的阶段', province: '北京',
    });
    jest.clearAllMocks();
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

  it('未登录的守卫不在这层测；已登录只能读写自己的四项', async () => {
    const saved = await request(app.getHttpServer()).put('/api/v1/users/me/signup-profile').send({
      industry: '  教育培训  ',
      job_role: '老师',
      growth_stage: '起步',
      province: '浙江',
    });
    expect(saved.status).toBe(200);
    expect(saved.body.data.profile).toEqual({
      industry: '教育培训',
      job_role: '老师',
      growth_stage: '起步',
      province: '浙江',
    });
    const write = prisma.user.update.mock.calls[0][0];
    expect(write.where).toEqual({ id: 'u-me' });
    expect(Object.keys(write.data).sort()).toEqual(['growth_stage', 'industry', 'job_role', 'province']);
    expect(rows.get('u-other').industry).toBe('别人的行业');

    const read = await request(app.getHttpServer()).get('/api/v1/users/me/signup-profile');
    expect(read.status).toBe(200);
    expect(read.body.data.profile.industry).toBe('教育培训');
    expect(prisma.user.findUnique.mock.calls.every((c: any) => c[0].where.id === 'u-me')).toBe(true);
  });

  it('空字符串清空该项；不能借这个接口改角色、工作区或别人的 id', async () => {
    await request(app.getHttpServer()).put('/api/v1/users/me/signup-profile').send({ industry: '餐饮', province: '四川' }).expect(200);
    const cleared = await request(app.getHttpServer()).put('/api/v1/users/me/signup-profile').send({ industry: '   ' });
    expect(cleared.status).toBe(200);
    expect(cleared.body.data.profile).toEqual({ industry: null, job_role: null, growth_stage: null, province: '四川' });

    for (const evil of [
      { user_id: 'u-other', industry: '盗用' },
      { id: 'u-other', job_role: '盗用' },
      { role: 'owner', industry: '餐饮' },
      { tenant_id: 't-other', province: '北京' },
      { industry: 'x'.repeat(41) },
    ]) {
      const res = await request(app.getHttpServer()).put('/api/v1/users/me/signup-profile').send(evil);
      expect(res.status).toBe(400);
    }
    expect(rows.get('u-other').job_role).toBe('别人的岗位');
    expect(rows.get('u-me').role).toBeUndefined();
  });

  it('同工作区成员详情不返回这四项', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'u-2', email: 'b@example.com', name: 'B', role: 'member' });
    await request(app.getHttpServer()).get('/api/v1/users/u-2').expect(200);
    const select = prisma.user.findFirst.mock.calls[0][0].select;
    expect(select.industry).toBeUndefined();
    expect(select.job_role).toBeUndefined();
    expect(select.growth_stage).toBeUndefined();
    expect(select.province).toBeUndefined();
  });
});
