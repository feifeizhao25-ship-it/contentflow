import { BillingService } from './billing.service';
import { CN_PLANS } from './plans.constant';

describe('billing conditional state transitions', () => {
  it.each([
    ['requestRefund', 'paid', 'refund_pending'],
    ['closePendingOrder', 'pending', 'closed'],
  ])('%s refuses a stale read without unconditional overwrite', async (method, from, target) => {
    const orders = {
      findFirst: jest.fn().mockResolvedValue({ status: from }),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      update: jest.fn(), findUnique: jest.fn(),
    };
    const service = new BillingService({ paymentOrder: orders } as any);
    await expect((service as any)[method]('tenant', 'CF1')).rejects.toThrow('状态已变化');
    expect(orders.updateMany).toHaveBeenCalledWith({ where: { order_no: 'CF1', tenant_id: 'tenant', status: from }, data: { status: target } });
    expect(orders.update).not.toHaveBeenCalled();
    expect(orders.findUnique).not.toHaveBeenCalled();
  });

  it('does not activate entitlement if another operation has claimed the order', async () => {
    const tx = {
      paymentWebhookEvent: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn() },
      paymentOrder: {
        findUnique: jest.fn().mockResolvedValue({ order_no: 'CF1', tenant_id: 'tenant', status: 'pending', amount: 99, currency: 'CNY', plan_id: 'pro', plan_snapshot: CN_PLANS[1] }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }), update: jest.fn(),
      },
      subscription: { findUnique: jest.fn(), upsert: jest.fn() }, tenant: { update: jest.fn() },
    };
    const service = new BillingService({ $transaction: (callback: any) => callback(tx) } as any);
    await expect(service.markPaid({ orderNo: 'CF1', provider: 'alipay', providerEventId: 'event', providerOrderNo: 'transaction', paidAmount: 99, payloadHash: 'fixture', signatureValid: true })).rejects.toThrow('状态已变化');
    expect(tx.subscription.upsert).not.toHaveBeenCalled();
    expect(tx.tenant.update).not.toHaveBeenCalled();
    expect(tx.paymentWebhookEvent.create).not.toHaveBeenCalled();
  });
});
