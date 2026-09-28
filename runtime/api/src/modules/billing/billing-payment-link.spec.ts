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
    const db = { paymentOrder: {
      findFirst: jest.fn().mockResolvedValue(existing),
      create: jest.fn().mockImplementation(({ data }) => ({ id: 'order', ...data })),
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
    await expect(service.createOrder('tenant', request, 'checkout-123')).rejects.toThrow('历史订单缺少支付链接');
    expect(db.paymentOrder.create).not.toHaveBeenCalled();
    expect(createAlipayPagePay).not.toHaveBeenCalled();
  });
});
