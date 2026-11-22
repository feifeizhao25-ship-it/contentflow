import { findUnsuppliedPromoClaims, promoPromptLine } from './promo-claims';

// Excerpt of the 2026-11-21 content pack (ev/api_r2/contentflow_global/r2gl_Jake_US_coffee/08_content_pack.json).
const PACK_EXCERPT = [
  '## [OPENING — 0:00–0:10]',
  'Our pumpkin spice cold brew lands this weekend, while supplies last. You can grab it at the counter or order ahead.',
  '**Scarcity language:** "While supplies last" is included so the script does not promise unlimited stock.',
  '## Pre-publication checklist',
  '- [ ] No pricing, discount, or promotion claims added without approval',
  '- [ ] Limited stock wording confirmed with the shop',
].join('\n');
const TOPIC = 'Our coffee shop launches a pumpkin spice cold brew this weekend';

describe('findUnsuppliedPromoClaims (2026-11-22)', () => {
  it('flags the invented "while supplies last" from the 11-21 coffee pack', () => {
    const found = findUnsuppliedPromoClaims(PACK_EXCERPT, TOPIC);
    expect(found.map((f) => f.toLowerCase())).toEqual(['while supplies last']);
  });

  it('does not flag wording on checklist lines or after a negation', () => {
    expect(findUnsuppliedPromoClaims('- [ ] Limited stock wording checked\nDo not say 20% off here.', TOPIC)).toEqual([]);
    expect(findUnsuppliedPromoClaims('发布前请删除：不要写「买一送一」。', '新品上市')).toEqual([]);
  });

  it('accepts a promotion the user supplied, in other words too', () => {
    expect(findUnsuppliedPromoClaims('Limited stock — first 50 customers only.', 'Launch: only 50 cups, until they are gone')).toEqual([]);
    expect(findUnsuppliedPromoClaims('Get 20% off today only!', 'Weekend sale: 20% off, limited-time')).toEqual([]);
    expect(findUnsuppliedPromoClaims('第二杯半价，限时三天', '周末活动：第二杯半价，限时 3 天')).toEqual([]);
  });

  it('flags English discount, free and deadline wording the user never gave', () => {
    const found = findUnsuppliedPromoClaims('Act now: 20% off, free delivery and a limited-time offer!', 'New autumn menu');
    expect(found).toEqual(expect.arrayContaining(['20% off', 'free delivery', 'limited-time offer']));
  });

  it('flags Chinese promotions the user never gave', () => {
    const found = findUnsuppliedPromoClaims('新品限量供应，售完即止！进店买一送一，还能免费续杯。', '我们店周末上新南瓜冷萃');
    expect(found).toEqual(expect.arrayContaining(['限量供应', '售完即止', '买一送一', '免费续杯']));
  });

  it('returns nothing for plain copy', () => {
    expect(findUnsuppliedPromoClaims('A cosy autumn drink, made fresh every morning.', TOPIC)).toEqual([]);
  });

  it('prompt line tells the model not to add promotions', () => {
    expect(promoPromptLine(true)).toMatch(/while supplies last/);
    expect(promoPromptLine(false)).toMatch(/售完即止/);
  });
});
