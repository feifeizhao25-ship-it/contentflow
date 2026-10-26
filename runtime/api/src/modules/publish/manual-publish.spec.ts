import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PublishService } from './publish.service';
import { AI_TEXT_LABEL } from '../../common/ai-content-label';
import { MANUAL_PLATFORMS, normalizeManualPostUrl, officialAutoPublishAllowed } from './manual-publish';
import { CreateManualPublishDto } from './dto/create-manual-publish.dto';

/**
 * 审计 P0-1：小红书 / 视频号 / 公众号没有可用的自动发布通道，也没有兜底流程。
 * 现在走「人工确认发布」：manual_pending → 复制文案 / 下载封面 → 我已手动发布（manual_done，可回填链接）。
 */
describe('人工确认发布闭环', () => {
  function build(content: Record<string, unknown> = {}) {
    const store: Record<string, any> = {};
    const pcs: Record<string, any> = {};
    let seq = 0;
    const prisma: any = {
      content: { findFirst: jest.fn().mockResolvedValue({ id: 'c1', tenant_id: 't', status: 'approved', title: '秋天的书单', body: '正文内容', cover_url: 'https://dashscope-result-bj.oss-cn-beijing.aliyuncs.com/a.png', source: 'ai', ...content }) },
      platformContent: { upsert: jest.fn(async ({ create }: any) => { pcs[`pc-${create.platform}`] = { id: `pc-${create.platform}`, ...create }; return pcs[`pc-${create.platform}`]; }) },
      publishTask: {
        create: jest.fn(async ({ data }: any) => { const t = { id: `task-${++seq}`, ...data }; store[t.id] = t; return t; }),
        findFirst: jest.fn(async ({ where }: any): Promise<any> => {
          const t = store[where.id];
          if (!t || t.tenant_id !== where.tenant_id) return null;
          return { ...t, platform_content: pcs[t.platform_content_id] ?? null, content: { title: '秋天的书单', body: '正文内容', cover_url: null, source: content.source ?? 'ai' } };
        }),
        update: jest.fn(async ({ where, data }: any) => { store[where.id] = { ...store[where.id], ...data }; return store[where.id]; }),
      },
    };
    const tenant = { checkQuota: jest.fn().mockResolvedValue(true), incrementUsage: jest.fn() };
    const queue = { addPublishTask: jest.fn() };
    const config = { get: jest.fn((_k: string, fallback: unknown) => fallback) };
    const service = new PublishService(prisma as any, queue as any, tenant as any, { get: jest.fn() } as any, config as any);
    return { service, prisma, tenant, queue, store };
  }

  it('小红书、公众号各建一条 manual_pending 任务：不进发布队列、计入每月发布条数', async () => {
    const { service, tenant, queue } = build();
    const tasks = await service.createManualTasks('t', 'u', { contentId: 'c1', platforms: ['xhs', 'wechat_mp'] });
    expect(tasks.map((t: any) => t.status)).toEqual(['manual_pending', 'manual_pending']);
    expect(tasks.every((t: any) => t.platform_account_id === undefined && t.publish_type === 'manual')).toBe(true);
    expect(queue.addPublishTask).not.toHaveBeenCalled();
    expect(tenant.checkQuota).toHaveBeenCalledWith('t', 'publish', 2);
    expect(tenant.incrementUsage).toHaveBeenCalledWith('t', 'publish', 2);
  });

  it('AI 生成的内容：平台文案快照与「复制文案」素材都带「AI 生成」显式标识', async () => {
    const { service, prisma } = build();
    const [task] = await service.createManualTasks('t', 'u', { contentId: 'c1', platforms: ['xhs'] });
    expect(prisma.platformContent.upsert.mock.calls[0][0].create.body.startsWith(AI_TEXT_LABEL)).toBe(true);
    const kit = await service.getManualKit(task.id, 't');
    expect(kit.body.startsWith(AI_TEXT_LABEL)).toBe(true);
    expect(kit.aiGenerated).toBe(true);
    expect(kit.platformName).toBe('小红书');
    expect(kit.guide).toMatch(/[一-鿿]/);
  });

  it('「我已手动发布」→ manual_done，回填链接只保存；别的平台域名、http、乱写都拒绝', async () => {
    const { service, store } = build();
    const [task] = await service.createManualTasks('t', 'u', { contentId: 'c1', platforms: ['xhs'] });
    await expect(service.confirmManualPublished(task.id, 't', 'https://www.douyin.com/video/1')).rejects.toThrow('小红书');
    await expect(service.confirmManualPublished(task.id, 't', 'http://www.xiaohongshu.com/explore/1')).rejects.toBeInstanceOf(BadRequestException);
    const done = await service.confirmManualPublished(task.id, 't', ' https://www.xiaohongshu.com/explore/abc#x ');
    expect(done.status).toBe('manual_done');
    expect(store[task.id].platform_post_url).toBe('https://www.xiaohongshu.com/explore/abc');
  });

  it('不回填链接也可以确认；别的工作区的任务不存在', async () => {
    const { service } = build();
    const [task] = await service.createManualTasks('t', 'u', { contentId: 'c1', platforms: ['weixin'] });
    expect((await service.confirmManualPublished(task.id, 't')).status).toBe('manual_done');
    await expect(service.confirmManualPublished(task.id, 'other')).rejects.toThrow('任务不存在');
  });

  it('小红书/视频号/公众号/知乎/抖音/B站都是人工确认；未支持的平台、未通过审核、额度用完都拒绝', async () => {
    const a = build();
    await expect(a.service.createManualTasks('t', 'u', { contentId: 'c1', platforms: ['weibo'] })).rejects.toThrow('人工确认发布支持');
    await expect(a.service.createManualTasks('t', 'u', { contentId: 'c1', platforms: ['zhihu'] })).resolves.toHaveLength(1);
    await expect(a.service.createManualTasks('t', 'u', { contentId: 'c1', platforms: ['douyin'] })).resolves.toHaveLength(1);
    const b = build({ status: 'draft' });
    await expect(b.service.createManualTasks('t', 'u', { contentId: 'c1', platforms: ['xhs'] })).rejects.toThrow('内容未通过审核');
    const c = build();
    c.tenant.checkQuota.mockResolvedValue(false);
    await expect(c.service.createManualTasks('t', 'u', { contentId: 'c1', platforms: ['xhs'] })).rejects.toThrow('发布次数已达上限');
  });

  it('含违禁表述的内容同样过六道闸，不能绕过人工发布', async () => {
    const { service } = build({ body: '稳赚不赔的最佳选择' });
    await expect(service.createManualTasks('t', 'u', { contentId: 'c1', platforms: ['xhs'] })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('可能有风险的表述在资料未过期时仍可生成人工发布任务', async () => {
    const { service } = build({ body: '需要的话加微信领资料' });
    await expect(service.createManualTasks('t', 'u', { contentId: 'c1', platforms: ['xhs'] })).resolves.toHaveLength(1);
  });

  it('资料过期时，可能有风险的内容必须确认后才能发布，明确违规不能靠确认放行', async () => {
    const rag = { freshnessReport: jest.fn().mockResolvedValue({ needsReview: true }) };
    const risky = build({ body: '需要的话加微信领资料' });
    const strict = new PublishService(risky.prisma, {} as any, risky.tenant as any, { get: jest.fn() } as any, { get: jest.fn((_k: string, fallback: unknown) => fallback) } as any, undefined, rag as any);
    await expect(strict.createManualTasks('t', 'u', { contentId: 'c1', platforms: ['douyin'] })).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'COMPLIANCE_RISK_ACK_REQUIRED' }),
    });
    await expect(strict.createManualTasks('t', 'u', { contentId: 'c1', platforms: ['douyin'], riskAcknowledged: true })).resolves.toHaveLength(1);
    const blocked = build({ body: '这是国家级最佳' });
    const stillBlocked = new PublishService(blocked.prisma, {} as any, blocked.tenant as any, { get: jest.fn() } as any, { get: jest.fn((_k: string, fallback: unknown) => fallback) } as any, undefined, rag as any);
    await expect(stillBlocked.createManualTasks('t', 'u', { contentId: 'c1', platforms: ['bilibili'], riskAcknowledged: true })).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'CONTENT_COMPLIANCE_BLOCKED' }),
    });
  });

  it('人工发布请求体接受抖音和 B 站', async () => {
    const dto = plainToInstance(CreateManualPublishDto, { contentId: 'c1', platforms: ['douyin', 'bilibili'] });
    expect(await validate(dto)).toEqual([]);
  });

  it('链接校验：各平台只认自己的域名', () => {
    expect(normalizeManualPostUrl('wechat_mp', 'https://mp.weixin.qq.com/s/abc')).toBe('https://mp.weixin.qq.com/s/abc');
    expect(normalizeManualPostUrl('weixin', 'https://channels.weixin.qq.com/x')).toBe('https://channels.weixin.qq.com/x');
    expect(() => normalizeManualPostUrl('wechat_mp', 'https://mp.weixin.qq.com.evil.cn/s/abc')).toThrow();
    expect(() => normalizeManualPostUrl('xhs', 'https://user:pw@www.xiaohongshu.com/a')).toThrow();
    expect(normalizeManualPostUrl('xhs', '   ')).toBeNull();
    expect(Object.keys(MANUAL_PLATFORMS)).toEqual(['douyin', 'bilibili', 'xhs', 'weixin', 'wechat_mp', 'zhihu']);
    expect(normalizeManualPostUrl('douyin', 'https://www.douyin.com/video/1')).toContain('douyin.com');
    expect(() => normalizeManualPostUrl('douyin', 'https://www.bilibili.com/video/1')).toThrow();
    expect(normalizeManualPostUrl('zhihu', 'https://www.zhihu.com/question/1/answer/2')).toContain('zhihu.com');
    expect(normalizeManualPostUrl('zhihu', 'https://zhuanlan.zhihu.com/p/1')).toContain('zhuanlan.zhihu.com');
  });

  it('小红书、公众号、视频号、知乎永远不能自动发布；抖音和 B 站开关打开也不进发布队列', async () => {
    delete process.env.DOUYIN_ENTERPRISE_AUTHORIZED;
    delete process.env.BILIBILI_ENTERPRISE_AUTHORIZED;
    expect(officialAutoPublishAllowed('xhs')).toBe(false);
    expect(officialAutoPublishAllowed('weixin')).toBe(false);
    expect(officialAutoPublishAllowed('wechat_mp')).toBe(false);
    expect(officialAutoPublishAllowed('zhihu')).toBe(false);
    expect(officialAutoPublishAllowed('douyin')).toBe(false);
    expect(officialAutoPublishAllowed('bilibili')).toBe(false);
    process.env.DOUYIN_ENTERPRISE_AUTHORIZED = '1';
    process.env.BILIBILI_ENTERPRISE_AUTHORIZED = '1';
    expect(officialAutoPublishAllowed('douyin')).toBe(true);
    expect(officialAutoPublishAllowed('bilibili')).toBe(true);
    expect(officialAutoPublishAllowed('zhihu')).toBe(false);
    const { service, queue } = build();
    await service.createManualTasks('t', 'u', { contentId: 'c1', platforms: ['douyin', 'bilibili'] });
    expect(queue.addPublishTask).not.toHaveBeenCalled();
    delete process.env.DOUYIN_ENTERPRISE_AUTHORIZED;
    delete process.env.BILIBILI_ENTERPRISE_AUTHORIZED;
  });
});

describe('人工发布素材带隐式标识要素', () => {
  it('manual-kit 返回内容编号与服务提供者编码（下载封面时写进元数据）', async () => {
    process.env.AIGC_PROVIDER_CODE = 'TESTCODE';
    const task = { id: 'task-1', tenant_id: 't', content_id: 'c1', status: 'manual_pending', platform_content: { platform: 'xhs', title: 'T', body: '正文', cover_url: null }, content: { title: 'T', body: '正文', cover_url: null, source: 'manual' } };
    const prisma = { publishTask: { findFirst: jest.fn().mockResolvedValue(task) } };
    const service = new PublishService(prisma as any, {} as any, {} as any, {} as any, { get: () => undefined } as any);
    const kit = await service.getManualKit('task-1', 't');
    expect(kit.contentId).toBe('c1');
    expect(kit.providerCode).toBe('TESTCODE');
    delete process.env.AIGC_PROVIDER_CODE;
  });
});
