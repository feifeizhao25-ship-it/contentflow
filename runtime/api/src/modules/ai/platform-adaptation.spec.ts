import { adaptBodyForPlatform, adaptForPlatforms } from './platform-adaptation';
describe('platform-adaptation（批2 正文逐平台改写）', () => {
  const body = 'AI 生成：本文由人工智能生成\n第一段讲结论。\n第二段讲细节，内容比较长需要展开说明。';
  it('抖音压缩为口播长度且保留AI标识', () => {
    const v = adaptBodyForPlatform(body, 'douyin', '效率');
    expect(v.body).toContain('AI 生成'); expect(v.char_count).toBeLessThanOrEqual(320 + 20); expect(v.hashtags).toContain('#效率');
  });
  it('公众号保留长文分段、无话题标签堆叠', () => {
    const v = adaptBodyForPlatform(body, 'wechat_mp', '效率');
    expect(v.body).toContain('\n\n'); expect(v.hashtags).toEqual([]);
  });
  it('多平台输出各一份且平台不重复', () => {
    expect(adaptForPlatforms(body, ['xhs', 'xhs', 'weibo']).map(v=>v.platform)).toEqual(['xhs','weibo']);
  });
});
