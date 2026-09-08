import { BillingController } from './billing.controller';

const operations = [
  (controller: BillingController, req: any) => controller.createOrder(req, 'idempotency-key', { planId: 'pro', billingCycle: 'monthly', paymentMethod: 'alipay' }),
  (controller: BillingController, req: any) => controller.cancelSubscription(req),
  (controller: BillingController, req: any) => controller.closeOrder(req, { orderNo: 'CF1' }),
  (controller: BillingController, req: any) => controller.requestRefund(req, { orderNo: 'CF1' }),
];

describe('billing mutation permissions', () => {
  const setup = (allowed: boolean) => {
    const findFirst = jest.fn().mockResolvedValue(allowed ? { id: 'actor' } : null);
    const billing = { createOrder: jest.fn(), requestCancellation: jest.fn(), closePendingOrder: jest.fn(), requestRefund: jest.fn() };
    return { controller: new BillingController({ user: { findFirst } } as any, billing as any), findFirst, billing };
  };

  it.each(operations)('rejects a stale owner JWT after membership removal/demotion', async (operation) => {
    const { controller, findFirst, billing } = setup(false);
    await expect(operation(controller, { user: { sub: 'actor', tenantId: 'tenant', role: 'owner' } })).rejects.toThrow('仅工作区');
    expect(findFirst).toHaveBeenCalledWith({ where: { id: 'actor', tenant_id: 'tenant', status: 'active', role: { in: ['owner', 'admin'] } }, select: { id: true } });
    Object.values(billing).forEach((method) => expect(method).not.toHaveBeenCalled());
  });

  it.each(operations)('requires complete identity before querying membership', async (operation) => {
    const { controller, findFirst, billing } = setup(true);
    for (const user of [{ sub: 'actor' }, { tenantId: 'tenant' }, { sub: '', tenantId: 'tenant' }]) {
      await expect(operation(controller, { user })).rejects.toThrow('无权');
    }
    expect(findFirst).not.toHaveBeenCalled();
    Object.values(billing).forEach((method) => expect(method).not.toHaveBeenCalled());
  });

  it.each(operations)('allows a current authorized member and uses the authenticated tenant', async (operation) => {
    const { controller, billing } = setup(true);
    await operation(controller, { user: { sub: 'actor', tenantId: 'tenant' }, body: { tenantId: 'attacker-tenant', role: 'owner' } });
    const called = Object.values(billing).filter((method) => method.mock.calls.length);
    expect(called).toHaveLength(1);
    expect(called[0].mock.calls[0][0]).toBe('tenant');
  });
});
