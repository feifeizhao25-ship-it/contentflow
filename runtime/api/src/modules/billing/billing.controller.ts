import { ForbiddenException, BadRequestException, Body, Controller, Get, Headers, HttpCode, Post, UseGuards, Request, NotFoundException, Query, ServiceUnavailableException, UnauthorizedException, Res, Req, RawBodyRequest } from '@nestjs/common';
import { chinaMonthPeriod } from '../../common/china-period';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { effectiveEntitlements } from './effective-limits';
import { aiTokenAllowance } from '../system/usage.service';
import { IMAGE_TOKEN_EQUIVALENT } from '../ai/model-pricing';
import { CN_PLANS, PLANS, presentChinaPlan } from './plans.constant';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PrismaService } from '../../database/prisma.service';
import { BillingCycle, BillingService, PaymentMethod } from './billing.service';
import { createHash, createHmac, timingSafeEqual } from 'crypto';
import type { Response } from 'express';
import type { Request as ExpressRequest } from 'express';
import { verifyAlipayNotify } from './alipay.adapter';
import { decryptWeChatNotify, verifyWeChatNotifySignature } from './wechat-pay.adapter';

const RENEWAL_NOTICE_MS = 7 * 24 * 60 * 60 * 1000;

/** 到期前 7 天提示。当前没有自动扣款，到期后按免费版。 */
export function domesticRenewalNotice(plan: string, expiresAt: Date | string | null, now = Date.now()): string | null {
  if (!expiresAt || plan === 'free') return null;
  const end = new Date(expiresAt).getTime();
  if (!Number.isFinite(end)) return null;
  const left = end - now;
  if (left < 0 || left > RENEWAL_NOTICE_MS) return null;
  const day = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: 'numeric', day: 'numeric' }).format(end);
  return `套餐将于 ${day} 到期。到期后回到免费版。当前不会自动扣款，继续使用请在到期前手动开通。`;
}

