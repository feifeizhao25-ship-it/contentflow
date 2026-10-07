/**
 * 内容接口的越权与绕过：
 *
 * 1. POST /contents、PUT /contents/:id 的请求体类型是 any，运行时是 Object，ValidationPipe 的
 *    whitelist 对它不起作用；整个请求体（含 ...data 展开）交给 prisma。
 *    登录用户发 {"status":"approved"} 就能跳过「待审核 → 已通过」，随后走发布；
 *    发 {"source":"manual"} 能抹掉「AI 生成」来源标记；发 {"tenant_id":"别人的"} 能把内容挪到别的工作区。
 * 2. POST /contents/:id/review 不看角色：任何成员（含只读成员）都能自己批准；
 *    action 不是 approve 的任何值（包括拼错）都被当成「驳回」。
 * 3. 分页参数不设上限：pageSize=1000000 一次拉全表。
 * 4. AI 生成的内容，正文里的「AI 生成」显式标识可以被编辑删掉。
 *
 * 走真实的 configureApp（与线上同一套 ValidationPipe 与过滤器），只替换登录守卫与数据库。
 */
import { ExecutionContext, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const request = require('supertest');
import { configureApp } from '../../bootstrap';
import { AI_TEXT_LABEL } from '../../common/ai-content-label';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PrismaService } from '../../database/prisma.service';
import { ContentController } from './content.controller';
import { ContentService } from './content.service';

