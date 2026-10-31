import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  BadGatewayException,
} from '@nestjs/common';
import { Observable, of, throwError } from 'rxjs';
import { map, mergeMap } from 'rxjs/operators';
import { Request } from 'express';

export interface Response<T> {
  success: boolean;
  data: T;
  meta?: {
    timestamp: string;
    path: string;
    version: string;
  };
}

export function containsCjk(value: unknown): boolean {
  if (typeof value === 'string') return /[\u3400-\u9fff]/.test(value);
  if (Array.isArray(value)) return value.some(containsCjk);
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).some(
      ([key, item]) => /[\u3400-\u9fff]/.test(key) || containsCjk(item),
    );
  }
  return false;
}

/** 502, not 500: the server is fine, the upstream content did not meet the English-only contract. */
function languageContractError() {
  return new BadGatewayException({
    message: 'The response could not be produced in English. Please try again.',
    error: 'GLOBAL_ENGLISH_CONTRACT',
  });
}

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, Response<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<Response<T>> {
    const request = context.switchToHttp().getRequest<Request>();
    
    const wrap = (data: T): Response<T> => ({
      success: true,
      data,
      meta: { timestamp: new Date().toISOString(), path: request.url, version: 'v1' },
    });
    const leaks = (data: unknown) => process.env.MARKET_REGION === 'global' && containsCjk(data);
    // Re-running a handler repeats its side effects, so only reads are retried here. Generation
    // endpoints get their retry (once, in English) inside AIService.generateTextForMarket.
    const canRetry = ['GET', 'HEAD'].includes(String(request.method || '').toUpperCase());

    return next.handle().pipe(
      mergeMap((data) => {
        if (!leaks(data)) return of(wrap(data));
        if (!canRetry) return throwError(() => languageContractError());
        return next.handle().pipe(
          mergeMap((again) => (leaks(again) ? throwError(() => languageContractError()) : of(wrap(again)))),
        );
      }),
    );
  }
}
