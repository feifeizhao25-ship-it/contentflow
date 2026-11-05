import { readableDraft } from './readable-draft';

describe('readableDraft', () => {
  it('removes heading markers, bold/underline emphasis and ++ markers but keeps the words', () => {
    const out = readableDraft('### The Importance of Consistency\n\n1. ++Time Management++: plan **ahead**.\n## Conclusion');
    expect(out).toBe('The Importance of Consistency\n\n1. Time Management: plan ahead.\nConclusion');
  });
  it('turns bullet markers into a bullet and keeps numbers, hashtags and arithmetic', () => {
    expect(readableDraft('- first\n* second\n#growth is 3*4=12 and 2+2')).toBe('• first\n• second\n#growth is 3*4=12 and 2+2');
  });
  it('is safe on empty input', () => {
    expect(readableDraft('')).toBe('');
  });
});
