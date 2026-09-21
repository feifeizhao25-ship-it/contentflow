import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../database/prisma.service';

export interface JwtPayload {
  sub: string;
  email: string;
  tenantId: string;
  role: string;
  type?: string;
  iat?: number;
  exp?: number;
}

/** 控制器从 req.user 里读到的身份。`id` 与 `sub` 相同：两种写法在控制器里都有。 */
export interface AuthenticatedUser {
  id: string;
  sub: string;
  email: string;
  tenantId: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  /**
   * 两处修正（2026-09-21）：
   *
   * 1. 原来只返回 `{ sub, email, tenantId, role }`，而积分、任务、兑换、成就、竞品、
   *    成长、游戏化 7 个模块的控制器读的是 `req.user.id` —— 永远 undefined。
   *    Prisma 把 `where: { user_id: undefined }` 当成「不过滤」：
   *    积分流水、任务进度、兑换记录（含兑换码）**返回的是所有用户的**；
   *    按用户建记录的写操作则直接报错。
   *
   * 2. 访问令牌有效期 7 天，原来验签后不再看数据库：账号被停用、被移出工作区、
   *    被降级后，旧令牌 7 天内照常可用。现在每次请求确认账号仍是 active，
   *    并以数据库里当前的工作区与角色为准。
   */
  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    if (!payload?.sub || payload.type === 'refresh') {
      throw new UnauthorizedException('Invalid token payload');
    }
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, tenant_id: true, role: true, status: true },
    });
    if (!user || user.status !== 'active') {
      throw new UnauthorizedException('登录状态已失效，请重新登录');
    }
    return {
      id: user.id,
      sub: user.id,
      email: user.email,
      tenantId: user.tenant_id,
      role: user.role,
    };
  }
}
