import { BillingService } from './billing.service';
import { createAlipayPagePay } from './alipay.adapter';
import { createWeChatNativePay } from './wechat-pay.adapter';

jest.mock('./alipay.adapter', () => ({ createAlipayPagePay: jest.fn() }));
jest.mock('./wechat-pay.adapter', () => ({ createWeChatNativePay: jest.fn() }));

describe('retrying a checkout', () => {
  const original = process.env;
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...original, ALIPAY_APP_ID: 'test', ALIPAY_PRIVATE_KEY: 'test', ALIPAY_PUBLIC_KEY: 'test' };
  });
  afterEach(() => { process.env = original; });
  const request = { planId: 'pro', billingCycle: 'monthly' as const, paymentMethod: 'alipay' as const };
  function fixture(existing: any = null) {
    let saved: any;
    const db = { paymentOrder: {
      findFirst: jest.fn().mockResolvedValue(existing),
      create: jest.fn().mockImplementation(({ data }) => (saved = { id: 'order', ...data })),
      update: jest.fn().mockImplementation(({ data }) => (saved = { ...saved, ...data })),
    } };
    return { db, service: new BillingService(db as any) };
  }
  it('persists the link and returns it on retry without placing another provider order', async () => {
    (createAlipayPagePay as jest.Mock).mockReturnValue({ paymentUrl: 'https://openapi.alipay.com/gateway.do?test=1' });
    const { db, service } = fixture();
    const first = await service.createOrder('tenant', request, 'checkout-123');
    expect(first.payment_url).toBe(first.paymentUrl);
    db.paymentOrder.findFirst.mockResolvedValue(first);
    const retry = await service.createOrder('tenant', request, 'checkout-123');
    expect(retry.order_no).toBe(first.order_no);
    expect(retry.paymentUrl).toBe(first.paymentUrl);
    expect(createAlipayPagePay).toHaveBeenCalledTimes(1);
    expect(db.paymentOrder.create).toHaveBeenCalledTimes(1);
  });
  it('restores a stored WeChat QR link without calling the provider', async () => {
    const { service } = fixture({ plan_id: 'pro', billing_cycle: 'monthly', payment_method: 'wechat', status: 'pending', payment_url: 'weixin://wxpay/test' });
    expect((await service.createOrder('tenant', { ...request, paymentMethod: 'wechat' }, 'checkout-123')).paymentUrl).toBe('weixin://wxpay/test');
    expect(createWeChatNativePay).not.toHaveBeenCalled();
  });
  it.each(['paid', 'closed', 'refund_pending', 'refunded'])('does not offer a payment link for %s orders', async status => {
    const { service } = fixture({ plan_id: 'pro', billing_cycle: 'monthly', payment_method: 'alipay', status, payment_url: 'https://openapi.alipay.com/gateway.do?test=1' });
    expect((await service.createOrder('tenant', request, 'checkout-123')).paymentUrl).toBeNull();
    expect(createAlipayPagePay).not.toHaveBeenCalled();
  });
  it('reports a missing legacy link instead of silently returning an unusable checkout', async () => {
    const { service, db } = fixture({ plan_id: 'pro', billing_cycle: 'monthly', payment_method: 'alipay', status: 'pending' });
    await expect(service.createOrder('tenant', request, 'checkout-123')).rejects.toThrow('支付链接正在生成或需要核对');
    expect(db.paymentOrder.create).not.toHaveBeenCalled();
    expect(createAlipayPagePay).not.toHaveBeenCalled();
  });
  it('does not contact the provider if reserving the order fails', async () => {
    const { service, db } = fixture();
    db.paymentOrder.create.mockRejectedValue(new Error('database unavailable'));
    await expect(service.createOrder('tenant', request, 'checkout-123')).rejects.toThrow('database unavailable');
    expect(createAlipayPagePay).not.toHaveBeenCalled();
  });
  it('retains a traceable order when the provider fails', async () => {
    const { service, db } = fixture();
    (createAlipayPagePay as jest.Mock).mockImplementation(() => { throw new Error('timeout'); });
    await expect(service.createOrder('tenant', request, 'checkout-123')).rejects.toThrow('订单已保留');
    expect(db.paymentOrder.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'pending', payment_url: null }) }));
    const reserved = db.paymentOrder.create.mock.calls[0][0].data;
    expect((createAlipayPagePay as jest.Mock).mock.calls[0][0].orderNo).toBe(reserved.order_no);
    db.paymentOrder.findFirst.mockResolvedValue(reserved);
    await expect(service.createOrder('tenant', request, 'checkout-123')).rejects.toThrow('请勿重复购买');
    expect(createAlipayPagePay).toHaveBeenCalledTimes(1);
  });
  it('keeps the original order when saving the provider link fails', async () => {
    const { service, db } = fixture();
    (createAlipayPagePay as jest.Mock).mockReturnValue({ paymentUrl: 'https://openapi.alipay.com/test' });
    db.paymentOrder.update.mockRejectedValue(new Error('write failed'));
    await expect(service.createOrder('tenant', request, 'checkout-123')).rejects.toThrow('订单已保留');
    const reserved = db.paymentOrder.create.mock.calls[0][0].data;
    expect(db.paymentOrder.update).toHaveBeenCalledWith({ where: { order_no: reserved.order_no }, data: { payment_url: 'https://openapi.alipay.com/test' } });
    expect(db.paymentOrder.create).toHaveBeenCalledTimes(1);
  });
  it('replays the unique-key winner without a second provider call', async () => {
    const winner = { plan_id: 'pro', billing_cycle: 'monthly', payment_method: 'alipay', status: 'pending', payment_url: 'https://openapi.alipay.com/original' };
    const { service, db } = fixture();
    db.paymentOrder.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(winner);
    db.paymentOrder.create.mockRejectedValue({ code: 'P2002' });
    expect((await service.createOrder('tenant', request, 'checkout-123')).paymentUrl).toBe(winner.payment_url);
    expect(createAlipayPagePay).not.toHaveBeenCalled();
  });
  it('does not reopen an order paid while its link was being saved', async () => {
    const { service, db } = fixture();
    (createAlipayPagePay as jest.Mock).mockReturnValue({ paymentUrl: 'https://openapi.alipay.com/test' });
    db.paymentOrder.update.mockResolvedValue({ status: 'paid', payment_url: 'https://openapi.alipay.com/test' });
    expect((await service.createOrder('tenant', request, 'checkout-123')).paymentUrl).toBeNull();
    expect(db.paymentOrder.update.mock.calls[0][0].data).not.toHaveProperty('status');
  });

});
