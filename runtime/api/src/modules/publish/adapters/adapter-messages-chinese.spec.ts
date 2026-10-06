import * as fs from 'fs';
import * as path from 'path';
import { BilibiliAdapter } from './bilibili.adapter';

/**
 * 适配器给前端的 humanMessage 必须是纯中文（审计第 1、4 点）：
 * 原来 B 站校验写「标题是必填项 (Title is required)」「请选择分区 (Missing TID)」。
 * 允许平台名里的单个字母（如「B 站」），不允许两个以上连续的英文字母。
 */
describe('发布适配器的人话提示是纯中文', () => {
  const dir = __dirname;
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.adapter.ts'));

  it.each(files)('%s：humanMessage 里没有英文单词', (file) => {
    const src = fs.readFileSync(path.join(dir, file), 'utf8');
    const messages = [...src.matchAll(/humanMessage:\s*(['`])([^'`]*)\1/g)].map((m) => m[2]);
    expect(messages.length).toBeGreaterThan(0);
    for (const message of messages) {
      expect(message).toMatch(/[㐀-鿿]/);
      expect(message).not.toMatch(/[A-Za-z]{2,}/);
    }
  });

  it('B 站：缺标题、缺分区的提示是纯中文', async () => {
    const adapter = new BilibiliAdapter();
    const noTitle = await adapter.validate({ title: '', content: '', mediaUrls: ['v.mp4'], extra: { tid: 1 } } as any);
    expect(noTitle.humanMessage).toBe('请填写标题');
    const noTid = await adapter.validate({ title: '标题', content: '', mediaUrls: ['v.mp4'], extra: {} } as any);
    expect(noTid.humanMessage).toBe('请选择 B 站投稿分区');
  });
});
