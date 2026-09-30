/**
 * 发布分发器（国内版）的安全与合规：
 *
 * 1. 用户取消了任务，队列里的作业照样执行：processor 一上来就把状态改成 processing，
 *    不看当前是不是 cancelled —— 「取消」等于没取消，内容照发。
 *    已发布 / 已提交的任务被队列重投递时也会再发一次。
 * 2. 定时任务在创建时做过六道闸检查，几天后真正发出前不再检查；内容被删了也照发。
 * 3. AI 生成内容分发出去时，正文里的「AI 生成」显式标识与元数据标识没有随载荷带给分发器。
 * 4. 写进任务、展示给用户的失败原因是英文原文（Dispatcher HTTP 500 / not configured）。
 */
import { ConfigService } from '@nestjs/config';
import { AI_TEXT_LABEL } from '../../common/ai-content-label';
import { PublishProcessor } from './publish.processor';

describe('PublishProcessor（国内版）', () => {
  const prisma = { publishTask: { findFirst: jest.fn(), update: jest.fn(), updateMany: jest.fn() } } as any;
  const baseTask = () => ({
    id: 'task_1',
    tenant_id: 'tenant_1',
    status: 'queued',
    scheduled_at: new Date('2026-08-13T12:00:00Z'),
    content: {
      id: 'content_1', status: 'approved', source: 'manual', title: '标题', body: '一段人写的正文',
      body_html: null, cover_url: null, media_urls: [], tags: [],
    },
    platform_account: { id: 'account_1', platform: 'douyin', account_name: '账号', account_nickname: null, platform_account_id: 'p1' },
  });
  const cfg = { MARKET_REGION: 'cn', PUBLISH_DISPATCH_WEBHOOK_URL: 'https://automation.example.cn/publish', PUBLISH_DISPATCH_WEBHOOK_SECRET: 'x'.repeat(32) };
  const processor = (values: Record<string, string> = {}) => new PublishProcessor(prisma, new ConfigService({ ...cfg, ...values }));
  const job = { data: { taskId: 'task_1' } } as any;
  const okFetch = () => jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, json: async () => ({ state: 'SUBMITTED', remotePostId: 'r1' }) } as Response);
  const sentPayload = () => JSON.parse(((global.fetch as jest.Mock).mock.calls[0][1] as any).body);
  const lastUpdate = () => {
    const calls = prisma.publishTask.update.mock.calls;
    return calls[calls.length - 1]?.[0];
  };

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.resetAllMocks();
    prisma.publishTask.findFirst.mockResolvedValue(baseTask());
    prisma.publishTask.update.mockImplementation(({ data }: any) => Promise.resolve(data));
    prisma.publishTask.updateMany.mockResolvedValue({ count: 1 });
  });

  it.each(['cancelled', 'published', 'submitted_unconfirmed'])('任务已是 %s：不再分发，也不改写状态', async (status) => {
    prisma.publishTask.findFirst.mockResolvedValue({ ...baseTask(), status });
    const fetchSpy = okFetch();
    await processor().dispatch(job);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(prisma.publishTask.update).not.toHaveBeenCalled();
    expect(prisma.publishTask.updateMany).not.toHaveBeenCalled();
  });

  it('把状态改成 processing 是有条件的：抢占失败（刚被取消）就放弃，不分发', async () => {
    prisma.publishTask.updateMany.mockResolvedValue({ count: 0 });
    const fetchSpy = okFetch();
    await processor().dispatch(job);
    expect(fetchSpy).not.toHaveBeenCalled();
    const where = prisma.publishTask.updateMany.mock.calls[0][0].where;
    expect(JSON.stringify(where)).toContain('cancelled');
  });

  it('内容已删除：不分发，任务标记失败，原因是中文', async () => {
    prisma.publishTask.findFirst.mockResolvedValue({ ...baseTask(), content: { ...baseTask().content, status: 'deleted' } });
    const fetchSpy = okFetch();
    await expect(processor().dispatch(job)).rejects.toThrow(/内容/);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(lastUpdate().data).toMatchObject({ status: 'failed' });
    expect(lastUpdate().data.error_message).toMatch(/[一-鿿]/);
  });

  it('发出前再过一遍六道闸：定时期间规则命中的内容不分发', async () => {
    prisma.publishTask.findFirst.mockResolvedValue({ ...baseTask(), content: { ...baseTask().content, body: '这个方案稳赚不赔' } });
    const fetchSpy = okFetch();
    await expect(processor().dispatch(job)).rejects.toThrow(/合规|六道闸/);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(lastUpdate().data).toMatchObject({ status: 'failed', error_code: 'CONTENT_COMPLIANCE_BLOCKED' });
  });

  it('AI 生成内容：载荷里正文带显式标识，并带上隐式标识元数据', async () => {
    prisma.publishTask.findFirst.mockResolvedValue({
      ...baseTask(),
      content: { ...baseTask().content, source: 'ai', ai_model: 'qwen-plus', body: '没有标识的 AI 脚本', body_html: '<p>没有标识</p>', media_urls: ['https://cdn.example.cn/a.png'] },
    });
    okFetch();
    await processor().dispatch(job);
    const payload = sentPayload();
    expect(payload.content.body.startsWith(AI_TEXT_LABEL)).toBe(true);
    expect(payload.content.bodyHtml).toContain(AI_TEXT_LABEL);
    expect(payload.content.aiGenerated).toBe(true);
    expect(payload.content.aiLabel).toBe(AI_TEXT_LABEL);
    expect(payload.content.aiMetadata).toMatchObject({ ai_generated: true, generator: expect.any(String) });
  });

  it('AI 生成内容：已带标识的正文不重复叠加', async () => {
    prisma.publishTask.findFirst.mockResolvedValue({
      ...baseTask(),
      content: { ...baseTask().content, source: 'ai', body: `${AI_TEXT_LABEL}\n已带标识` },
    });
    okFetch();
    await processor().dispatch(job);
    expect(sentPayload().content.body.split(AI_TEXT_LABEL).length - 1).toBe(1);
  });

  it('人工创作的内容：不加标识，aiGenerated 为 false', async () => {
    okFetch();
    await processor().dispatch(job);
    const payload = sentPayload();
    expect(payload.content.body).toBe('一段人写的正文');
    expect(payload.content.aiGenerated).toBe(false);
  });

  it('国内版的失败原因全是中文，不露出 HTTP 状态码原文', async () => {
    // 分发器 500 且给了英文原因
    jest.spyOn(global, 'fetch').mockResolvedValue({ ok: false, status: 500, json: async () => ({ failureReason: 'Upstream Postiz exploded' }) } as Response);
    await expect(processor().dispatch(job)).rejects.toThrow(/[一-鿿]/);
    const msg: string = lastUpdate().data.error_message;
    expect(msg).toMatch(/[一-鿿]/);
    expect(msg).not.toMatch(/HTTP|Dispatcher|Postiz|exploded/);
  });

  it('国内版：未配置 / 密钥太短 / 声称已发布却没有远端 ID，报错都是中文', async () => {
    await expect(processor({ PUBLISH_DISPATCH_WEBHOOK_URL: '' }).dispatch(job)).rejects.toThrow(/未配置/);
    await expect(processor({ PUBLISH_DISPATCH_WEBHOOK_SECRET: 'short' }).dispatch(job)).rejects.toThrow(/32/);
    await expect(processor({ PUBLISH_DISPATCH_WEBHOOK_URL: 'http://x.example.cn/p' }).dispatch(job)).rejects.toThrow(/必须使用 HTTPS/);
    jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, json: async () => ({ state: 'PUBLISHED' }) } as Response);
    await expect(processor().dispatch(job)).rejects.toThrow(/内容编号/);
    for (const call of prisma.publishTask.update.mock.calls) {
      const m = call[0].data.error_message;
      if (m) expect(m).toMatch(/[一-鿿]/);
    }
  });
});
