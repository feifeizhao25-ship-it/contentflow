/**
 * 发布接口的入参：POST /publish/tasks 的请求体是 any，没有任何校验
 * （platformAccountIds 传字符串、几千个账号、scheduledAt 传垃圾都直接进服务层）；
 * GET /publish/tasks 的 pageSize 没有上限。走真实 configureApp。
 */
import { ExecutionContext, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const request = require('supertest');
import { configureApp } from '../../bootstrap';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PublishController } from './publish.controller';
import { PublishService } from './publish.service';

describe('publish 接口入参', () => {
  let app: INestApplication;
  const service = { createTask: jest.fn(), getTasks: jest.fn() };

  beforeEach(async () => {
    jest.resetAllMocks();
    service.createTask.mockResolvedValue([{ id: 't1' }]);
    service.getTasks.mockResolvedValue({ tasks: [], pagination: {} });
    const moduleRef = await Test.createTestingModule({
      controllers: [PublishController],
      providers: [{ provide: PublishService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (ctx: ExecutionContext) => {
          ctx.switchToHttp().getRequest().user = { id: 'u', sub: 'u', tenantId: 't', role: 'owner' };
          return true;
        },
      })
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app, []);
    await app.init();
  });
  afterEach(async () => app.close());

  const post = (body: unknown) => request(app.getHttpServer()).post('/api/v1/publish/tasks').send(body);

  it.each([
    ['缺少 contentId', { platformAccountIds: ['a'], publishType: 'immediate' }],
    ['账号不是数组', { contentId: 'c', platformAccountIds: 'a', publishType: 'immediate' }],
    ['账号数组里有非字符串', { contentId: 'c', platformAccountIds: [1], publishType: 'immediate' }],
    ['一次选了 500 个账号', { contentId: 'c', platformAccountIds: Array.from({ length: 500 }, (_, i) => `a${i}`), publishType: 'immediate' }],
    ['发布类型不合法', { contentId: 'c', platformAccountIds: ['a'], publishType: 'now' }],
    ['定时时间不是时间', { contentId: 'c', platformAccountIds: ['a'], publishType: 'scheduled', scheduledAt: 'tomorrow-ish' }],
    ['多带了不认识的字段', { contentId: 'c', platformAccountIds: ['a'], publishType: 'immediate', tenantId: 'victim' }],
  ])('POST /publish/tasks：%s → 400，服务层没有被调用', async (_name, body) => {
    const res = await post(body);
    expect(res.status).toBe(400);
    expect(service.createTask).not.toHaveBeenCalled();
  });

  it('POST /publish/tasks：合法请求原样进入服务层（scheduledAt 为时间对象）', async () => {
    const res = await post({ contentId: 'c', platformAccountIds: ['a', 'b'], publishType: 'scheduled', scheduledAt: '2030-01-01T10:00:00.000Z' });
    expect(res.status).toBe(201);
    const data = service.createTask.mock.calls[0][2];
    expect(data.platformAccountIds).toEqual(['a', 'b']);
    expect(new Date(data.scheduledAt).toISOString()).toBe('2030-01-01T10:00:00.000Z');
  });

  it('GET /publish/tasks：pageSize 有上限，乱填回落到默认值', async () => {
    await request(app.getHttpServer()).get('/api/v1/publish/tasks?pageSize=1000000&page=2').expect(200);
    expect(service.getTasks.mock.calls[0][1].pageSize).toBeLessThanOrEqual(100);
    await request(app.getHttpServer()).get('/api/v1/publish/tasks?pageSize=abc&page=-1').expect(200);
    const opts = service.getTasks.mock.calls[1][1];
    expect(opts.pageSize).toBeGreaterThan(0);
    expect(opts.page).toBeGreaterThanOrEqual(1);
  });
});
