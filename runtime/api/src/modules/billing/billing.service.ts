import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotImplementedException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { CN_PLANS } from './plans.constant';
import { createAlipayPagePay } from './alipay.adapter';

export type BillingCycle = 'monthly' | 'yearly';
export type PaymentMethod = 'wechat' | 'alipay' | 'bank_transfer';

const PAYABLE_ORDER_STATES: string[] = ['pending'];

@Injectable()
export class BillingService {
  constructor(private readonly prisma: PrismaService) {}

  async createOrder(
    tenantId: string,
    input: { planId: string; billingCycle: BillingCycle; paymentMethod: PaymentMethod },
    idempotencyKey: string,
  ) {
    if (!idempotencyKey || idempotencyKey.length < 8 || idempotencyKey.length > 128) {
      throw new BadRequestException('Idempotency-Key 长度必须为 8 到 128 个字符');
    }
    if (!['monthly', 'yearly'].includes(input.billingCycle)) {
      throw new BadRequestException('billingCycle 只支持 monthly 或 yearly');
    }
    if (!['wechat', 'alipay', 'bank_transfer'].includes(input.paymentMethod)) {
      throw new BadRequestException('不支持的支付方式');
    }

    const plan = CN_PLANS.find((item) => item.id === input.planId);
    if (!plan || plan.id === 'free' || plan.custom) {
      throw new BadRequestException('该套餐不能通过自助订单购买');
    }
    const amount = input.billingCycle === 'yearly' ? plan.priceYearlyCny : plan.priceMonthlyCny;
    if (amount == null || amount <= 0) throw new BadRequestException('套餐价格未配置');

    const existing = await this.prisma.paymentOrder.findFirst({
      where: { tenant_id: tenantId, idempotency_key: idempotencyKey },
    });
    if (existing) {
      const sameRequest = existing.plan_id === input.planId
        && existing.billing_cycle === input.billingCycle
        && existing.payment_method === input.paymentMethod
        && Number(existing.amount) === amount;
      if (!sameRequest) throw new ConflictException('该幂等键已用于另一笔订单');
      return existing;
    }

    this.assertProviderReady(input.paymentMethod);
    const orderNo = `CF${Date.now()}${randomUUID().replace(/-/g, '').slice(0, 10)}`;
    const payment = input.paymentMethod === 'alipay'
      ? createAlipayPagePay({ orderNo, amount, subject: plan.name })
      : null;
    const order = await this.prisma.paymentOrder.create({
      data: {
        tenant_id: tenantId,
        order_no: orderNo,
        idempotency_key: idempotencyKey,
        market: 'cn',
        plan_id: plan.id,
        billing_cycle: input.billingCycle,
        order_type: 'subscription',
        product_name: plan.name,
        amount,
        currency: 'CNY',
        payment_method: input.paymentMethod,
        status: 'pending',
      },
    });
    return { ...order, paymentUrl: payment?.paymentUrl ?? null };
  }

  private assertProviderReady(method: PaymentMethod) {
    if (method === 'bank_transfer') {
      if (!process.env.BANK_TRANSFER_ACCOUNT_NAME || !process.env.BANK_TRANSFER_ACCOUNT_NO) {
        throw new ServiceUnavailableException('对公收款账户尚未配置，未创建订单');
      }
      return;
    }
    const configured = method === 'wechat'
      ? process.env.WECHAT_PAY_MCH_ID && process.env.WECHAT_PAY_PRIVATE_KEY && process.env.WECHAT_PAY_API_V3_KEY
      : process.env.ALIPAY_APP_ID && process.env.ALIPAY_PRIVATE_KEY && process.env.ALIPAY_PUBLIC_KEY;
    if (!configured) throw new ServiceUnavailableException(`${method} 商户资料尚未配置，未创建订单`);
    if (method === 'wechat') throw new NotImplementedException('wechat 下单适配器尚未启用，未创建订单');
  }

  async requestCancellation(tenantId: string) {
    const subscription = await this.prisma.subscription.findUnique({ where: { tenant_id: tenantId } });
    if (!subscription || subscription.status !== 'active') {
      throw new BadRequestException('当前没有可取消的有效订阅');
    }
    return this.prisma.subscription.update({
      where: { tenant_id: tenantId },
      data: { cancel_at_period_end: true, cancelled_at: new Date() },
    });
  }

  async requestRefund(tenantId: string, orderNo: string) {
    const order = await this.prisma.paymentOrder.findFirst({
      where: { tenant_id: tenantId, order_no: orderNo },
    });
    if (!order) throw new BadRequestException('订单不存在');
    if (order.status !== 'paid') throw new ConflictException(`订单状态 ${order.status} 不允许申请退款`);
    return this.prisma.paymentOrder.update({
      where: { order_no: orderNo },
      data: { status: 'refund_pending' },
    });
  }

