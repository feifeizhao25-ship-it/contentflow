import { readFileSync } from 'fs';
import { join } from 'path';
import { TRAFFIC_SKILLS } from './catalog';
import { renderSkillDraft, runSkillEvals } from './render';

describe('流量技能库', () => {
  it('每个技能有版本、变更记录，并通过固定评测', () => {
    expect(TRAFFIC_SKILLS.length).toBeGreaterThanOrEqual(6);
    for (const skill of TRAFFIC_SKILLS) {
      expect(skill.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(skill.changelog.map((item) => item.version)).toContain(skill.version);
      const dir = join(__dirname, 'library', skill.id);
      expect(readFileSync(join(dir, 'SKILL.md'), 'utf8')).toContain(`version: ${skill.version}`);
      expect(readFileSync(join(dir, 'CHANGELOG.md'), 'utf8')).toContain(skill.version);
      expect(readFileSync(join(dir, 'evals', 'golden.jsonl'), 'utf8')).toContain(skill.id === 'cn-growth-compliance-gate' ? '通过' : '');
      const result = runSkillEvals(skill.id);
      expect(result.failures).toEqual([]);
      expect(result.pass).toBe(true);
    }
  });

  it('用户文案停在人工确认，并带 AIGC 标识', () => {
    const draft = renderSkillDraft('platform-copy', { topic: '秋天的读书笔记', platform: 'zhihu' });
    expect(draft).toMatchObject({ refused: false, status: 'manual_pending' });
    expect(draft.body.startsWith('【本内容由 AI 生成】')).toBe(true);
    expect(draft.body).toContain('知乎');
    expect(draft.body).toContain('人工确认后发布');
    expect(draft.body).not.toContain('全自动发布');
  });

  it('拒绝自动发布、拉踩、未标广告的软文和养号教程', () => {
    expect(renderSkillDraft('topic-selection', { text: '写一段全自动发布小红书的教程' }).refused).toBe(true);
    expect(renderSkillDraft('platform-copy', { text: '写一篇竞品拉踩的文案' }).refused).toBe(true);
    expect(renderSkillDraft('cn-fenfaxia-mp-article-draft', { text: '写一篇未标广告的软文' }).refused).toBe(true);
    expect(renderSkillDraft('cn-fenfaxia-video-script', { text: '教我用 Cookie 登录养号做矩阵号' }).refused).toBe(true);
  });
});
