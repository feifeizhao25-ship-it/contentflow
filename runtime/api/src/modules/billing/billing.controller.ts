import { BadRequestException, Body, Controller, Get, Headers, HttpCode, Post, UseGuards, Request, NotFoundException, Query, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CN_PLANS, PLANS } from './plans.constant';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PrismaService } from '../../database/prisma.service';
import { BillingCycle, BillingService, PaymentMethod } from './billing.service';
import { createHash, createHmac, timingSafeEqual } from 'crypto';

@ApiTags('billing')
@Controller('billing')
export class BillingController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly billingService: BillingService,
  ) { }

  @Post('callbacks/internal')
  @HttpCode(200)
  @ApiOperation({ summary: '支付适配器可信回调（HMAC 验签）' })
  async trustedPaymentCallback(
    @Headers('x-payment-timestamp') timestamp: string,
    @Headers('x-payment-signature') signature: string,
    @Body() body: { eventId: string; provider: string; orderNo: string; status: 'paid' | 'refunded'; providerOrderNo: string; amount?: number },
  ) {
    const secret = process.env.PAYMENT_CALLBACK_SECRET;
    if (!secret || secret.length < 32) throw new ServiceUnavailableException('支付回调密钥未配置');
    const epoch = Number(timestamp);
    if (!Number.isFinite(epoch) || Math.abs(Date.now() - epoch * 1000) > 300000) {
      throw new UnauthorizedException('支付回调已过期');
    }
    if (!body.eventId || !body.orderNo || !body.providerOrderNo || !['paid', 'refunded'].includes(body.status)) {
      throw new BadRequestException('支付回调参数不完整');
    }
    const signed = `${timestamp}.${body.eventId}.${body.provider}.${body.orderNo}.${body.status}.${body.providerOrderNo}.${body.amount ?? ''}`;
    const expected = createHmac('sha256', secret).update(signed).digest();
    let supplied: Buffer;
    try { supplied = Buffer.from(signature || '', 'hex'); } catch { throw new UnauthorizedException('支付回调签名无效'); }
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
      throw new UnauthorizedException('支付回调签名无效');
    }
    if (body.status === 'refunded') {
      return this.billingService.markRefunded(body.orderNo, body.providerOrderNo);
    }
    if (!Number.isFinite(body.amount)) throw new BadRequestException('支付金额缺失');
    return this.billingService.markPaid({
      orderNo: body.orderNo, provider: body.provider, providerEventId: body.eventId,
      providerOrderNo: body.providerOrderNo, paidAmount: Number(body.amount),
      payloadHash: createHash('sha256').update(signed).digest('hex'), signatureValid: true,
    });
  }

  // 公开端点:定价页与落地页直接消费,不要求登录
  getPlans(): { market: 'global'; plans: typeof PLANS };
  getPlans(market: 'cn'): { market: 'cn'; plans: typeof CN_PLANS };
  getPlans(market?: string): { market: 'cn' | 'global'; plans: typeof CN_PLANS | typeof PLANS };
  @Get('plans')
  @ApiOperation({ summary: '获取订阅套餐列表(公开)' })
  getPlans(@Query('market') market?: string) {
    return market === 'cn'
      ? { market: 'cn' as const, plans: CN_PLANS }
      : { market: 'global' as const, plans: PLANS };
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

    if (!tenant) throw new NotFoundException('Tenant not found');

    // 套餐已过期则按 free 处理，避免过期租户继续享有付费权限
    const expiresAt = (tenant as any)?.plan_expires_at ?? null;
    const expired = expiresAt ? new Date(expiresAt).getTime() < Date.now() : false;
    const plan = expired ? 'free' : ((tenant as any).plan ?? 'free');
    const planDefinition = PLANS.find((item) => item.id === plan) ?? PLANS[0];
    const storedLimits = (tenant.limits as any) || {};
    const limits = expired ? {
      max_accounts: planDefinition.platformLimit,
      max_publishes_monthly: planDefinition.monthlyPostQuota,
      max_ai_tokens_monthly: planDefinition.aiTokenQuota,
    } : storedLimits;
    const monthlyQuota = limits.max_ai_tokens_monthly ??
      ((limits.max_ai_calls_monthly ?? planDefinition.aiTokenQuota / 2500) * 2500);
    const usedQuota = (meter as any)?.ai_tokens ?? 0;

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

  @Post('orders')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '按服务端套餐价格创建支付订单' })
  async createOrder(
    @Request() req: any,
    @Headers('idempotency-key') idempotencyKey: string,
    @Body() body: { planId: string; billingCycle: BillingCycle; paymentMethod: PaymentMethod },
  ) {
    return this.billingService.createOrder(req.user.tenantId, body, idempotencyKey);
  }

  @Post('subscription/cancel')
  @HttpCode(200)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '在当前周期结束时取消自动续费' })
  async cancelSubscription(@Request() req: any) {
    return this.billingService.requestCancellation(req.user.tenantId);
  }

  @Post('orders/close')
  @HttpCode(200)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async closeOrder(@Request() req: any, @Body() body: { orderNo: string }) {
    return this.billingService.closePendingOrder(req.user.tenantId, body.orderNo);
  }

  @Post('orders/refund')
  @HttpCode(202)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async requestRefund(@Request() req: any, @Body() body: { orderNo: string }) {
    return this.billingService.requestRefund(req.user.tenantId, body.orderNo);
  }
}
