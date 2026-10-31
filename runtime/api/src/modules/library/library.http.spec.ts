/** 走真实路由：登录保护、只看自己的设置、推荐/首页卡片/设置接口。 */
import { ExecutionContext, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const request = require('supertest');
import { configureApp } from '../../bootstrap';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { LibraryController } from './library.controller';
import { LibraryService } from './library.service';
import { LibraryStore } from './store';
import * as review from './live/review';
import { FakeUser, fakePrisma, tmpStore } from './test-helpers';

describe('资料库接口 /api/v1/library', () => {
  let app: INestApplication;
  let me = 'u1';
  let users: FakeUser[];
  const mkUsers = (): FakeUser[] => [
    { id: 'u1', tenant_id: 't1', preferences: { theme: 'dark' }, platforms: ['douyin'], personas: [{ name: 'x', description: '养生食谱' }] },
    { id: 'u2', tenant_id: 't2', preferences: {}, platforms: [], personas: [] },
  ];
  let store: LibraryStore;

  beforeEach(async () => {
    users = mkUsers();
    me = 'u1';
    store = tmpStore();
    const doc = store.loadDoc();
    const ctx = { doc, state: store.loadState(), log: store.log, now: () => new Date() };
    for (const e of doc.entries.slice(0, 9)) review.approve(ctx, e.id, '测试审核人', '2026-10-01'); // 无来源快照：不写 reviewed_hash
    store.saveDoc(doc);
    const moduleRef = await Test.createTestingModule({
      controllers: [LibraryController],
      providers: [{ provide: LibraryService, useValue: new LibraryService(fakePrisma(users), store) }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (ctx: ExecutionContext) => {
          ctx.switchToHttp().getRequest().user = { id: me, sub: me, tenantId: 't', role: 'owner' };
          return true;
        },
      })
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app, []);
    await app.init();
  });
  afterEach(async () => app.close());
  const api = () => request(app.getHttpServer());

  it('整个控制器需要登录', () => {
    const guards = Reflect.getMetadata('__guards__', LibraryController) as unknown[];
    expect(guards).toContain(JwtAuthGuard);
    expect(guards.length).toBe(2);
  });

  it('国际版部署下这些接口不存在', async () => {
    process.env.MARKET_REGION = 'global';
    try {
      await api().get('/api/v1/library/entries').expect(404);
    } finally {
      delete process.env.MARKET_REGION;
    }
  });

  it('条目：只有已审核的；带展示结论；单条不存在是 404', async () => {
    const r = await api().get('/api/v1/library/entries').expect(200);
    expect(r.body.data.entries).toHaveLength(9);
    expect(r.body.data.entries[0].display.state).toBeDefined();
    await api().get('/api/v1/library/entries/cf-rule-013').expect(404); // 还没审核
    await api().get('/api/v1/library/entries/cf-rule-001').expect(200);
  });

  it('推荐：返回理由和主题；设置只改自己的，不碰 preferences 里的别的字段', async () => {
    const f = await api().get('/api/v1/library/feed').expect(200);
    expect(f.body.data.enabled).toBe(true);
    expect(f.body.data.items.length).toBeGreaterThan(0);
    expect(f.body.data.items.every((i: any) => typeof i.reason === 'string' && i.reason)).toBe(true);
    const p = await api().put('/api/v1/library/preferences').send({ follow: ['ai'], mute: ['minors'] }).expect(200);
    expect(p.body.data).toMatchObject({ enabled: true, followed: ['ai'], muted: ['minors'] });
    expect(users[0].preferences.theme).toBe('dark');
    expect(users[1].preferences).toEqual({});
    me = 'u2';
    const other = await api().get('/api/v1/library/preferences').expect(200);
    expect(other.body.data).toMatchObject({ followed: [], muted: [] });
    me = 'u1';
  });

  it('未知主题 422；关闭后推荐为空、首页卡片为空', async () => {
    await api().put('/api/v1/library/preferences').send({ follow: ['nope'] }).expect(422);
    await api().put('/api/v1/library/preferences').send({ enabled: false }).expect(200);
    const f = await api().get('/api/v1/library/feed').expect(200);
    expect(f.body.data).toMatchObject({ enabled: false, items: [] });
    const c = await api().get('/api/v1/library/home-card').expect(200);
    expect(c.body.data.card).toBeNull();
  });

  it('来访与已读：开着才记，下次条目带「新」标记', async () => {
    await api().post('/api/v1/library/visit').expect(200);
    expect(users[0].preferences.library).toMatchObject({ last_visit: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) });
    await api().post('/api/v1/library/opened/cf-rule-001').expect(200);
    expect((users[0].preferences.library as any).opened).toHaveLength(1);
  });
});
