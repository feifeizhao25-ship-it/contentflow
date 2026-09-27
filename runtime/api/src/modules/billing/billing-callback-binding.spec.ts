import { BillingService } from './billing.service';

// A valid provider signature alone must never authorize a different payment rail
// or reuse a processed event for another order.
describe('payment callback order binding', () => {
  const input = {
    orderNo: 'CF1', provider: 'alipay', providerEventId: 'event-1',
    providerOrderNo: 'transaction-1', paidAmount: 99,
    payloadHash: 'signed-payload', signatureValid: true,
  };
  function fixture(method = 'wechat', event: unknown = null) {
    const tx = {
      paymentWebhookEvent: { findUnique: jest.fn().mockResolvedValue(event), create: jest.fn() },
      paymentOrder: {
        findUnique: jest.fn().mockResolvedValue({ order_no: 'CF1', payment_method: method, status: 'pending', amount: 99, currency: 'CNY' }),
        updateMany: jest.fn(), update: jest.fn(),
      },
      subscription: { upsert: jest.fn() }, tenant: { update: jest.fn() },
    };
    const db = { $transaction: jest.fn((callback) => callback(tx)) };
    return { tx, db, service: new BillingService(db as any) };
  }
  it.each(['wechat', 'bank_transfer'])('rejects an Alipay receipt for a %s order before changing state', async method => {
    const { service, tx } = fixture(method);
    await expect(service.markPaid(input)).rejects.toThrow('支付回调渠道与订单不一致');
    expect(tx.paymentOrder.updateMany).not.toHaveBeenCalled();
    expect(tx.subscription.upsert).not.toHaveBeenCalled();
    expect(tx.tenant.update).not.toHaveBeenCalled();
    expect(tx.paymentWebhookEvent.create).not.toHaveBeenCalled();
  });
  it('rejects unsupported callback channels before accessing the database', async () => {
    const { service, db } = fixture();
    await expect(service.markPaid({ ...input, provider: 'unknown' })).rejects.toThrow('不支持的支付回调渠道');
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it('rejects reuse of a processed event for a different order', async () => {
    const { service, tx } = fixture('alipay', { order_no: 'CF2' });
    await expect(service.markPaid(input)).rejects.toThrow('支付事件编号已用于另一笔订单');
    expect(tx.paymentOrder.findUnique).not.toHaveBeenCalled();
    expect(tx.subscription.upsert).not.toHaveBeenCalled();
  });
  it('acknowledges a repeated event for its original order without granting again', async () => {
    const event = { order_no: 'CF1' };
    const { service, tx } = fixture('alipay', event);
    expect(await service.markPaid(input)).toEqual({ duplicate: true, event });
    expect(tx.paymentOrder.findUnique).not.toHaveBeenCalled();
    expect(tx.subscription.upsert).not.toHaveBeenCalled();
    expect(tx.tenant.update).not.toHaveBeenCalled();
  });
});


describe('refund entitlement ownership', () => {
  function fixture(subscriptionId: string | null, changed = 1) {
    const tx = {
      paymentOrder: {
        findUnique: jest.fn().mockResolvedValue({ order_no: 'CF1', tenant_id: 'tenant-1', subscription_id: subscriptionId, status: 'refund_pending' }),
        findFirst: jest.fn().mockResolvedValue(null), update: jest.fn(),
      },
      subscription: { updateMany: jest.fn().mockResolvedValue({ count: changed }) },
      tenant: { update: jest.fn() },
    };
    return { tx, service: new BillingService({ $transaction: (callback: any) => callback(tx) } as any) };
  }
  it('does not revoke entitlement when the order has no subscription link', async () => {
    const { tx, service } = fixture(null);
    await expect(service.markRefunded('CF1', 'refund-1')).rejects.toThrow('退款订单未关联订阅');
    expect(tx.subscription.updateMany).not.toHaveBeenCalled();
    expect(tx.tenant.update).not.toHaveBeenCalled();
    expect(tx.paymentOrder.update).not.toHaveBeenCalled();
  });
  it('rejects a missing or foreign subscription before downgrading the tenant', async () => {
    const { tx, service } = fixture('foreign-subscription', 0);
    await expect(service.markRefunded('CF1', 'refund-1')).rejects.toThrow('退款订单与订阅归属不一致');
    expect(tx.subscription.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'foreign-subscription', tenant_id: 'tenant-1' } }));
    expect(tx.tenant.update).not.toHaveBeenCalled();
    expect(tx.paymentOrder.update).not.toHaveBeenCalled();
  });
  it('finishes a refund after revoking the linked tenant subscription', async () => {
    const { tx, service } = fixture('sub-1');
    await service.markRefunded('CF1', 'refund-1');
    expect(tx.subscription.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'sub-1', tenant_id: 'tenant-1' } }));
    expect(tx.tenant.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'tenant-1' }, data: expect.objectContaining({ plan: 'free' }) }));
    expect(tx.paymentOrder.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'refunded' }) }));
  });
});