@ApiTags('billing')
@Controller('billing')
export class BillingController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly billingService: BillingService,
  ) { }

  private async requireBillingManager(req: any): Promise<void> {
    const userId = req.user?.sub;
    const tenantId = req.user?.tenantId;
    if (typeof userId !== 'string' || !userId || typeof tenantId !== 'string' || !tenantId) {
      throw new ForbiddenException('当前账号无权管理工作区账单');
    }
    // Recheck current membership: JWT role may predate removal or demotion.
    const manager = await this.prisma.user.findFirst({
      where: { id: userId, tenant_id: tenantId, status: 'active', role: { in: ['owner', 'admin'] } },
      select: { id: true },
    });
    if (!manager) throw new ForbiddenException('仅工作区所有者或管理员可以管理账单');
  }

  @Post('callbacks/wechat')
  @HttpCode(200)
  @ApiOperation({ summary: '微信支付 V3 正式异步通知（平台签名 + AES-GCM）' })
  async wechatCallback(
    @Req() request: RawBodyRequest<ExpressRequest>,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: any,
  ) {
    const rawBody = request.rawBody;
    if (!rawBody || !verifyWeChatNotifySignature(rawBody, headers)) {
      throw new UnauthorizedException('微信支付回调签名无效');
    }
    let transaction: any;
    try {
      transaction = decryptWeChatNotify(body);
    } catch {
      // 解密失败 / 商户或应用不匹配：内容无效，应是 4xx（原来是 500，还把内部错误文字带进响应）
      throw new BadRequestException('微信支付回调内容无效');
    }
    if (transaction.trade_state !== 'SUCCESS') return { code: 'SUCCESS', message: '成功' };
    const totalFen = Number(transaction.amount?.total);
    if (!transaction.out_trade_no || !transaction.transaction_id || !Number.isInteger(totalFen)
      || transaction.amount?.currency !== 'CNY') {
      throw new BadRequestException('微信支付回调参数不完整');
    }
    await this.billingService.markPaid({
      orderNo: transaction.out_trade_no,
      provider: 'wechat',
      providerEventId: `${transaction.transaction_id}:${transaction.trade_state}`,
      providerOrderNo: transaction.transaction_id,
      paidAmount: totalFen / 100,
      payloadHash: createHash('sha256').update(rawBody).digest('hex'),
      signatureValid: true,
    });
    return { code: 'SUCCESS', message: '成功' };
  }

  @Post('callbacks/alipay')
  @HttpCode(200)
  @ApiOperation({ summary: '支付宝正式异步通知（RSA2 验签）' })
  async alipayCallback(@Body() body: Record<string, string>, @Res() response: Response) {
    if (!verifyAlipayNotify(body)) throw new UnauthorizedException('支付宝回调签名无效');
    if (body.app_id !== process.env.ALIPAY_APP_ID) throw new UnauthorizedException('支付宝应用不匹配');
    if (!process.env.ALIPAY_SELLER_ID || body.seller_id !== process.env.ALIPAY_SELLER_ID) {
      throw new UnauthorizedException('支付宝商户不匹配');
    }
    if (!['TRADE_SUCCESS', 'TRADE_FINISHED'].includes(body.trade_status)) {
      return response.type('text/plain').send('success');
    }
    const amount = Number(body.total_amount);
    if (!body.out_trade_no || !body.trade_no || !Number.isFinite(amount)) {
      throw new BadRequestException('支付宝回调参数不完整');
    }
    await this.billingService.markPaid({
      orderNo: body.out_trade_no,
      provider: 'alipay',
      providerEventId: `${body.trade_no}:${body.trade_status}`,
      providerOrderNo: body.trade_no,
      paidAmount: amount,
      payloadHash: createHash('sha256').update(JSON.stringify(body)).digest('hex'),
      signatureValid: true,
    });
    return response.type('text/plain').send('success');
  }

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
  getPlans(market: 'cn'): { market: 'cn'; plans: ReturnType<typeof presentChinaPlan>[] };
  getPlans(market?: string): { market: 'cn' | 'global'; plans: ReturnType<typeof presentChinaPlan>[] | typeof PLANS };
  @Get('plans')
  @ApiOperation({ summary: '获取订阅套餐列表(公开)' })
  getPlans(@Query('market') market?: string) {
    return market === 'cn'
      ? { market: 'cn' as const, plans: CN_PLANS.map(presentChinaPlan) }
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
    const period = chinaMonthPeriod(); // YYYY-MM，北京时间自然月（与 UsageService 记账口径一致）

    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    const meter = await this.prisma.usageMeter.findFirst({
      where: { tenant_id: tenantId, period },
    });

    if (!tenant) throw new NotFoundException('工作区不存在');

    // 套餐已过期则按 free 处理，避免过期租户继续享有付费权限
    const expiresAt = (tenant as any)?.plan_expires_at ?? null;
    const { plan, expired, limits } = effectiveEntitlements(tenant);
    // 与 AI 接口的额度闸同一算法（UsageService.checkQuota → aiTokenAllowance）
    const aiTokens = aiTokenAllowance(limits, meter as any);
    // 国内商务版的令牌/平台账号额度尚未经负责人确认。内部仍保留有限上限，避免变成不限；
    // 对外只标待确认，不把推算数字当成已承诺额度。国际版不使用这套口径。
    const quotaStatus = process.env.MARKET_REGION === 'global'
      ? 'confirmed'
      : (CN_PLANS.find((item) => item.id === plan)?.quotaStatus ?? 'confirmed');

    return {
      plan,
      quotaStatus,
      monthlyQuota: aiTokens.limit,
      usedQuota: aiTokens.used,
      // 本月 AI 额度：剩余 = 额度 − 已用；unlimited 时 limit/remaining 为 -1。
      // imageTokenEquivalent：生成 1 张图计入多少令牌（AiAllowanceService.chargeImage 的同一常量）。
      aiTokens: { ...aiTokens, imageTokenEquivalent: IMAGE_TOKEN_EQUIVALENT, quotaStatus },
      renewalDate: expiresAt ? new Date(expiresAt).toISOString() : null,
      renewalNotice: domesticRenewalNotice(plan, expiresAt),
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
    await this.requireBillingManager(req);
    return this.billingService.createOrder(req.user.tenantId, body, idempotencyKey);
  }

  @Post('subscription/cancel')
  @HttpCode(200)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '在当前周期结束时停止延续（当前没有自动扣款）' })
  async cancelSubscription(@Request() req: any) {
    await this.requireBillingManager(req);
    return this.billingService.requestCancellation(req.user.tenantId);
  }

  @Post('orders/close')
  @HttpCode(200)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async closeOrder(@Request() req: any, @Body() body: { orderNo: string }) {
    await this.requireBillingManager(req);
    return this.billingService.closePendingOrder(req.user.tenantId, body.orderNo);
  }

  @Post('orders/reconcile')
  @HttpCode(200)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async reconcileOrder(@Request() req: any, @Body() body: { orderNo: string }) {
    await this.requireBillingManager(req);
    return this.billingService.reconcileOrder(req.user.tenantId, body.orderNo);
  }

  @Post('orders/refund')
  @HttpCode(202)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async requestRefund(@Request() req: any, @Body() body: { orderNo: string }) {
    await this.requireBillingManager(req);
    return this.billingService.requestRefund(req.user.tenantId, body.orderNo);
  }
}
