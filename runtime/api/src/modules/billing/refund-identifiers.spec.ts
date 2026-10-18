import { BillingService } from './billing.service';

describe('refund completion identifiers', () => {
  it.each([undefined, null, '', '   ', 123])('rejects invalid provider refund number %p before opening a transaction', async (value) => {
    const db = { $transaction: jest.fn() };
    await expect(new BillingService(db as any).markRefunded('CF1', value as any)).rejects.toThrow('退款凭据不完整');
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it.each([undefined, null, '', '   ', 123])('rejects invalid order number %p before opening a transaction', async (value) => {
    const db = { $transaction: jest.fn() };
    await expect(new BillingService(db as any).markRefunded(value as any, 'refund-1')).rejects.toThrow('退款凭据不完整');
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});


describe('refund and payment references remain distinct', () => {
  it('does not treat the original payment number as a repeated refund', async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      paymentOrder: {
        findUnique: jest.fn().mockResolvedValue({ tenant_id: 'tenant', status: 'refunded', payment_channel_order_no: 'payment-1', refund_channel_order_no: 'refund-1' }),
        update: jest.fn(),
      },
    };
    const service = new BillingService({ $transaction: (callback: any) => callback(tx) } as any);
    await expect(service.markRefunded('CF1', 'payment-1')).rejects.toThrow('不允许完成退款');
    expect(tx.paymentOrder.update).not.toHaveBeenCalled();
  });
});
