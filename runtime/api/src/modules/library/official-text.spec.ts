import { readFileSync } from 'fs';
import { join } from 'path';
import { admitPlatformRule, applyPlatformRule } from './official-text';

const MEDIA = {
  id: 'cf-xhs-ai-governance',
  title: '小红书 AI 内容治理规则（媒体转述）',
  url: 'https://news.qq.com/rain/a/20260427A05JSU00',
  platform: '小红书',
  text_kind: 'media' as const,
};

describe('平台规则需有官方原文', () => {
  const library = [{ id: 'cf-rule-001', title: '已有条目' }];

  it('没有官方原文的媒体转述只能是候选，规则库不变', () => {
    const admission = admitPlatformRule(MEDIA);
    expect(admission.destination).toBe('candidate');
    expect(admission.reviewer).toBe('');
    expect(admission.named_reviewer).toBeNull();
    expect(admission.auto_published).toBe(false);
    expect(admission.review_status).toBe('待审核');
    const applied = applyPlatformRule(library, MEDIA);
    expect(applied.entries.map((entry) => entry.id)).toEqual(['cf-rule-001']);
    expect(applied.admission.reason).toContain('官方原文');
  });

  it('贴了转述文字但没有标明官方原文，仍然是候选', () => {
    const applied = applyPlatformRule(library, {
      ...MEDIA,
      official_text: '笔记发布须勾选含AI合成内容',
      text_kind: 'paraphrase',
    });
    expect(applied.admission.destination).toBe('candidate');
    expect(applied.entries).toHaveLength(1);
  });

  it('媒体站点即使自称官方原文也不能进规则库', () => {
    const applied = applyPlatformRule(library, {
      ...MEDIA,
      official_text: '这是新闻稿里的句子，不是平台页面原文。',
      text_kind: 'official',
    });
    expect(applied.admission.destination).toBe('candidate');
    expect(applied.admission.reason).toContain('不是平台官方页面');
  });

  it('带官方原文的 https 页面可以进规则库，但仍待审核且不发布', () => {
    const applied = applyPlatformRule(library, {
      id: 'cf-platform-official-fixture',
      title: '平台页面原文（测试夹具）',
      url: 'https://agree.xiaohongshu.com/h5/terms/ZXXY20220331001/-1',
      platform: '小红书',
      text_kind: 'official',
      official_text: '测试夹具：此处应替换为平台页面上的原句。',
    });
    expect(applied.admission.destination).toBe('library');
    expect(applied.entries).toHaveLength(2);
    const added = applied.entries[1] as { reviewer: string; review_status: string; visible: boolean; auto_published: boolean; points: string[] };
    expect(added.reviewer).toBe('');
    expect(added.review_status).toBe('待审核');
    expect(added.visible).toBe(false);
    expect(added.auto_published).toBe(false);
    expect(added.points[0]).toContain('测试夹具');
  });

  it('生产规则库没有把这条媒体转述写进去', () => {
    const raw = readFileSync(join(__dirname, 'data', 'rule-library.json'), 'utf8');
    expect(raw).not.toContain('news.qq.com');
    expect(raw).not.toContain('cf-xhs-ai-governance');
  });
});
