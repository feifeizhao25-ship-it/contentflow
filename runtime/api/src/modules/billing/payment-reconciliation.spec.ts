import { BillingService } from './billing.service';
import { queryPayment, closePayment } from './payment-reconciliation';
jest.mock('./payment-reconciliation', () => ({ queryPayment: jest.fn(), closePayment: jest.fn() }));

describe('provider-confirmed order reconciliation', () => {
  beforeEach(() => jest.resetAllMocks());
  const order = { order_no: 'CF1', tenant_id: 'tenant', status: 'pending', payment_method: 'wechat' };
  function fixture() {
    const db = { paymentOrder: {
      findFirst: jest.fn().mockResolvedValue(order), findUnique: jest.fn().mockResolvedValue(order),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    } };
    return { db, service: new BillingService(db as any) };
  }
  it('keeps the local order open when provider close fails', async () => {
    const { db, service } = fixture();
    (queryPayment as jest.Mock).mockResolvedValue({ state: 'pending' });
    (closePayment as jest.Mock).mockRejectedValue(new Error('timeout'));
    await expect(service.closePendingOrder('tenant', 'CF1')).rejects.toThrow('尚未确认关单');
    expect(db.paymentOrder.updateMany).not.toHaveBeenCalled();
  });
  it('closes locally only after successful provider closure', async () => {
    const { db, service } = fixture();
    (queryPayment as jest.Mock).mockResolvedValue({ state: 'pending' });
    (closePayment as jest.Mock).mockResolvedValue(undefined);
    await service.closePendingOrder('tenant', 'CF1');
    expect(closePayment).toHaveBeenCalledWith('wechat', 'CF1');
    expect(db.paymentOrder.updateMany).toHaveBeenCalledWith({ where: { order_no: 'CF1', tenant_id: 'tenant', status: 'pending' }, data: { status: 'closed' } });
  });
  it('reconciles a paid order rather than closing it', async () => {
    const { db, service } = fixture();
    (queryPayment as jest.Mock).mockResolvedValue({ state: 'paid', transactionId: 'WX1', amount: 99 });
    const paid = jest.spyOn(service, 'markPaid').mockResolvedValue({ duplicate: false } as any);
    await expect(service.closePendingOrder('tenant', 'CF1')).rejects.toThrow('订单已付款');
    expect(paid).toHaveBeenCalledWith(expect.objectContaining({ provider: 'wechat', orderNo: 'CF1', paidAmount: 99, providerOrderNo: 'WX1' }));
    expect(closePayment).not.toHaveBeenCalled();
    expect(db.paymentOrder.updateMany).not.toHaveBeenCalled();
  });
  it('does not contact providers for a different tenant order', async () => {
    const { db, service } = fixture();
    db.paymentOrder.findFirst.mockResolvedValue(null as any);
    await expect(service.reconcileOrder('other', 'CF1')).rejects.toThrow('订单不存在');
    expect(db.paymentOrder.findFirst).toHaveBeenCalledWith({ where: { tenant_id: 'other', order_no: 'CF1' } });
    expect(queryPayment).not.toHaveBeenCalled();
  });
  it('keeps state unchanged when query cannot be verified', async () => {
    const { db, service } = fixture();
    (queryPayment as jest.Mock).mockRejectedValue(new Error('bad signature'));
    await expect(service.reconcileOrder('tenant', 'CF1')).rejects.toThrow('暂未确认');
    expect(db.paymentOrder.updateMany).not.toHaveBeenCalled();
  });
});
