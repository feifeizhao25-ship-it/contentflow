import { readFileSync } from 'fs';
import { join } from 'path';

describe('international pricing copy', () => {
  it('does not promise official platform API publishing', () => {
    const src = readFileSync(join(__dirname, 'page.tsx'), 'utf8');
    expect(src).not.toMatch(/Every plan publishes through official platform APIs/);
    expect(src).toMatch(/No plan publishes through an official platform API yet/);
    expect(src).not.toMatch(/[\u3400-\u9fff]/);
  });
});
