import { ContentService } from './content.service';
import { localStubCompletion } from '../ai/local-ai-stub';

/**
 * 流1：国际版语言校验在写库之前。中文输入不落库；已落库的坏数据不让整页失败。
 * 桩模式下国际版返回英文示例。没有模型密钥。
 */
describe('international content language', () => {
  const previous = process.env.MARKET_REGION;
  afterEach(() => {
    if (previous === undefined) delete process.env.MARKET_REGION;
    else process.env.MARKET_REGION = previous;
  });

  it('rejects a Chinese draft before insert and does not call the database write', async () => {
    process.env.MARKET_REGION = 'global';
    const create = jest.fn();
    const service = new ContentService({ content: { create } } as never);
    await expect(service.create('t', 'u', { title: '你好', body: 'Hello desk', content_type: 'article' })).rejects.toMatchObject({
      status: 422,
    });
    expect(create).not.toHaveBeenCalled();
  });

  it('stores an English draft', async () => {
    process.env.MARKET_REGION = 'global';
    const create = jest.fn(async ({ data }: { data: unknown }) => data);
    const service = new ContentService({ content: { create } } as never);
    await service.create('t', 'u', { title: 'Reading desk', body: 'A quiet desk.', content_type: 'article' });
    expect(create).toHaveBeenCalled();
  });

  it('skips one stored Chinese draft so the library response stays English', async () => {
    process.env.MARKET_REGION = 'global';
    const service = new ContentService({
      content: {
        findMany: async () => [{ id: 'c', title: '中文标题', body: '正文', status: 'draft', tags: ['标签'] }],
        count: async () => 1,
      },
    } as never);
    const page = await service.findAll('t', {});
    expect(JSON.stringify(page)).not.toMatch(/[\u3400-\u9fff]/);
    expect(page.contents[0].language_skipped).toBe(true);
    expect(page.contents[0].title).toBe('Skipped non-English draft');
    expect(page.contents).toHaveLength(1);
  });

  it('local stub returns English on the international edition and Chinese on the domestic edition', () => {
    process.env.MARKET_REGION = 'global';
    const english = localStubCompletion('topic: weekend breakfast');
    expect(english.content).toMatch(/Example draft/);
    expect(english.content).not.toMatch(/[\u3400-\u9fff]/);
    process.env.MARKET_REGION = 'cn';
    const chinese = localStubCompletion('主题：周末早餐');
    expect(chinese.content).toContain('本地联调正文');
  });
});
