import { GROUNDING_NOTICE_EN, groundClaims, materialPromptBlock, MATERIAL_MAX_CHARS } from './grounding';

describe('brand-claim grounding to user-supplied material', () => {
  const copy = 'The AQUAPURE bottle keeps drinks cold for 24%  longer and the NOVAGRIP lid is spill-proof.';
  it('without material it behaves like the old unverified-claims check', () => {
    const g = groundClaims(copy, 'water bottle', undefined);
    expect(g.materialSupplied).toBe(false);
    expect(g.supportedByMaterial).toEqual([]);
    expect(g.unverified).toEqual(['24%', 'AQUAPURE', 'NOVAGRIP']);
  });

  it('moves a figure or name into "supported" only when the material contains it', () => {
    const g = groundClaims(copy, 'water bottle', 'AQUAPURE spec sheet: cold retention test showed 24% longer.');
    expect(g.materialSupplied).toBe(true);
    expect(g.supportedByMaterial).toEqual(['24%', 'AQUAPURE']);
    expect(g.unverified).toEqual(['NOVAGRIP']);
  });

  it('treats whitespace-only material as not supplied and caps its length', () => {
    expect(groundClaims(copy, 'x', '   ').materialSupplied).toBe(false);
    const block = materialPromptBlock('a'.repeat(MATERIAL_MAX_CHARS + 500), true);
    expect(block.length).toBeLessThan(MATERIAL_MAX_CHARS + 400);
    expect(materialPromptBlock('', true)).toBe('');
  });

  it('the notice does not claim the material was verified', () => {
    expect(GROUNDING_NOTICE_EN).toMatch(/did not verify the material/);
  });
});
