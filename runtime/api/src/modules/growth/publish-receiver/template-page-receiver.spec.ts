/** 模板页发布接收口：开关、令牌、四项检查（批准单哈希、上海时间窗、AIGC 标识、只追加审计）、只存不发。 */
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { readFileSync } from 'fs';
import { join } from 'path';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const request = require('supertest');
import { configureApp } from '../../../bootstrap';
import { PrismaService } from '../../../database/prisma.service';
import {
  AIGC_LABEL,
  canonicalJson,
  checkContent,
  configuredToken,
  contentSha256,
  ENABLE_ENV,
  FORBIDDEN_REUSE_ENVS,
  inWindow,
  receiverEnabled,
  REASONS,
  TOKEN_ENV,
} from './template-page-receiver';
import { receiverClock, TemplatePageReceiverController } from './template-page-receiver.controller';
import { TemplatePageReceiverService } from './template-page-receiver.service';

const PATH = '/api/v1/growth/publish/template-page';
const TOKEN = 'test-only-publish-token-not-a-real-secret';
const NOON = new Date('2026-11-19T02:00:00Z'); // 上海 10:00

/** 中枢 daily.py 生成的 A 档内容（apply_aigc 之后）。哈希由中枢同一算法（Python json.dumps sort_keys + 紧凑分隔符）算出。 */
const HUB_CONTENT = {
  product: 'fenfaxia',
  channel: 'fenfaxia_template_pages',
  title: '小红书模板：周末探店',
  body: '周末探店的三个开头写法。\n\n这条是给 小红书 的草稿。请发布执行人补一句自己的看法。\n\n【本内容由 AI 生成】',
  url: 'https://preview.invalid/fenfaxia_template_pages',
};
const HUB_SHA = '0d3ba5afd9a280e65738719382f7141b9498e54bbcf66aad33579c355bba5449';

const approvalFor = (content: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
  id: 'ap_test0001',
  status: 'approved',
  content_sha256: contentSha256(content),
  channel: 'template_card',
  detail_checked: false,
  ...extra,
});
const goodBody = (content: Record<string, unknown> = HUB_CONTENT, approval: Record<string, unknown> = approvalFor(content)) => ({
  content,
  stub: false,
  note: '',
  approval,
});

interface State {
  subs: any[];
  audits: any[];
  calls: string[];
  failAudit: boolean;
}

function fakePrisma(state: State) {
  const model = (rows: any[], name: 'sub' | 'audit') =>
    new Proxy(
      {
        create: async ({ data }: any) => {
          if (name === 'audit' && state.failAudit) throw new Error('db down');
          const row = Object.freeze({ id: name === 'audit' ? rows.length + 1 : `sub_${rows.length + 1}`, ...data });
          rows.push(row);
          return row;
        },
        findUnique: async ({ where }: any) => rows.find((r) => r.content_sha256 === where.content_sha256) ?? null,
      } as Record<string, unknown>,
      {
        get(target, prop) {
          state.calls.push(`${name}.${String(prop)}`);
          return target[prop as string];
        },
      },
    );
  const client: any = {
    growthTemplatePageSubmission: model(state.subs, 'sub'),
    growthPublishReceiveAudit: model(state.audits, 'audit'),
    $transaction: async (fn: (tx: any) => Promise<unknown>) => {
      const s = state.subs.length;
      const a = state.audits.length;
      try {
        return await fn(client);
      } catch (error) {
        state.subs.length = s;
        state.audits.length = a;
        throw error;
      }
    },
  };
  return client;
}

