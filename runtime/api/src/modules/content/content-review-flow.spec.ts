/**
 * 内容审核流：草稿 → 提交审核 → 有权限的审核人通过 / 驳回（附原因）→ 可发布。
 *
 * - 作者（创建人或提交人）不能自己批准或驳回自己的内容；
 * - 驳回必须写原因；
 * - 工作区没有作者以外的所有者 / 管理员时，所有者可「自行确认」：必须 confirm=true，
 *   记录为 self_confirm，内容上写明「所有者自行确认」；其他角色、或还有其他审核人时不允许。
 *
 * 走真实 configureApp + supertest，只替换登录守卫与数据库。
 */
import { ExecutionContext, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const request = require('supertest');
import { configureApp } from '../../bootstrap';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PrismaService } from '../../database/prisma.service';
import { ContentController } from './content.controller';
import { ContentService, SELF_CONFIRM_LABEL } from './content.service';

describe('内容审核流', () => {
  let app: INestApplication;
  let me: { id: string; sub: string; tenantId: string; role: string; email: string };
  let otherReviewers = 1;
  let content: any;
  let lastSubmitter: string | null = null;
  const prisma = {
    content: { findFirst: jest.fn(), update: jest.fn(), findMany: jest.fn(), count: jest.fn(), create: jest.fn() },
    reviewLog: { create: jest.fn(), findFirst: jest.fn(), findMany: jest.fn() },
    user: { count: jest.fn() },
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    otherReviewers = 1;
    lastSubmitter = null;
    me = { id: 'u-owner', sub: 'u-owner', tenantId: 't-1', role: 'owner', email: 'o@example.cn' };
    content = { id: 'c-1', tenant_id: 't-1', status: 'pending_review', created_by: 'u-editor' };
    prisma.content.findFirst.mockImplementation(async ({ where }: any) => (where.tenant_id === 't-1' && where.id === content.id ? content : null));
    prisma.content.update.mockImplementation(async ({ data }: any) => { Object.assign(content, data); return content; });
    prisma.reviewLog.findFirst.mockImplementation(async () => (lastSubmitter ? { reviewer_id: lastSubmitter, action: 'submit' } : null));
    prisma.reviewLog.create.mockResolvedValue({});
    prisma.reviewLog.findMany.mockResolvedValue([]);
    prisma.user.count.mockImplementation(async () => otherReviewers);
    const moduleRef = await Test.createTestingModule({
      controllers: [ContentController],
      providers: [ContentService, { provide: PrismaService, useValue: prisma }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: (ctx: ExecutionContext) => { ctx.switchToHttp().getRequest().user = me; return true; } })
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app, []);
    await app.init();
  });
  afterEach(async () => app.close());
  const http = () => request(app.getHttpServer());
  const as = (sub: string, role: string) => { me = { id: sub, sub, tenantId: 't-1', role, email: `${sub}@example.cn` }; };

  it('完整流程：编辑写草稿 → 提交审核（留痕）→ 所有者通过 → 状态为已通过（可发布）', async () => {
    content.status = 'draft';
    as('u-editor', 'editor');
    await http().post('/api/v1/contents/c-1/submit').send({}).expect(201);
    expect(content.status).toBe('pending_review');
    expect(prisma.reviewLog.create.mock.calls[0][0].data).toMatchObject({ content_id: 'c-1', reviewer_id: 'u-editor', action: 'submit' });
    lastSubmitter = 'u-editor';

    as('u-owner', 'owner');
    await http().post('/api/v1/contents/c-1/review').send({ action: 'approve' }).expect(201);
    expect(content).toMatchObject({ status: 'approved', reviewed_by: 'u-owner' });
  });

  it('驳回必须写原因；写了原因后作者能看到，并能改完重新提交', async () => {
    const empty = await http().post('/api/v1/contents/c-1/review').send({ action: 'reject', comment: '   ' });
    expect(empty.status).toBe(400);
    expect(JSON.stringify(empty.body)).toContain('驳回时请填写原因');
    expect(content.status).toBe('pending_review');

    await http().post('/api/v1/contents/c-1/review').send({ action: 'reject', comment: '标题含「最」字，请改' }).expect(201);
    expect(content).toMatchObject({ status: 'rejected', review_comment: '标题含「最」字，请改' });
    expect(prisma.reviewLog.create.mock.calls[0][0].data).toMatchObject({ action: 'reject', comment: '标题含「最」字，请改' });

    as('u-editor', 'editor');
    await http().put('/api/v1/contents/c-1').send({ title: '改好的标题' }).expect(200);
    await http().post('/api/v1/contents/c-1/submit').send({}).expect(201);
    expect(content.status).toBe('pending_review');
  });

  it('作者不能批准或驳回自己创作的内容（即使是所有者 / 管理员）', async () => {
    content.created_by = 'u-owner';
    for (const action of ['approve', 'reject']) {
      const res = await http().post('/api/v1/contents/c-1/review').send({ action, comment: '自己看过了' });
      expect({ action, status: res.status }).toEqual({ action, status: 403 });
      expect(JSON.stringify(res.body)).toContain('不能审核自己创作或提交的内容');
    }
    as('u-owner', 'admin');
    expect((await http().post('/api/v1/contents/c-1/review').send({ action: 'approve' })).status).toBe(403);
    expect(content.status).toBe('pending_review');
  });

  it('提交人也不能自批：别人创建、管理员自己提交，管理员不能批准', async () => {
    as('u-admin', 'admin');
    lastSubmitter = 'u-admin';
    const res = await http().post('/api/v1/contents/c-1/review').send({ action: 'approve' });
    expect(res.status).toBe(403);
    expect(content.status).toBe('pending_review');
  });

  it('编辑、成员、只读成员不能审核（上轮的角色约束保留）', async () => {
    for (const role of ['editor', 'member', 'viewer']) {
      as('u-x', role);
      expect((await http().post('/api/v1/contents/c-1/review').send({ action: 'approve' })).status).toBe(403);
    }
    expect(content.status).toBe('pending_review');
  });

  it('审核权限：单人工作区的所有者可以自行确认；还有其他审核人时不行；非所有者不行', async () => {
    otherReviewers = 0;
    let res = await http().get('/api/v1/contents/review-policy').expect(200);
    expect(res.body.data).toMatchObject({ canReview: true, canSelfConfirm: true, otherReviewers: 0, userId: 'u-owner' });
    expect(prisma.user.count.mock.calls[0][0].where).toMatchObject({ tenant_id: 't-1', status: 'active', role: { in: ['owner', 'admin'] }, id: { not: 'u-owner' } });

    otherReviewers = 1;
    res = await http().get('/api/v1/contents/review-policy').expect(200);
    expect(res.body.data.canSelfConfirm).toBe(false);

    otherReviewers = 0;
    as('u-admin', 'admin');
    res = await http().get('/api/v1/contents/review-policy').expect(200);
    expect(res.body.data.canSelfConfirm).toBe(false);
    as('u-editor', 'editor');
    res = await http().get('/api/v1/contents/review-policy').expect(200);
    expect(res.body.data).toMatchObject({ canReview: false, canSelfConfirm: false });
  });

  it('自行确认：必须 confirm=true（二次确认），记录为 self_confirm，内容上写明「所有者自行确认」', async () => {
    otherReviewers = 0;
    content.created_by = 'u-owner';
    // 全局 ValidationPipe 开了隐式类型转换，'true' 会被转成 true；这里只测缺失与 false
    for (const body of [{}, { confirm: false }, { note: '只有说明' }]) {
      const res = await http().post('/api/v1/contents/c-1/self-confirm').send(body);
      expect({ body, status: res.status }).toEqual({ body, status: 400 });
    }
    expect(content.status).toBe('pending_review');

    await http().post('/api/v1/contents/c-1/self-confirm').send({ confirm: true, note: '已核对广告法用语' }).expect(201);
    expect(content).toMatchObject({ status: 'approved', reviewed_by: 'u-owner', review_comment: `${SELF_CONFIRM_LABEL}：已核对广告法用语` });
    const log = prisma.reviewLog.create.mock.calls.at(-1)[0].data;
    expect(log).toMatchObject({ content_id: 'c-1', reviewer_id: 'u-owner', action: 'self_confirm' });
    expect(log.changes).toMatchObject({ self_confirm: true, other_reviewers: 0 });
  });

  it('自行确认：工作区还有其他所有者 / 管理员时拒绝；管理员、编辑不能自行确认；草稿不能跳过「提交审核」', async () => {
    content.created_by = 'u-owner';
    otherReviewers = 1;
    let res = await http().post('/api/v1/contents/c-1/self-confirm').send({ confirm: true });
    expect(res.status).toBe(403);
    expect(JSON.stringify(res.body)).toContain('请让他们审核');

    otherReviewers = 0;
    for (const role of ['admin', 'editor', 'member']) {
      as('u-x', role);
      expect((await http().post('/api/v1/contents/c-1/self-confirm').send({ confirm: true })).status).toBe(403);
    }
    expect(content.status).toBe('pending_review');

    as('u-owner', 'owner');
    content.status = 'draft';
    res = await http().post('/api/v1/contents/c-1/self-confirm').send({ confirm: true });
    expect(res.status).toBe(404);
    expect(JSON.stringify(res.body)).toContain('请先提交审核');
    expect(content.status).toBe('draft');
  });

  it('不能审核或自行确认别的工作区的内容', async () => {
    otherReviewers = 0;
    content.tenant_id = 't-other';
    prisma.content.findFirst.mockResolvedValue(null);
    expect((await http().post('/api/v1/contents/c-1/review').send({ action: 'approve' })).status).toBe(404);
    expect((await http().post('/api/v1/contents/c-1/self-confirm').send({ confirm: true })).status).toBe(404);
    expect((await http().get('/api/v1/contents/c-1/review-logs')).status).toBe(404);
    expect(prisma.content.update).not.toHaveBeenCalled();
  });
});
