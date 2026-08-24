import { BadRequestException, ConflictException, ServiceUnavailableException } from '@nestjs/common';
import { BillingService } from './billing.service';

describe('BillingService', () => {
  const originalEnv = process.env;
  beforeEach(() => { process.env = { ...originalEnv }; });
  afterAll(() => { process.env = originalEnv; });

  function prisma(overrides: any = {}) {
    return {
      paymentOrder: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }) => ({ id: 'order-id', ...data })),
        ...overrides.paymentOrder,
      },
      subscription: overrides.subscription ?? {},
      $transaction: overrides.$transaction,
    } as any;
  }

  it('uses the server-side RMB price and ignores any client amount', async () => {
    process.env.BANK_TRANSFER_ACCOUNT_NAME = '奥瑞科技';
    process.env.BANK_TRANSFER_ACCOUNT_NO = 'verified-account';
    const db = prisma();
    const service = new BillingService(db);
    const order = await service.createOrder('tenant-1', {
      planId: 'pro', billingCycle: 'monthly', paymentMethod: 'bank_transfer',
    }, 'intent-123456');
    expect(order.amount).toBe(128);
    expect(order.currency).toBe('CNY');
    expect(order.status).toBe('pending');
  });

  it('returns the same order for the same idempotency key and request', async () => {
    const existing = {
      tenant_id: 'tenant-1', idempotency_key: 'intent-123456', plan_id: 'pro',
      billing_cycle: 'monthly', payment_method: 'bank_transfer', amount: 128,
    };
    const db = prisma({ paymentOrder: { findFirst: jest.fn().mockResolvedValue(existing) } });
    const result = await new BillingService(db).createOrder('tenant-1', {
      planId: 'pro', billingCycle: 'monthly', paymentMethod: 'bank_transfer',
    }, 'intent-123456');
    expect(result).toBe(existing);
    expect(db.paymentOrder.create).not.toHaveBeenCalled();
  });

  it('rejects reusing an idempotency key with different order parameters', async () => {
    const db = prisma({ paymentOrder: { findFirst: jest.fn().mockResolvedValue({
      plan_id: 'team', billing_cycle: 'monthly', payment_method: 'bank_transfer', amount: 699,
    }) } });
    await expect(new BillingService(db).createOrder('tenant-1', {
      planId: 'pro', billingCycle: 'monthly', paymentMethod: 'bank_transfer',
    }, 'intent-123456')).rejects.toBeInstanceOf(ConflictException);
  });

  it('does not create an orphan order when the payment provider is not configured', async () => {
    delete process.env.BANK_TRANSFER_ACCOUNT_NAME;
    delete process.env.BANK_TRANSFER_ACCOUNT_NO;
    const db = prisma();
    await expect(new BillingService(db).createOrder('tenant-1', {
      planId: 'pro', billingCycle: 'monthly', paymentMethod: 'bank_transfer',
    }, 'intent-123456')).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(db.paymentOrder.create).not.toHaveBeenCalled();
  });

  it('rejects free and custom plans from self-service checkout', async () => {
    const service = new BillingService(prisma());
    await expect(service.createOrder('tenant-1', {
      planId: 'enterprise', billingCycle: 'yearly', paymentMethod: 'bank_transfer',
    }, 'intent-123456')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('activates entitlement, order and webhook event in one transaction', async () => {
    const tx = {
      paymentWebhookEvent: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'event-1' }),
      },
      paymentOrder: {
        findUnique: jest.fn().mockResolvedValue({
          order_no: 'CF1', tenant_id: 'tenant-1', plan_id: 'pro', billing_cycle: 'monthly',
          payment_method: 'bank_transfer', amount: 128, currency: 'CNY', status: 'pending',
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      subscription: { upsert: jest.fn().mockResolvedValue({ id: 'sub-1' }) },
      tenant: { update: jest.fn().mockResolvedValue({}) },
    };
    const db = prisma({ $transaction: jest.fn((callback) => callback(tx)) });
    const result = await new BillingService(db).markPaid({
      orderNo: 'CF1', provider: 'bank_transfer', providerEventId: 'receipt-1',
      providerOrderNo: 'bank-serial-1', paidAmount: 128, payloadHash: 'sha256', signatureValid: true,
    });
    expect(result.duplicate).toBe(false);
    expect(tx.subscription.upsert).toHaveBeenCalled();
    expect(tx.tenant.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ plan: 'pro' }),
    }));
    expect(tx.paymentOrder.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'paid', subscription_id: 'sub-1' }),
    }));
    expect(tx.paymentWebhookEvent.create).toHaveBeenCalled();
  });

  it('treats a repeated refund notification with the same refund number as success', async () => {
    const refunded = { order_no: 'CF1', status: 'refunded', payment_channel_order_no: 'refund-1' };
    const tx = {
      paymentOrder: { findUnique: jest.fn().mockResolvedValue(refunded), findFirst: jest.fn(), update: jest.fn() },
      subscription: { updateMany: jest.fn() }, tenant: { update: jest.fn() },
    };
    const db = prisma({ $transaction: jest.fn((callback) => callback(tx)) });
    const result = await new BillingService(db).markRefunded('CF1', 'refund-1');
    expect(result).toBe(refunded);
    expect(tx.subscription.updateMany).not.toHaveBeenCalled();
    expect(tx.paymentOrder.update).not.toHaveBeenCalled();
  });
});
