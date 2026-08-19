import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PLANS } from './plans.constant';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PrismaService } from '../../database/prisma.service';

@ApiTags('billing')
@Controller('billing')
export class BillingController {
  constructor(private readonly prisma: PrismaService) { }

  // 公开端点:定价页与落地页直接消费,不要求登录
  @Get('plans')
  @ApiOperation({ summary: '获取订阅套餐列表(公开)' })
  getPlans() {
    return { plans: PLANS };
  }

  /**
   * 当前租户的订阅状态与用量。
   *
   * 前端此前把订阅状态存在 localStorage 里并以此判断是否解锁功能——
   * 用户在 DevTools 改成 enterprise 就能绕过全部付费墙。
   * 现由该端点作为唯一权威来源；前端的门禁只负责 UX，
   * 真正的额度拦截仍在 UsageService.checkQuota 服务端完成。
   */
  @Get('subscription')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '获取当前租户的订阅状态与用量' })
  async getSubscription(@Request() req: any) {
    const tenantId = req.user.tenantId;
    const period = new Date().toISOString().substring(0, 7); // YYYY-MM

    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    const meter = await this.prisma.usageMeter.findFirst({
      where: { tenant_id: tenantId, period },
    });

    const limits = (tenant?.limits as any) || {};
    const monthlyQuota = limits.max_ai_calls_monthly ?? 0;
    const usedQuota = (meter as any)?.ai_tokens ?? 0;

    // 套餐已过期则按 free 处理，避免过期租户继续享有付费权限
    const expiresAt = (tenant as any)?.plan_expires_at ?? null;
    const expired = expiresAt ? new Date(expiresAt).getTime() < Date.now() : false;
    const plan = expired ? 'free' : ((tenant as any)?.plan ?? 'free');

    return {
      plan,
      monthlyQuota,
      usedQuota,
      renewalDate: expiresAt ? new Date(expiresAt).toISOString() : null,
      expired,
      limits,
      period,
    };
  }
}
