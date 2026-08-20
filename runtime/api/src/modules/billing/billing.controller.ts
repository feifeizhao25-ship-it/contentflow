import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PrismaService } from '../../database/prisma.service';
import { CN_PLANS, PLANS } from './plans.constant';

@ApiTags('billing')
@Controller('billing')
export class BillingController {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('plans')
  @ApiOperation({ summary: '获取当前市场的订阅套餐列表（公开）' })
  getPlans() {
    const market = this.config.get<string>('MARKET_REGION') === 'global' ? 'global' : 'cn';
    return { market, plans: market === 'global' ? PLANS : CN_PLANS };
  }

  @Get('subscription')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '获取当前租户的订阅状态与用量' })
  async getSubscription(@Request() req: any) {
    const tenantId = req.user.tenantId;
    const period = new Date().toISOString().substring(0, 7);
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    const meter = await this.prisma.usageMeter.findFirst({
      where: { tenant_id: tenantId, period },
    });
    const limits = (tenant?.limits as any) || {};
    const expiresAt = (tenant as any)?.plan_expires_at ?? null;
    const expired = expiresAt ? new Date(expiresAt).getTime() < Date.now() : false;

    return {
      plan: expired ? 'free' : ((tenant as any)?.plan ?? 'free'),
      monthlyQuota: limits.max_ai_calls_monthly ?? 0,
      usedQuota: (meter as any)?.ai_tokens ?? 0,
      renewalDate: expiresAt ? new Date(expiresAt).toISOString() : null,
      expired,
      limits,
      period,
    };
  }
}
