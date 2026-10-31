import { of, lastValueFrom } from 'rxjs';
import { TransformInterceptor } from './interceptors/transform.interceptor';
import { languageGuardSnapshot, normalizePath, resetLanguageGuard } from './language-guard';

const ctx = (method: string, url = '/api/v1/ai/generate/article?x=1') =>
  ({ switchToHttp: () => ({ getRequest: () => ({ url, method }) }) }) as any;

describe('international CJK counter', () => {
  const prev = process.env.MARKET_REGION;
  beforeEach(() => { process.env.MARKET_REGION = 'global'; resetLanguageGuard(); });
  afterEach(() => { process.env.MARKET_REGION = prev; });

  it('counts checks and leaks by path (ids collapsed, query dropped), never the body', async () => {
    await lastValueFrom(new TransformInterceptor().intercept(ctx('GET'), { handle: () => of({ a: 'fine' }) }));
    await lastValueFrom(new TransformInterceptor().intercept(ctx('POST'), { handle: () => of({ a: '中文泄漏' }) })).catch(() => undefined);
    const snap = languageGuardSnapshot();
    expect(snap.checked).toBe(2);
    expect(snap.cjkLeaks).toBe(1);
    expect(snap.refused).toBe(1);
    expect(snap.byPath).toEqual({ '/api/v1/ai/generate/article': 1 });
    expect(JSON.stringify(snap)).not.toContain('中文');
  });

  it('counts a read that recovers on retry', async () => {
    const answers: any[] = [{ a: '中文' }, { a: 'English' }];
    await lastValueFrom(new TransformInterceptor().intercept(ctx('GET', '/api/v1/content/0b2f6c1e-8d5a-4c0e-9b1a-3f2d1c0b9a87'), { handle: () => of(answers.shift()) }));
    const snap = languageGuardSnapshot();
    expect(snap.cjkLeaks).toBe(1);
    expect(snap.recoveredByRetry).toBe(1);
    expect(snap.refused).toBe(0);
    expect(Object.keys(snap.byPath)).toEqual(['/api/v1/content/:id']);
  });

  it('does not count anything for the domestic edition', async () => {
    process.env.MARKET_REGION = 'cn';
    await lastValueFrom(new TransformInterceptor().intercept(ctx('GET'), { handle: () => of({ a: '中文' }) }));
    expect(languageGuardSnapshot().checked).toBe(0);
  });

  it('normalizePath collapses numeric ids', () => {
    expect(normalizePath('/a/12/b')).toBe('/a/:n/b');
  });
});
