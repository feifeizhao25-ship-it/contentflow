import { packRows, signalRows } from './workspace-records';

const overview = {
  week: { publish: { total: 2, published: 1 }, ai: { byType: [{ type: 'article', label: 'Articles', count: 3 }, { type: 'content_pack', label: 'Content packs', count: 1 }] } },
  month: { publish: { total: 5, published: 4 }, ai: { byType: [{ type: 'article', label: 'Articles', count: 9 }, { type: 'content_pack', label: 'Content packs', count: 2 }] } },
  engagement: { detail: 'Views, likes, comments and follower growth can only be read through each platform\'s official API.' },
};

// 2026-11-21 test: Signals showed hard-coded "72% / 4.8% / 8.1% / 11" and Packs three made-up packs.
describe('signals and packs show stored records only (2026-11-22)', () => {
  it('signals lists stored counts per type, week and month', () => {
    const view = signalRows(overview);
    expect(view.rows).toEqual([
      ['Articles', '3', '9'],
      ['Content packs', '1', '2'],
      ['Publish tasks', '2', '5'],
      ['Published', '1', '4'],
    ]);
    expect(JSON.stringify(view)).not.toMatch(/72%|4\.8%|8\.1%|Completion rate|Qualified clicks/);
  });

  it('an empty workspace shows zeros and says nothing is a sample', () => {
    const view = packRows({ week: { ai: { byType: [] } }, month: { ai: { byType: [] } } });
    expect(view.rows).toEqual([['Content packs generated', '0', '0']]);
    expect(view.notes[0]).toMatch(/Nothing here is a sample/);
    expect(JSON.stringify(view)).not.toMatch(/Product launch|Founder narrative|7 drafts/);
  });

  it('packs counts the stored content_pack generations', () => {
    expect(packRows(overview).rows).toEqual([['Content packs generated', '1', '2']]);
  });
});
