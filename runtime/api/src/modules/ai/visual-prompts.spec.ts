import { splitArticleAndVisualPrompts } from './visual-prompts';

describe('splitArticleAndVisualPrompts', () => {
  const article = 'A great hook.\n\nUseful body.\n\nFollow us for more.';

  it('keeps all three prompts and drops the heading line (the old parser returned the heading and lost the third prompt)', () => {
    const raw = `${article}\n\n---\n\n**Visual Prompts**\n\n1. A minimalist desk setup with warm lamp light, wide shot\n2. Close-up of a mechanical keyboard on a wooden desk, soft focus\n3. Flat lay of cable organizers and a laptop stand, top-down view`;
    const out = splitArticleAndVisualPrompts(raw);
    expect(out.content).toBe(article);
    expect(out.visualPrompts).toEqual([
      'A minimalist desk setup with warm lamp light, wide shot',
      'Close-up of a mechanical keyboard on a wooden desk, soft focus',
      'Flat lay of cable organizers and a laptop stand, top-down view',
    ]);
  });

  it('works with a plain divider and no heading (the format the prompt actually asks for)', () => {
    const raw = `${article}\n---\nA cozy reading corner with a lamp and a blanket\nA bright desk with plants and a notebook\nA flat lay of skincare bottles on marble`;
    const out = splitArticleAndVisualPrompts(raw);
    expect(out.content).toBe(article);
    expect(out.visualPrompts).toHaveLength(3);
  });

  it('strips labels, bullets and quotes; ignores links', () => {
    const raw = `${article}\n\nVisual Prompts:\n- Prompt 1: "A sunlit studio with a ring light and a tripod"\n- https://example.com/ref.png\n- **Prompt 2:** A close-up of hands applying foundation, soft light`;
    const out = splitArticleAndVisualPrompts(raw);
    expect(out.visualPrompts).toEqual([
      'A sunlit studio with a ring light and a tripod',
      'A close-up of hands applying foundation, soft light',
    ]);
  });

  it('does not treat an ordinary horizontal rule inside the article as a prompt block', () => {
    const raw = 'Intro paragraph.\n\n---\n\nSection two has a lot more to say about the topic at hand.\n\nAnd a long closing paragraph that is not a prompt list at all, just prose.';
    const out = splitArticleAndVisualPrompts(raw);
    expect(out.visualPrompts).toEqual([]);
    expect(out.content).toBe(raw);
  });

  it('caps at three and de-duplicates', () => {
    const raw = `${article}\n\nVisual Prompts\n1. A mountain lake at sunrise with mist\n2. A mountain lake at sunrise with mist\n3. A city skyline at night with light trails\n4. A quiet street cafe in the morning rain\n5. A rooftop garden with string lights at dusk`;
    expect(splitArticleAndVisualPrompts(raw).visualPrompts).toHaveLength(3);
  });

  it('returns the text untouched when there is no block', () => {
    expect(splitArticleAndVisualPrompts(article)).toEqual({ content: article, visualPrompts: [] });
    expect(splitArticleAndVisualPrompts('')).toEqual({ content: '', visualPrompts: [] });
  });
});
