import { CallHandler, ExecutionContext, HttpException, HttpStatus, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, defer } from 'rxjs';
import { finalize } from 'rxjs/operators';

export const AI_CONCURRENCY_MESSAGE = '上一条 AI 生成还在进行中，请稍候再试';

/**
 * 每个租户同时在跑的 AI 生成数上限。
 *
 * 额度是「先查剩余、生成完再记账」：查和记之间隔着一次几秒到几十秒的模型调用。
 * 原来同一租户并发打 N 个请求，N 个都会通过额度检查，月度额度可被超用 N 倍。
 * 这里把同一租户的并发生成数压到 AI_MAX_CONCURRENT_PER_TENANT（默认 2），超出直接 429。
 * 单实例内生效；多实例部署时每个实例各自计数，仍能把超用上限压到「实例数 × 上限」。
 */
@Injectable()
export class AiConcurrencyInterceptor implements NestInterceptor {
  static readonly inFlight = new Map<string, number>();

  private limit(): number {
    const n = Number(process.env.AI_MAX_CONCURRENT_PER_TENANT);
    return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 2;
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const tenantId: string | undefined = req?.user?.tenantId;
    if (!tenantId || String(req?.method || '').toUpperCase() !== 'POST') return next.handle();

    const map = AiConcurrencyInterceptor.inFlight;
    const current = map.get(tenantId) ?? 0;
    if (current >= this.limit()) {
      throw new HttpException({ message: AI_CONCURRENCY_MESSAGE, error: 'AI_CONCURRENCY_LIMIT' }, HttpStatus.TOO_MANY_REQUESTS);
    }
    map.set(tenantId, current + 1);
    return defer(() => next.handle()).pipe(
      finalize(() => {
        const left = (map.get(tenantId) ?? 1) - 1;
        if (left <= 0) map.delete(tenantId);
        else map.set(tenantId, left);
      }),
    );
  }
}
