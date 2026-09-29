/**
 * 用户接口的三个洞：
 *
 * 1. PUT /users/me 把请求体原样交给 prisma.user.update（行内类型在运行时是 Object，
 *    ValidationPipe 的 whitelist 对它不起作用）——登录用户发 {"role":"owner","tenant_id":"别人的"}
 *    就成了别人工作区的所有者。
 * 2. GET /users/me、GET /users/:id 返回整条 User 记录（含 password_hash）加整个工作区记录。
 * 3. GET /users/:id 不看工作区：任何登录用户能读任何人。
 *
 * 走真实的 configureApp（与线上同一套 ValidationPipe 与过滤器），只替换登录守卫与数据库。
 */
import { INestApplication, ExecutionContext } from '@nestjs/common';
import { Test } from '@nestjs/testing';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const request = require('supertest');
import { configureApp } from '../../bootstrap';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PrismaService } from '../../database/prisma.service';
import { UserController } from './user.controller';
import { UserService } from './user.service';

const ME = { id: 'u-me', sub: 'u-me', tenantId: 't-mine', role: 'member', email: 'me@example.com' };

describe('users 接口', () => {
  let app: INestApplication;
  const prisma = {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    prisma.user.update.mockImplementation(async ({ data }: any) => ({ id: ME.id, ...data }));
    const moduleRef = await Test.createTestingModule({
      controllers: [UserController],
      providers: [UserService, { provide: PrismaService, useValue: prisma }],
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

  it('PUT /users/me：不能改角色、工作区、状态，请求直接被拒绝，库里什么都没写', async () => {
    for (const evil of [
      { role: 'owner' },
      { tenant_id: 't-victim' },
      { status: 'active', email_verified: true },
      { name: '正常', role: 'owner' },
      { password_hash: 'x' },
    ]) {
      const res = await request(app.getHttpServer()).put('/api/v1/users/me').send(evil);
      expect(res.status).toBe(400);
    }
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('PUT /users/me：三个允许的字段正常更新，且只写这三个', async () => {
    const res = await request(app.getHttpServer())
      .put('/api/v1/users/me')
      .send({ name: '小周', avatar_url: 'https://cdn.example.cn/a.png', preferences: { theme: 'dark' } });
    expect(res.status).toBe(200);
    const arg = prisma.user.update.mock.calls[0][0];
    expect(arg.where).toEqual({ id: 'u-me' });
    expect(Object.keys(arg.data).sort()).toEqual(['avatar_url', 'name', 'preferences']);
  });

  it('PUT /users/me：头像必须是 https 链接（不能是 javascript: 之类）', async () => {
    for (const bad of ['javascript:alert(1)', 'http://x.example/a.png', 'data:text/html,<script>']) {
      const res = await request(app.getHttpServer()).put('/api/v1/users/me').send({ avatar_url: bad });
      expect(res.status).toBe(400);
    }
  });

  it('GET /users/me：只查白名单字段，不含口令哈希', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u-me', email: 'me@example.com' });
    await request(app.getHttpServer()).get('/api/v1/users/me').expect(200);
    const arg = prisma.user.findUnique.mock.calls[0][0];
    expect(arg.include).toBeUndefined();
    expect(arg.select).toBeDefined();
    for (const secret of ['password_hash', 'oauth_providers', 'permissions']) {
      expect(arg.select[secret]).toBeUndefined();
    }
    expect(Object.keys(arg.select.tenant.select)).not.toContain('settings');
  });

  it('GET /users/:id：只能看自己工作区里的人；别的工作区一律 404', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    await request(app.getHttpServer()).get('/api/v1/users/u-victim').expect(404);
    const where = prisma.user.findFirst.mock.calls[0][0].where;
    expect(where).toMatchObject({ id: 'u-victim', tenant_id: 't-mine', status: 'active' });
  });

  it('GET /users/:id：同工作区的人不返回手机号与口令哈希', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'u-2', email: 'b@example.com', name: 'B', role: 'member' });
    await request(app.getHttpServer()).get('/api/v1/users/u-2').expect(200);
    const select = prisma.user.findFirst.mock.calls[0][0].select;
    expect(select.phone).toBeUndefined();
    expect(select.password_hash).toBeUndefined();
  });
});
