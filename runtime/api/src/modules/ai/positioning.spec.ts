import { buildPositioning } from './positioning';

describe('account positioning', () => {
  it('adds nothing and says so when the account has no persona text and no scored titles', () => {
    const r = buildPositioning({ persona: { name: 'Empty', config: {} }, topTitles: [{ title: null, viral_score: 5 }, { title: 'x', viral_score: null }] }, true);
    expect(r.promptBlock).toBe('');
    expect(r.used).toEqual({ persona: false, personaName: null, topTitles: 0 });
  });

  it('uses persona text and the best titles as reference only', () => {
    const r = buildPositioning({
      persona: { name: 'Desk nerd', description: 'Minimalist desk setups', config: { niche: 'home office', tone: 'dry humour', ignored: 'x' } },
      topTitles: [{ title: 'My $500 desk', viral_score: 91 }, { title: 'Cable tips', viral_score: 80 }],
    }, true);
    expect(r.promptBlock).toContain('Desk nerd');
    expect(r.promptBlock).toContain('niche: home office');
    expect(r.promptBlock).not.toContain('ignored');
    expect(r.promptBlock).toContain('"My $500 desk" (91)');
    expect(r.promptBlock).toMatch(/Do not copy these titles/);
    expect(r.used).toEqual({ persona: true, personaName: 'Desk nerd', topTitles: 2 });
  });

  it('domestic block is Chinese and caps long text', () => {
    const r = buildPositioning({ persona: { name: '知识号', description: 'x'.repeat(1000), config: {} }, topTitles: [] }, false);
    expect(r.promptBlock).toContain('账号定位');
    expect(r.promptBlock.length).toBeLessThan(600);
  });
});
