import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  InternalServerErrorException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
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

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, Response<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<Response<T>> {
    const request = context.switchToHttp().getRequest<Request>();
    
    return next.handle().pipe(
      map((data) => {
        if (process.env.MARKET_REGION === 'global' && containsCjk(data)) {
          throw new InternalServerErrorException(
            'The response failed the global English-only contract',
          );
        }
        return {
          success: true,
          data,
          meta: { timestamp: new Date().toISOString(), path: request.url, version: 'v1' },
        };
      }),
    );
  }
}
