import { readFileSync } from 'fs';
import { join } from 'path';
import { loadClaims, parseClaimsYaml, screenClaim } from './claims';

describe('增长话术库存', () => {
  const claims = loadClaims();

  it('允许句可以通过，禁止句被拦下', () => {
    expect(claims.allowed.map((item) => item.id)).toContain('assist-draft');
    expect(screenClaim(claims.allowed[0].text, claims).ok).toBe(true);
    expect(screenClaim('支持全自动发布全平台', claims).hits).toContain('全自动发布');
    expect(screenClaim('Cookie 登录后自动涨粉', claims).ok).toBe(false);
    expect(screenClaim('养号和矩阵号教程', claims).ok).toBe(false);
  });

  it('库存文件里的允许句不含禁止项', () => {
    const raw = readFileSync(join(__dirname, 'claims.yaml'), 'utf8');
    const parsed = parseClaimsYaml(raw);
    for (const entry of parsed.allowed) {
      expect(screenClaim(entry.text, parsed).ok).toBe(true);
    }
    expect(parsed.forbidden).toEqual(expect.arrayContaining(['全自动发布', '托管运营', '无人值守', '自动涨粉']));
  });
});