describe('POST /api/v1/growth/publish/template-page', () => {
  let app: INestApplication;
  let state: State;
  const saved: Record<string, string | undefined> = {};
  const envNames = [ENABLE_ENV, TOKEN_ENV, ...FORBIDDEN_REUSE_ENVS];

  beforeEach(async () => {
    for (const name of envNames) {
      saved[name] = process.env[name];
      delete process.env[name];
    }
    process.env[ENABLE_ENV] = 'true';
    process.env[TOKEN_ENV] = TOKEN;
    receiverClock.now = () => NOON;
    state = { subs: [], audits: [], calls: [], failAudit: false };
    const ref = await Test.createTestingModule({
      controllers: [TemplatePageReceiverController],
      providers: [TemplatePageReceiverService, { provide: PrismaService, useValue: fakePrisma(state) }],
    }).compile();
    app = ref.createNestApplication();
    configureApp(app, []);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    receiverClock.now = () => new Date();
    for (const name of envNames) {
      if (saved[name] === undefined) delete process.env[name];
      else process.env[name] = saved[name];
    }
  });

  const post = (body: unknown, auth: string | null = `Bearer ${TOKEN}`) => {
    const req = request(app.getHttpServer()).post(PATH).set('Content-Type', 'application/json');
    if (auth !== null) req.set('Authorization', auth);
    return req.send(JSON.stringify(body));
  };
  const at = (iso: string) => {
    receiverClock.now = () => new Date(iso);
  };

  describe('开关（默认关）', () => {
    it('开关变量名固定，没设就是关', () => {
      expect(ENABLE_ENV).toBe('FENFAXIA_PUBLISH_RECEIVER_ENABLED');
      expect(receiverEnabled({})).toBe(false);
      expect(receiverEnabled({ [ENABLE_ENV]: 'true' })).toBe(true);
    });

    it.each([[undefined], [''], ['false'], ['0'], ['off'], ['no'], ['enabled']])('开关=%p → 503 disabled，令牌正确也不收，不写审计', async (value) => {
      if (value === undefined) delete process.env[ENABLE_ENV];
      else process.env[ENABLE_ENV] = value;
      const res = await post(goodBody()).expect(503);
      expect(res.body).toMatchObject({ success: false, accepted: false, reason: 'disabled' });
      expect(state.subs).toHaveLength(0);
      expect(state.audits).toHaveLength(0);
    });
  });

  describe('令牌', () => {
    it('令牌变量名是 OPENCLAW_FENFAXIA_API_TOKEN', () => {
      expect(TOKEN_ENV).toBe('OPENCLAW_FENFAXIA_API_TOKEN');
    });

    it('令牌没配 → 503 token_not_configured', async () => {
      delete process.env[TOKEN_ENV];
      const res = await post(goodBody()).expect(503);
      expect(res.body.reason).toBe('token_not_configured');
      process.env[TOKEN_ENV] = '   ';
      expect((await post(goodBody(), 'Bearer    ').expect(503)).body.reason).toBe('token_not_configured');
    });

    it.each(FORBIDDEN_REUSE_ENVS.map((name) => [name]))('令牌与 %s 相同 → 当作没配置', async (name) => {
      process.env[name] = TOKEN;
      expect(configuredToken()).toBe('');
      const res = await post(goodBody()).expect(503);
      expect(res.body.reason).toBe('token_not_configured');
      expect(state.subs).toHaveLength(0);
    });

    it.each([
      ['缺少', null],
      ['错误', 'Bearer wrong-token'],
      ['Basic 方案', `Basic ${TOKEN}`],
      ['不带方案', TOKEN],
      ['前缀相同', `Bearer ${TOKEN}x`],
      ['登录 JWT 样式', 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1MSJ9.sig'],
    ])('令牌%s → 401 unauthorized，不写审计', async (_label, auth) => {
      const res = await post(goodBody(), auth as string | null).expect(401);
      expect(res.body).toMatchObject({ accepted: false, reason: 'unauthorized' });
      expect(state.audits).toHaveLength(0);
      expect(state.subs).toHaveLength(0);
    });

    it('scheme 大小写不敏感', async () => {
      await post(goodBody(), `bearer ${TOKEN}`).expect(201);
    });
  });

  describe('接收', () => {
    it('四项都满足 → 201，只存不发，写一行审计', async () => {
      const res = await post(goodBody()).expect(201);
      expect(res.headers['cache-control']).toBe('no-store');
      expect(res.body).toMatchObject({ success: true, accepted: true, stored: true, published: false, duplicate: false, url: null, content_sha256: HUB_SHA });
      expect(state.subs).toHaveLength(1);
      expect(state.subs[0]).toMatchObject({ content_sha256: HUB_SHA, approval_id: 'ap_test0001', title: HUB_CONTENT.title, status: 'received', url: HUB_CONTENT.url });
      expect(state.audits).toHaveLength(1);
      expect(state.audits[0]).toMatchObject({ action: 'template_page_receive', decision: 'accepted', reason: 'ok', submission_id: res.body.id });
    });

    it('内容哈希与中枢 Python 算法逐字节一致', () => {
      expect(contentSha256(HUB_CONTENT)).toBe(HUB_SHA);
      const tricky = { b: [1, true, null, '引号"和\\反斜杠\t制表'], a: { z: '😀', é: 'x', Z: 0 }, ctl: '\u0001\u2028' };
      expect(contentSha256(tricky)).toBe('23cd02e95205f7bebfc14201b1cc4010aada46bff17034cbb5b99c6e69af8661');
      expect(canonicalJson({ b: 1, a: [2, 'x'] })).toBe('{"a":[2,"x"],"b":1}');
      expect(() => canonicalJson({ n: 1.5 })).toThrow();
    });

    it('同一内容再推 → 200 duplicate，不覆盖，重复也记审计', async () => {
      const first = await post(goodBody()).expect(201);
      const second = await post(goodBody()).expect(200);
      expect(second.body).toMatchObject({ accepted: true, duplicate: true, id: first.body.id, published: false });
      expect(state.subs).toHaveLength(1);
      expect(state.audits.map((a) => a.decision)).toEqual(['accepted', 'duplicate']);
    });
  });

  describe('上海时间窗 08:00–21:30（两端都含，按整分钟）', () => {
    it.each([
      ['2026-11-18T23:59:59Z', '上海 07:59:59', 403],
      ['2026-11-19T00:00:00Z', '上海 08:00:00', 201],
      ['2026-11-19T00:00:30Z', '上海 08:00:30', 201],
      ['2026-11-19T13:30:00Z', '上海 21:30:00', 201],
      ['2026-11-19T13:30:59Z', '上海 21:30:59', 201],
      ['2026-11-19T13:31:00Z', '上海 21:31:00', 403],
      ['2026-11-19T16:00:00Z', '上海 00:00', 403],
      ['2026-11-19T15:59:00Z', '上海 23:59', 403],
      ['2026-11-19T08:30:00-05:00', 'UTC-5 08:30 = 上海 21:30', 201],
      ['2026-11-19T08:31:00-05:00', 'UTC-5 08:31 = 上海 21:31', 403],
      ['2026-11-19T08:00:00+08:00', '+08:00 08:00', 201],
    ])('%s（%s）→ %i', async (iso, _label, status) => {
      at(iso);
      const res = await post(goodBody()).expect(status);
      if (status === 403) {
        expect(res.body).toMatchObject({ reason: 'outside_window', failed: ['outside_window'] });
        expect(state.subs).toHaveLength(0);
        expect(state.audits[0]).toMatchObject({ decision: 'rejected', reason: 'outside_window' });
      }
    });

    it('inWindow 不看机器时区', () => {
      expect(inWindow(new Date(Date.UTC(2026, 10, 19, 0, 0)))).toBe(true);
      expect(inWindow(new Date(Date.UTC(2026, 10, 18, 23, 59)))).toBe(false);
    });
  });

  describe('批准单', () => {
    it('中枢当前的请求体（不带批准单）→ 409 approval_missing', async () => {
      const res = await post({ content: HUB_CONTENT, stub: false, note: '' }).expect(409);
      expect(res.body).toMatchObject({ reason: 'approval_missing', message: REASONS.approval_missing.message, content_sha256: HUB_SHA });
      expect(state.subs).toHaveLength(0);
    });

    it('空批准单 → approval_missing', async () => {
      expect((await post(goodBody(HUB_CONTENT, {})).expect(409)).body.reason).toBe('approval_missing');
    });

    it.each([['pending'], ['rejected'], ['timeout'], ['invalidated'], [''], ['APPROVED']])('状态 %p → approval_not_approved', async (status) => {
      const res = await post(goodBody(HUB_CONTENT, approvalFor(HUB_CONTENT, { status }))).expect(409);
      expect(res.body.reason).toBe('approval_not_approved');
    });

    it('批准后改了标题 → sha_mismatch', async () => {
      const approval = approvalFor(HUB_CONTENT);
      const res = await post(goodBody({ ...HUB_CONTENT, title: '改过的标题' }, approval)).expect(409);
      expect(res.body.reason).toBe('sha_mismatch');
      expect(state.subs).toHaveLength(0);
    });

    it('批准单哈希写错 → sha_mismatch', async () => {
      const res = await post(goodBody(HUB_CONTENT, approvalFor(HUB_CONTENT, { content_sha256: '0'.repeat(64) }))).expect(409);
      expect(res.body.reason).toBe('sha_mismatch');
    });

    it('哈希大写也认', async () => {
      await post(goodBody(HUB_CONTENT, approvalFor(HUB_CONTENT, { content_sha256: HUB_SHA.toUpperCase() }))).expect(201);
    });

    it('公众号批准单要确认看过详情', async () => {
      const res = await post(goodBody(HUB_CONTENT, approvalFor(HUB_CONTENT, { channel: 'oa' }))).expect(409);
      expect(res.body.reason).toBe('approval_detail_not_checked');
      await post(goodBody(HUB_CONTENT, approvalFor(HUB_CONTENT, { channel: 'oa', detail_checked: true }))).expect(201);
    });
  });

  describe('AIGC 标识', () => {
    it('正文没有「【本内容由 AI 生成】」→ 422 aigc_missing', async () => {
      const content = { ...HUB_CONTENT, body: '周末探店的三个开头写法。' };
      const res = await post(goodBody(content)).expect(422);
      expect(res.body).toMatchObject({ reason: 'aigc_missing', failed: ['aigc_missing'] });
      expect(state.subs).toHaveLength(0);
    });

    it('标识只在标题里也不算', async () => {
      const content = { ...HUB_CONTENT, title: `${AIGC_LABEL}周末探店`, body: '周末探店的三个开头写法。' };
      expect((await post(goodBody(content)).expect(422)).body.reason).toBe('aigc_missing');
    });
  });

  describe('其他原因', () => {
    it('多项不满足时全列出来', async () => {
      at('2026-11-19T14:00:00Z');
      const content = { ...HUB_CONTENT, body: '没有标识' };
      const res = await post({ content, stub: false, note: '' }).expect(403);
      expect(res.body.failed).toEqual(['outside_window', 'aigc_missing', 'approval_missing']);
      expect(state.audits[0].detail.failed).toEqual(['outside_window', 'aigc_missing', 'approval_missing']);
    });

    it('命中中枢禁用词（去掉空格也算）→ 422 compliance_failed', async () => {
      const content = { ...HUB_CONTENT, body: `一键洗 稿模板\n\n${AIGC_LABEL}` };
      const res = await post(goodBody(content)).expect(422);
      expect(res.body.reason).toBe('compliance_failed');
    });

    it.each([
      ['不是对象', ['x']],
      ['没有 content', { stub: false }],
      ['标题不是字符串', { content: { ...HUB_CONTENT, title: 1 } }],
      ['产品不对', { content: { ...HUB_CONTENT, product: 'shunshi' } }],
      ['渠道不对', { content: { ...HUB_CONTENT, channel: 'website_seo' } }],
      ['stub=true', { content: HUB_CONTENT, stub: true }],
      ['含小数', { content: { ...HUB_CONTENT, score: 1.5 } }],
    ])('%s → 422 bad_request', async (_label, body) => {
      const res = await post(body).expect(422);
      expect(res.body.reason).toBe('bad_request');
      expect(state.subs).toHaveLength(0);
    });

    it('checkContent 只判断不碰库', () => {
      expect(checkContent(goodBody(), NOON).failed).toEqual([]);
    });
  });

  describe('只追加的审计', () => {
    it('拒绝也写审计，之前的记录不变', async () => {
      await post(goodBody()).expect(201);
      const before = JSON.stringify(state.audits);
      await post({ content: HUB_CONTENT, stub: false, note: '' }).expect(409);
      expect(state.audits).toHaveLength(2);
      expect(JSON.stringify(state.audits.slice(0, 1))).toBe(JSON.stringify(JSON.parse(before)));
      expect(state.audits[1]).toMatchObject({ decision: 'rejected', reason: 'approval_missing' });
    });

    it('审计写不进去 → 503 audit_unavailable，内容也不存', async () => {
      state.failAudit = true;
      const res = await post(goodBody()).expect(503);
      expect(res.body.reason).toBe('audit_unavailable');
      expect(state.subs).toHaveLength(0);
    });

    it('拒绝时审计写不进去，照样拒绝', async () => {
      state.failAudit = true;
      expect((await post({ content: HUB_CONTENT }).expect(409)).body.reason).toBe('approval_missing');
    });

    it('服务只调用 create / findUnique，从不 update / delete / upsert', async () => {
      await post(goodBody()).expect(201);
      await post(goodBody()).expect(200);
      await post({ content: HUB_CONTENT }).expect(409);
      expect(state.calls.length).toBeGreaterThan(0);
      expect(state.calls.filter((c) => /update|delete|upsert|executeRaw|queryRaw/i.test(c))).toEqual([]);
    });

    it('迁移里两张表都有拒绝 UPDATE / DELETE / TRUNCATE 的触发器', () => {
      const sql = readFileSync(join(__dirname, '../../../database/prisma/migrations/20261119120000_growth_publish_receiver/migration.sql'), 'utf8');
      for (const table of ['GrowthTemplatePageSubmission', 'GrowthPublishReceiveAudit']) {
        expect(sql).toMatch(new RegExp(`BEFORE UPDATE OR DELETE ON "${table}"`));
        expect(sql).toMatch(new RegExp(`BEFORE TRUNCATE ON "${table}"`));
      }
      expect(sql).toMatch(/RAISE EXCEPTION '% is append-only'/);
    });
  });

  it('接收模块没有任何外呼', () => {
    for (const file of ['template-page-receiver.ts', 'template-page-receiver.service.ts', 'template-page-receiver.controller.ts']) {
      const src = readFileSync(join(__dirname, file), 'utf8');
      expect(src).not.toMatch(/from '(axios|node-fetch|undici|http|https|got)'|\bfetch\(|HttpService|request\(/);
    }
  });
});
