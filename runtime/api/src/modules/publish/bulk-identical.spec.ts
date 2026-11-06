import { adaptBodyForPlatform, adaptForPlatforms } from '../ai/platform-adaptation';
import { bulkPublishBlockReason, identicalPayloadGroups, normalizePublishPayload } from './bulk-identical';

describe('批量同质化发布拦截', () => {
  const prev = process.env.MARKET_REGION;
  afterEach(() => {
    if (prev === undefined) delete process.env.MARKET_REGION;
    else process.env.MARKET_REGION = prev;
  });

  it('单个目的地不拦截', () => {
    expect(bulkPublishBlockReason([{ key: 'a', body: '同一稿' }], false, 'cn')).toBeNull();
  });

  it('多个目的地没有人工确认时拦住，即使正文已经不同', () => {
    const reason = bulkPublishBlockReason(
      [{ key: 'xhs', body: '小红书版本' }, { key: 'douyin', body: '抖音版本' }],
      false,
      'cn',
    );
    expect(reason).toMatch(/确认/);
    expect(bulkPublishBlockReason(
      [{ key: 'x', body: 'one' }, { key: 'y', body: 'two' }],
      false,
      'global',
    )).toMatch(/confirm/i);
  });

  it('人工确认后，同一稿仍然拦住；按平台改写后的不同正文可以通过', () => {
    delete process.env.MARKET_REGION;
    const same = bulkPublishBlockReason(
      [{ key: 'bilibili:a', body: '同一稿' }, { key: 'bilibili:b', body: '同一稿' }],
      true,
      'cn',
    );
    expect(same).toContain('同一稿');
    const variants = adaptForPlatforms('第一段。\n第二段讲一个具体做法。', ['wechat_mp', 'zhihu', 'xhs'], '选题');
    const items = variants.map((v) => ({ key: v.platform, body: v.body }));
    expect(identicalPayloadGroups(items)).toEqual([]);
    expect(bulkPublishBlockReason(items, true, 'cn')).toBeNull();
    expect(normalizePublishPayload('a\n\nb')).toBe('a b');
  });

  it('公众号和知乎不再输出同一稿', () => {
    delete process.env.MARKET_REGION;
    const mp = adaptBodyForPlatform('一段说明。', 'wechat_mp', '');
    const zh = adaptBodyForPlatform('一段说明。', 'zhihu', '');
    expect(mp.body).not.toBe(zh.body);
    expect(mp.body).toContain('公众号');
    expect(zh.body).toContain('知乎');
  });
});
