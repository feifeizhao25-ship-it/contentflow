import { of, lastValueFrom } from 'rxjs';
import { BadGatewayException } from '@nestjs/common';
import { containsCjk, TransformInterceptor } from './transform.interceptor';

const contextFor = (method: string) => ({
  switchToHttp: () => ({
    getRequest: () => ({ url: '/api/v1/test', method }),
  }),
}) as any;
const context = contextFor('POST');

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

  it('a POST that would leak CJK is not re-run (side effects) and answers 502 in English, not 500', async () => {
    process.env.MARKET_REGION = 'global';
    const handle = jest.fn(() => of({ message: '进度已更新' }));
    const error: any = await lastValueFrom(
      new TransformInterceptor().intercept(context, { handle }),
    ).catch((e) => e);
    expect(error).toBeInstanceOf(BadGatewayException);
    expect(containsCjk(error.getResponse())).toBe(false);
    expect(handle).toHaveBeenCalledTimes(1);
  });

  it('a GET that leaks CJK is retried once and passes when the second answer is clean', async () => {
    process.env.MARKET_REGION = 'global';
    const answers = [{ message: '进度已更新' }, { message: 'Progress updated' }];
    const handle = jest.fn(() => of(answers.shift()));
    const result = await lastValueFrom(
      new TransformInterceptor().intercept(contextFor('GET'), { handle }),
    );
    expect(result.data).toEqual({ message: 'Progress updated' });
    expect(handle).toHaveBeenCalledTimes(2);
  });

  it('a GET that still leaks CJK after the retry answers 502', async () => {
    process.env.MARKET_REGION = 'global';
    const handle = jest.fn(() => of({ message: '进度已更新' }));
    await expect(lastValueFrom(
      new TransformInterceptor().intercept(contextFor('GET'), { handle }),
    )).rejects.toBeInstanceOf(BadGatewayException);
    expect(handle).toHaveBeenCalledTimes(2);
  });

  it('preserves domestic responses', async () => {
    process.env.MARKET_REGION = 'cn';
    const result = await lastValueFrom(
      new TransformInterceptor().intercept(context, { handle: () => of({ message: '进度已更新' }) }),
    );
    expect(result.data).toEqual({ message: '进度已更新' });
  });
});
