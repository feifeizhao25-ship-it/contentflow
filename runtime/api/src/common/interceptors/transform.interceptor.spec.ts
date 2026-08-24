import { of, lastValueFrom } from 'rxjs';
import { InternalServerErrorException } from '@nestjs/common';
import { containsCjk, TransformInterceptor } from './transform.interceptor';

const context = {
  switchToHttp: () => ({
    getRequest: () => ({ url: '/api/v1/test' }),
  }),
} as any;

describe('TransformInterceptor global language contract', () => {
  const previousRegion = process.env.MARKET_REGION;

  afterEach(() => {
    process.env.MARKET_REGION = previousRegion;
  });

  it('recursively detects CJK in keys and values', () => {
    expect(containsCjk({ nested: ['English', { message: '进度已更新' }] })).toBe(true);
    expect(containsCjk({ nested: ['English only'] })).toBe(false);
    expect(containsCjk({ 中文键: 'English value' })).toBe(true);
  });

  it('passes English global responses', async () => {
    process.env.MARKET_REGION = 'global';
    const result = await lastValueFrom(
      new TransformInterceptor().intercept(context, { handle: () => of({ message: 'Progress updated' }) }),
    );
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ message: 'Progress updated' });
  });

  it('fails closed before a global response can expose CJK', async () => {
    process.env.MARKET_REGION = 'global';
    await expect(lastValueFrom(
      new TransformInterceptor().intercept(context, { handle: () => of({ message: '进度已更新' }) }),
    )).rejects.toBeInstanceOf(InternalServerErrorException);
  });

  it('preserves domestic responses', async () => {
    process.env.MARKET_REGION = 'cn';
    const result = await lastValueFrom(
      new TransformInterceptor().intercept(context, { handle: () => of({ message: '进度已更新' }) }),
    );
    expect(result.data).toEqual({ message: '进度已更新' });
  });
});
