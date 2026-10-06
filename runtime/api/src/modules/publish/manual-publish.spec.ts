import { BadRequestException } from '@nestjs/common';
import { PublishService } from './publish.service';
import { AI_TEXT_LABEL } from '../../common/ai-content-label';
import { MANUAL_PLATFORMS, normalizeManualPostUrl } from './manual-publish';

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

  it('只支持小红书 / 视频号 / 公众号；未通过审核、额度用完都拒绝', async () => {
    const a = build();
    await expect(a.service.createManualTasks('t', 'u', { contentId: 'c1', platforms: ['douyin'] })).rejects.toThrow('只支持小红书、视频号、公众号');
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

  it('链接校验：各平台只认自己的域名', () => {
    expect(normalizeManualPostUrl('wechat_mp', 'https://mp.weixin.qq.com/s/abc')).toBe('https://mp.weixin.qq.com/s/abc');
    expect(normalizeManualPostUrl('weixin', 'https://channels.weixin.qq.com/x')).toBe('https://channels.weixin.qq.com/x');
    expect(() => normalizeManualPostUrl('wechat_mp', 'https://mp.weixin.qq.com.evil.cn/s/abc')).toThrow();
    expect(() => normalizeManualPostUrl('xhs', 'https://user:pw@www.xiaohongshu.com/a')).toThrow();
    expect(normalizeManualPostUrl('xhs', '   ')).toBeNull();
    expect(Object.keys(MANUAL_PLATFORMS)).toEqual(['xhs', 'weixin', 'wechat_mp']);
  });
});
