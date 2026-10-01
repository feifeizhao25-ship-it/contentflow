/**
 * 平台适配器尚未接入开放平台（外部资质）：必须明确失败，且给用户的话是中文、不指向做不到的操作。
 * 原来的提示是「请先在『账号管理』中完成授权」——但授权入口同样尚未开放，用户会在两个页面之间打转。
 */
import { BilibiliAdapter } from './bilibili.adapter';
import { DouyinAdapter } from './douyin.adapter';

const payload: any = { contentId: 'c1', accountId: 'a1', title: 't', body: 'b', mediaUrls: [] };

describe.each([
  ['bilibili', () => new BilibiliAdapter()],
  ['douyin', () => new DouyinAdapter()],
])('%s 适配器（未接入）', (_name, make) => {
  it('isLive=false，所有操作明确失败（绝不返回已发布）', async () => {
    const adapter: any = make();
    expect(adapter.isLive).toBe(false);
    const results = [await adapter.createPost(payload), await adapter.queryStatus('a1', 'x')];
    if (adapter.uploadMedia) results.push(await adapter.uploadMedia(payload));
    for (const r of results) {
      expect(r.ok).toBe(false);
      expect(r.errorCode).toBe('ADAPTER_NOT_INTEGRATED');
      expect(r.humanMessage).toMatch(/[一-鿿]/);
      expect(r.humanMessage).toContain('尚未开通');
      // 不把用户指向同样做不到的「去账号管理授权」
      expect(r.humanMessage).not.toContain('账号管理');
    }
  });
});
