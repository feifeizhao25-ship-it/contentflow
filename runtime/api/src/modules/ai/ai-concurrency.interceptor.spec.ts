import { HttpException } from '@nestjs/common';
import { Subject, lastValueFrom, of } from 'rxjs';
import { AiConcurrencyInterceptor, AI_CONCURRENCY_MESSAGE } from './ai-concurrency.interceptor';

const ctx = (tenantId: string, method = 'POST') =>
  ({ switchToHttp: () => ({ getRequest: () => ({ method, user: { tenantId } }) }) }) as any;

describe('AiConcurrencyInterceptor', () => {
  beforeEach(() => AiConcurrencyInterceptor.inFlight.clear());

  it('同一租户并发超过上限时 429（中文提示），完成后释放', async () => {
    const i = new AiConcurrencyInterceptor();
    const a = new Subject(); const b = new Subject();
    const s1 = i.intercept(ctx('t1'), { handle: () => a }).subscribe();
    const s2 = i.intercept(ctx('t1'), { handle: () => b }).subscribe();
    let err: any;
    try { i.intercept(ctx('t1'), { handle: () => of(1) }); } catch (e) { err = e; }
    expect(err).toBeInstanceOf(HttpException);
    expect(err.getStatus()).toBe(429);
    expect(JSON.stringify(err.getResponse())).toContain(AI_CONCURRENCY_MESSAGE);
    // 别的租户不受影响
    await expect(lastValueFrom(i.intercept(ctx('t2'), { handle: () => of('ok') }))).resolves.toBe('ok');
    a.complete(); s1.unsubscribe();
    await expect(lastValueFrom(i.intercept(ctx('t1'), { handle: () => of('again') }))).resolves.toBe('again');
    b.complete(); s2.unsubscribe();
    expect(AiConcurrencyInterceptor.inFlight.size).toBe(0);
  });

  it('生成失败也释放名额', async () => {
    const i = new AiConcurrencyInterceptor();
    for (let k = 0; k < 3; k++) {
      await expect(lastValueFrom(i.intercept(ctx('t3'), { handle: () => { throw new Error('boom'); } }))).rejects.toThrow('boom');
    }
    expect(AiConcurrencyInterceptor.inFlight.size).toBe(0);
  });

  it('GET 不计数', async () => {
    const i = new AiConcurrencyInterceptor();
    for (let k = 0; k < 5; k++) await lastValueFrom(i.intercept(ctx('t4', 'GET'), { handle: () => of(1) }));
    expect(AiConcurrencyInterceptor.inFlight.size).toBe(0);
  });
});
