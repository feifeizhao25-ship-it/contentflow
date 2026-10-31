import { defaultTenantSettings, defaultWorkspaceName, hasCjk } from './market-text';

describe('sign-up workspace defaults', () => {
  const global = { MARKET_REGION: 'global' } as NodeJS.ProcessEnv;
  const cn = { MARKET_REGION: 'cn' } as NodeJS.ProcessEnv;

  it('international edition: English workspace name and settings, no Chinese text', () => {
    expect(defaultWorkspaceName('Fix Two', global)).toBe("Fix Two's workspace");
    expect(defaultWorkspaceName('', global)).toBe('My workspace');
    expect(defaultWorkspaceName(undefined, global)).toBe('My workspace');
    expect(hasCjk(JSON.stringify(defaultTenantSettings(global)))).toBe(false);
    expect(defaultTenantSettings(global)).toMatchObject({ language: 'en-US' });
  });

  it('domestic edition keeps its Chinese names and the column default settings', () => {
    expect(defaultWorkspaceName('小李', cn)).toBe('小李的工作室');
    expect(defaultWorkspaceName(undefined, cn)).toBe('我的工作室');
    expect(defaultTenantSettings(cn)).toBeNull();
  });
});
