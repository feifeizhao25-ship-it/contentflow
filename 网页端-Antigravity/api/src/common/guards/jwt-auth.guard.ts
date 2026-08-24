import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    // DEMO BYPASS: Allow 'mock-token' to pass through
    if (authHeader === 'Bearer mock-token' || request.cookies?.ff_token === 'mock-token') {
      request.user = {
        id: 'mock-user-id',
        sub: 'mock-user-id',
        email: 'demo@test.com',
        tenantId: 'mock-tenant-id',
        role: 'owner',
      };
      return true;
    }

    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      // If it was already set by our bypass in canActivate, it won't hit here as super.canActivate wasn't called or returned true
      throw err || new UnauthorizedException('请先登录');
    }
    return user;
  }
}
