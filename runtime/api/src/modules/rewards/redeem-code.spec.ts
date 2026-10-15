import * as fs from 'fs';
import * as path from 'path';

describe('兑换码生成', () => {
  const src = fs.readFileSync(path.join(__dirname, 'rewards.service.ts'), 'utf8');
  it('不使用 Math.random，改用 crypto.randomInt', () => {
    expect(src).not.toMatch(/Math\.random/);
    expect(src).toMatch(/import \{ randomInt \} from 'crypto'/);
  });
  it('格式仍为 FX-XXXX-XXXX', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { RewardsService } = require('./rewards.service');
    const svc = Object.create(RewardsService.prototype);
    const codes = new Set(Array.from({ length: 200 }, () => svc.generateRedeemCode()));
    for (const c of codes) expect(c).toMatch(/^FX-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    expect(codes.size).toBe(200);
  });
});
