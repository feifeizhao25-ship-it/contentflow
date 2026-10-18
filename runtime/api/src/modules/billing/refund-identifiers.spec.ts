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
