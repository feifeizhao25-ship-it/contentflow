import { checkMicroDramaBeforePublish, MicroDramaPublishInput } from './micro-drama';

const base: MicroDramaPublishInput = {
  title: '示例剧',
  category: 'class3',
  programNo: 'P-0001',
  openingShowsTitleAndNumber: true,
  creditsOnFirstOpeningOrLastEnding: true,
  usesAiGeneration: false,
  episodes: [
    { number: 1, minutes: 3 },
    { number: 2, minutes: 2.5 },
  ],
};
const codes = (input: MicroDramaPublishInput) => checkMicroDramaBeforePublish(input).issues.map((i) => i.code);

describe('微短剧发布前检查', () => {
  it('材料齐全的三类微短剧通过', () => {
    expect(checkMicroDramaBeforePublish(base)).toEqual({ ok: true, issues: [] });
  });

  it('各类别需要各自的许可或编号', () => {
    expect(codes({ ...base, category: 'class1', licenseNo: '' })).toEqual(['license_missing']);
    expect(codes({ ...base, category: 'class1', licenseNo: 'L-1' })).toEqual([]);
    expect(codes({ ...base, category: 'class2', approvalNo: undefined })).toEqual(['approval_missing']);
    expect(codes({ ...base, category: 'class2', approvalNo: 'A-1' })).toEqual([]);
    expect(codes({ ...base, category: 'class3', programNo: '  ' })).toEqual(['program_number_missing']);
  });

  it('类别由调用方提供，缺失时不猜', () => {
    expect(codes({ ...base, category: null })).toEqual(['category_unknown']);
    expect(codes({ ...base, category: undefined })).toEqual(['category_unknown']);
  });

  it('单集 20 分钟及以上不属于微短剧', () => {
    const result = checkMicroDramaBeforePublish({ ...base, episodes: [{ number: 1, minutes: 19.9 }, { number: 2, minutes: 20 }] });
    expect(result.issues.map((i) => [i.code, i.episode])).toEqual([['episode_too_long', 2]]);
  });

  it('片头标注与署名', () => {
    expect(codes({ ...base, openingShowsTitleAndNumber: false })).toEqual(['opening_info_missing']);
    expect(codes({ ...base, title: ' ' })).toEqual(['opening_info_missing']);
    expect(codes({ ...base, creditsOnFirstOpeningOrLastEnding: false })).toEqual(['credits_missing']);
  });

  it('AI 生成的微短剧每一集都要有提示标识', () => {
    const ai = { ...base, usesAiGeneration: true, episodes: [{ number: 1, minutes: 3, hasAiLabel: true }, { number: 2, minutes: 3 }] };
    const result = checkMicroDramaBeforePublish(ai);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]).toMatchObject({ code: 'ai_label_missing_episode', episode: 2 });
    expect(checkMicroDramaBeforePublish({ ...ai, episodes: ai.episodes.map((e) => ({ ...e, hasAiLabel: true })) }).ok).toBe(true);
  });

  it('非 AI 微短剧不要求 AI 标识；每条问题都带出处', () => {
    expect(codes({ ...base, episodes: [{ number: 1, minutes: 3, hasAiLabel: false }] })).toEqual([]);
    for (const issue of checkMicroDramaBeforePublish({ ...base, category: null, creditsOnFirstOpeningOrLastEnding: false }).issues) {
      expect(issue.basis).toContain('《微短剧发展管理办法》');
    }
  });
});
