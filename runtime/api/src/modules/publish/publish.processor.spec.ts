import { ConfigService } from '@nestjs/config';
import { PublishProcessor } from './publish.processor';

describe('PublishProcessor', () => {
  const prisma = {
    publishTask: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  } as any;

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    prisma.publishTask.findFirst.mockResolvedValue({
      id: 'task_1',
      tenant_id: 'tenant_1',
      scheduled_at: new Date('2026-08-13T12:00:00Z'),
      content: {
        id: 'content_1',
        title: 'Launch update',
        body: 'Verified copy',
        body_html: null,
        cover_url: null,
        media_urls: [],
        tags: [],
      },
      platform_account: {
        id: 'account_1',
        platform: 'x',
        account_name: 'ContentFlow',
        account_nickname: null,
        platform_account_id: 'integration_1',
      },
    });
    prisma.publishTask.update.mockImplementation(({ data }: any) => Promise.resolve(data));
  });

  function processor(values: Record<string, string>) {
    return new PublishProcessor(
      prisma,
      new ConfigService({ MARKET_REGION: 'global', ...values }),
    );
  }

  const job = { data: { taskId: 'task_1' } } as any;

  it('fails closed when the dispatcher is not configured', async () => {
    await expect(processor({}).dispatch(job)).rejects.toThrow('not configured');
    expect(prisma.publishTask.findFirst).not.toHaveBeenCalled();
  });

  it('rejects weak dispatcher secrets before loading a task', async () => {
    await expect(processor({
      PUBLISH_DISPATCH_WEBHOOK_URL: 'https://automation.example.com/publish',
      PUBLISH_DISPATCH_WEBHOOK_SECRET: 'too-short',
    }).dispatch(job)).rejects.toThrow('at least 32');
    expect(prisma.publishTask.findFirst).not.toHaveBeenCalled();
  });

  it('requires remote identity before accepting a published state', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ state: 'PUBLISHED' }),
    } as Response);

    await expect(processor({
      PUBLISH_DISPATCH_WEBHOOK_URL: 'https://automation.example.com/publish',
      PUBLISH_DISPATCH_WEBHOOK_SECRET: 'x'.repeat(32),
    }).dispatch(job)).rejects.toThrow('without a remote post ID');

    expect(prisma.publishTask.update).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'failed', error_code: 'DISPATCH_FAILED' }),
    }));
  });

  it('records a confirmed remote ID and URL', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        state: 'PUBLISHED',
        remotePostId: 'remote_1',
        remotePostUrl: 'https://social.example.com/posts/remote_1',
      }),
    } as Response);

    await processor({
      PUBLISH_DISPATCH_WEBHOOK_URL: 'https://automation.example.com/publish',
      PUBLISH_DISPATCH_WEBHOOK_SECRET: 'x'.repeat(32),
    }).dispatch(job);

    expect(prisma.publishTask.update).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: 'published',
        platform_post_id: 'remote_1',
        completed_at: expect.any(Date),
      }),
    }));
    const request = (global.fetch as jest.Mock).mock.calls[0];
    expect(request[1].headers['Idempotency-Key']).toBe('contentflow:task_1');
    expect(request[1].headers['X-ContentFlow-Signature']).toMatch(/^sha256=[a-f0-9]{64}$/);
  });
});