  async closePendingOrder(tenantId: string, orderNo: string) {
    const order = await this.prisma.paymentOrder.findFirst({
      where: { tenant_id: tenantId, order_no: orderNo },
    });
    if (!order) throw new BadRequestException('订单不存在');
    if (order.status !== 'pending') throw new ConflictException(`订单状态 ${order.status} 不允许关闭`);
    return this.prisma.paymentOrder.update({
      where: { order_no: orderNo },
      data: { status: 'closed' },
    });
  }

  async markPaid(input: {
    orderNo: string;
    provider: string;
    providerEventId: string;
    providerOrderNo: string;
    paidAmount: number;
    payloadHash: string;
    signatureValid: boolean;
  }) {
    if (!input.signatureValid) throw new BadRequestException('支付回调签名无效');
    return this.prisma.$transaction(async (tx: any) => {
      const duplicate = await tx.paymentWebhookEvent.findUnique({
        where: { provider_provider_event_id: { provider: input.provider, provider_event_id: input.providerEventId } },
      });
      if (duplicate) return { duplicate: true, event: duplicate };

      const order = await tx.paymentOrder.findUnique({ where: { order_no: input.orderNo } });
      if (!order) throw new BadRequestException('支付订单不存在');
      if (!PAYABLE_ORDER_STATES.includes(order.status)) throw new ConflictException(`订单状态 ${order.status} 不允许支付`);
      if (Number(order.amount) !== input.paidAmount || order.currency !== 'CNY') {
        throw new BadRequestException('支付金额或币种与订单不一致');
      }

      const plan = CN_PLANS.find((item) => item.id === order.plan_id);
      if (!plan || plan.custom || plan.id === 'free') throw new BadRequestException('订单套餐无效');
      const now = new Date();
      const periodEnd = new Date(now);
      order.billing_cycle === 'yearly'
        ? periodEnd.setFullYear(periodEnd.getFullYear() + 1)
        : periodEnd.setMonth(periodEnd.getMonth() + 1);
      const limits = {
        max_accounts: plan.platformLimit,
        max_publishes_monthly: plan.monthlyPostQuota,
        max_ai_tokens_monthly: plan.aiTokenQuota,
      };

      const subscription = await tx.subscription.upsert({
        where: { tenant_id: order.tenant_id },
        create: {
          tenant_id: order.tenant_id, plan: plan.id, billing_cycle: order.billing_cycle,
          amount: order.amount, currency: order.currency, current_period_start: now,
          current_period_end: periodEnd, status: 'active', payment_method: order.payment_method,
        },
        update: {
          plan: plan.id, billing_cycle: order.billing_cycle, amount: order.amount,
          current_period_start: now, current_period_end: periodEnd, status: 'active',
          cancel_at_period_end: false, cancelled_at: null, payment_method: order.payment_method,
        },
      });
      await tx.tenant.update({
        where: { id: order.tenant_id },
        data: { plan: plan.id, plan_expires_at: periodEnd, limits },
      });
      await tx.paymentOrder.update({
        where: { order_no: order.order_no },
        data: { status: 'paid', paid_at: now, subscription_id: subscription.id, payment_channel_order_no: input.providerOrderNo },
      });
      const event = await tx.paymentWebhookEvent.create({
        data: {
          provider: input.provider, provider_event_id: input.providerEventId,
          order_no: order.order_no, signature_valid: true, payload_hash: input.payloadHash,
          processed_at: now,
        },
      });
      return { duplicate: false, event, subscription };
    });
  }

  async markRefunded(orderNo: string, providerRefundNo: string) {
    return this.prisma.$transaction(async (tx: any) => {
      const order = await tx.paymentOrder.findUnique({ where: { order_no: orderNo } });
      if (!order) throw new BadRequestException('退款订单不存在');
      if (order.status === 'refunded' && order.payment_channel_order_no === providerRefundNo) {
        return order;
      }
      if (order.status !== 'refund_pending') {
        throw new ConflictException(`订单状态 ${order.status} 不允许完成退款`);
      }
      const newerPaidOrder = await tx.paymentOrder.findFirst({
        where: {
          tenant_id: order.tenant_id,
          status: 'paid',
          paid_at: { gt: order.paid_at ?? order.created_at },
        },
      });
      if (newerPaidOrder) {
        throw new ConflictException('存在更新的已支付订单，退款不能直接撤销当前权益');
      }
      await tx.subscription.updateMany({
        where: { id: order.subscription_id },
        data: { status: 'refunded', cancel_at_period_end: true, cancelled_at: new Date() },
      });
      await tx.tenant.update({
        where: { id: order.tenant_id },
        data: { plan: 'free', plan_expires_at: new Date() },
      });
      return tx.paymentOrder.update({
        where: { order_no: orderNo },
        data: { status: 'refunded', payment_channel_order_no: providerRefundNo },
      });
    });
  }
}
