import { PRE_PUBLISH_CHECKLIST, prePublishChecklist } from './pre-publish-checklist';

describe('发布前核对清单', () => {
  it('包含 AI生成内容标识', () => {
    const labels = prePublishChecklist().map((item) => item.label);
    expect(labels).toContain('AI生成内容标识');
    expect(PRE_PUBLISH_CHECKLIST.some((item) => item.id === 'ai-generated-label')).toBe(true);
  });
});