describe('contents 接口的越权与绕过', () => {
  let app: INestApplication;
  let me: { id: string; sub: string; tenantId: string; role: string; email: string };
  const prisma = {
    content: { findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn(), create: jest.fn(), update: jest.fn() },
    reviewLog: { create: jest.fn(), findFirst: jest.fn(), findMany: jest.fn() },
    user: { count: jest.fn() },
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    me = { id: 'u-me', sub: 'u-me', tenantId: 't-mine', role: 'owner', email: 'me@example.com' };
    prisma.content.create.mockImplementation(async ({ data }: any) => ({ id: 'c-new', ...data }));
    prisma.content.update.mockImplementation(async ({ data }: any) => ({ id: 'c-1', ...data }));
    prisma.content.findMany.mockResolvedValue([]);
    prisma.content.count.mockResolvedValue(0);
    const moduleRef = await Test.createTestingModule({
      controllers: [ContentController],
      providers: [ContentService, { provide: PrismaService, useValue: prisma }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (ctx: ExecutionContext) => {
          ctx.switchToHttp().getRequest().user = me;
          return true;
        },
      })
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app, []);
    await app.init();
  });
  afterEach(async () => app.close());

  const http = () => request(app.getHttpServer());

  it('PUT /contents/:id：不能改状态、来源、所属工作区、审核信息，请求被拒且库里什么都没写', async () => {
    prisma.content.findFirst.mockResolvedValue({ id: 'c-1', tenant_id: 't-mine', status: 'draft', source: 'ai', body: 'x' });
    for (const evil of [
      { status: 'approved' },
      { source: 'manual' },
      { tenant_id: 't-victim' },
      { reviewed_by: 'u-me', reviewed_at: '2026-01-01T00:00:00Z' },
      { ai_model: 'x' },
      { version: 999 },
      { title: '正常', status: 'published' },
    ]) {
      const res = await http().put('/api/v1/contents/c-1').send(evil);
      expect({ evil, status: res.status }).toEqual({ evil, status: 400 });
    }
    expect(prisma.content.update).not.toHaveBeenCalled();
  });

  it('POST /contents：不能在创建时直接给出状态、审核人或工作区', async () => {
    for (const evil of [
      { content_type: 'article', status: 'approved' },
      { content_type: 'article', tenant_id: 't-victim' },
      { content_type: 'article', created_by: 'u-other' },
      { content_type: 'article', reviewed_by: 'u-me' },
    ]) {
      const res = await http().post('/api/v1/contents').send(evil);
      expect({ evil, status: res.status }).toEqual({ evil, status: 400 });
    }
    expect(prisma.content.create).not.toHaveBeenCalled();
  });

  it('POST /contents：正常创建仍然可用，并且始终是草稿', async () => {
    const res = await http()
      .post('/api/v1/contents')
      .send({ title: '标题', body: '正文', content_type: 'article', tags: ['a'], media_urls: [], cover_url: 'https://cdn.example.cn/a.png' });
    expect(res.status).toBe(201);
    expect(prisma.content.create.mock.calls[0][0].data).toMatchObject({ tenant_id: 't-mine', created_by: 'u-me', status: 'draft' });
  });

  it('PUT /contents/:id：允许改标题与正文，且只写白名单字段', async () => {
    prisma.content.findFirst.mockResolvedValue({ id: 'c-1', tenant_id: 't-mine', status: 'draft', source: 'manual', body: 'x' });
    const res = await http().put('/api/v1/contents/c-1').send({ title: '新标题', body: '新正文' });
    expect(res.status).toBe(200);
    const data = prisma.content.update.mock.calls[0][0].data;
    expect(data.title).toBe('新标题');
    expect(data.status).toBeUndefined();
    expect(data.tenant_id).toBeUndefined();
    expect(data.source).toBeUndefined();
  });

  it('POST /contents/:id/review：只有所有者或管理员能审核，编辑与只读成员不能自己批准', async () => {
    for (const role of ['member', 'editor', 'viewer']) {
      me.role = role;
      const res = await http().post('/api/v1/contents/c-1/review').send({ action: 'approve' });
      expect({ role, status: res.status }).toEqual({ role, status: 403 });
    }
    expect(prisma.content.update).not.toHaveBeenCalled();
    expect(prisma.reviewLog.create).not.toHaveBeenCalled();
  });

  it('POST /contents/:id/review：action 只能是 approve 或 reject，拼错不能被当成驳回', async () => {
    for (const action of ['aprove', 'APPROVE', '', 'publish', 1, null]) {
      const res = await http().post('/api/v1/contents/c-1/review').send({ action });
      expect({ action, status: res.status }).toEqual({ action, status: 400 });
    }
    expect(prisma.content.update).not.toHaveBeenCalled();
  });

  it('POST /contents/:id/review：所有者批准待审核内容，写入审核人', async () => {
    prisma.content.findFirst.mockResolvedValue({ id: 'c-1', tenant_id: 't-mine', status: 'pending_review', created_by: 'u-author' });
    const res = await http().post('/api/v1/contents/c-1/review').send({ action: 'approve', comment: '可以发' });
    expect(res.status).toBe(201);
    expect(prisma.content.update.mock.calls[0][0].data).toMatchObject({ status: 'approved', reviewed_by: 'u-me' });
  });

  it('POST /contents/:id/submit：只有草稿或已驳回的内容能提交审核，已发布的不能倒退成待审核', async () => {
    prisma.content.findFirst.mockResolvedValue({ id: 'c-1', tenant_id: 't-mine', status: 'published' });
    const res = await http().post('/api/v1/contents/c-1/submit').send({});
    expect(res.status).toBe(400);
    expect(prisma.content.update).not.toHaveBeenCalled();
  });

  it('GET /contents：分页参数有上限，乱填不会拉全表，也不会因 NaN 报 500', async () => {
    await http().get('/api/v1/contents?pageSize=1000000&page=1').expect(200);
    expect(prisma.content.findMany.mock.calls[0][0].take).toBeLessThanOrEqual(100);
    await http().get('/api/v1/contents?pageSize=abc&page=-3').expect(200);
    const arg = prisma.content.findMany.mock.calls[1][0];
    expect(Number.isInteger(arg.take) && arg.take > 0).toBe(true);
    expect(Number.isInteger(arg.skip) && arg.skip >= 0).toBe(true);
  });

  it('AI 生成的内容：创建时正文带「AI 生成」显式标识', async () => {
    await http()
      .post('/api/v1/contents')
      .send({ content_type: 'article', source: 'ai', body: '一段脚本', ai_model: 'qwen-plus' })
      .expect(201);
    const data = prisma.content.create.mock.calls[0][0].data;
    expect(data.source).toBe('ai');
    expect(data.body.startsWith(AI_TEXT_LABEL)).toBe(true);
  });

  it('AI 生成的内容：编辑正文时删不掉「AI 生成」标识（也不会重复叠加）', async () => {
    prisma.content.findFirst.mockResolvedValue({ id: 'c-1', tenant_id: 't-mine', status: 'draft', source: 'ai', body: `${AI_TEXT_LABEL}\n旧` });
    await http().put('/api/v1/contents/c-1').send({ body: '用户把标识删了，只留新正文' }).expect(200);
    const body: string = prisma.content.update.mock.calls[0][0].data.body;
    expect(body.startsWith(AI_TEXT_LABEL)).toBe(true);
    await http().put('/api/v1/contents/c-1').send({ body: `${AI_TEXT_LABEL}\n已带标识` }).expect(200);
    const again: string = prisma.content.update.mock.calls[1][0].data.body;
    expect(again.split(AI_TEXT_LABEL).length - 1).toBe(1);
  });

  it('人工创作的内容不被加上 AI 标识', async () => {
    prisma.content.findFirst.mockResolvedValue({ id: 'c-1', tenant_id: 't-mine', status: 'draft', source: 'manual', body: '旧' });
    await http().put('/api/v1/contents/c-1').send({ body: '人写的正文' }).expect(200);
    expect(prisma.content.update.mock.calls[0][0].data.body).toBe('人写的正文');
  });
});
