import { renderToStaticMarkup } from 'react-dom/server';
import Privacy from './privacy/page';
import Terms from './terms/page';

describe('international legal pages', () => {
  it.each([['privacy', Privacy], ['terms', Terms]])('%s renders English-only content with a date', (_n, Page) => {
    const html = renderToStaticMarkup(<Page />);
    expect(html).toMatch(/Last updated: 2026-10-16/);
    expect(html).not.toMatch(/[\u4e00-\u9fff]/);
  });
});
