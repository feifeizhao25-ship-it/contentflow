import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, timingSafeEqual } from 'crypto';
import { READONLY_TOKEN_ENV } from './weekly-funnel';

/**
 * 只读漏斗令牌：只挂在全站每周漏斗这一条 GET 上。它不是登录令牌，别的接口（都走 JwtAuthGuard）不认它。
 * 环境变量 FENFAXIA_FUNNEL_READONLY_TOKEN 没设或为空 = 关闭。比较 SHA-256 摘要，常量时间、不受长度影响。
 */
export function readonlyTokenMatches(supplied: string, env: Record<string, string | undefined> = process.env): boolean {
  const expected = env[READONLY_TOKEN_ENV] ?? '';
  if (!supplied || !expected) return false;
  const a = createHash('sha256').update(supplied).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

function bearer(header: unknown): string {
  if (typeof header !== 'string') return '';
  const [scheme, ...rest] = header.trim().split(/\s+/);
  return scheme?.toLowerCase() === 'bearer' ? rest.join(' ').trim() : '';
}

@Injectable()
export class ReadonlyFunnelTokenGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    if (request.method !== 'GET') throw new ForbiddenException('只读令牌只能读取');
    const token = bearer(request.headers?.authorization);
    if (!token) throw new UnauthorizedException('需要只读令牌');
    if (!readonlyTokenMatches(token)) throw new ForbiddenException('令牌无效或只读入口未开启');
    return true;
  }
}
