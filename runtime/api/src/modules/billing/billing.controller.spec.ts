import { BillingController } from './billing.controller';
import { CN_PLANS, PLANS } from './plans.constant';
import { createHmac, createSign, generateKeyPairSync } from 'crypto';
import { canonicalAlipayParams } from './alipay.adapter';

describe('BillingController', () => {
  const originalSecret = process.env.PAYMENT_CALLBACK_SECRET;
  afterEach(() => {
    if (originalSecret === undefined) delete process.env.PAYMENT_CALLBACK_SECRET;
    else process.env.PAYMENT_CALLBACK_SECRET = originalSecret;
  });
  it('returns the five canonical plan tiers in order', () => {
    // getPlans is deliberately public and does not touch persistence. Inject a
    // minimal typed test double so the constructor contract remains covered.
    const controller = new BillingController({} as any, {} as any);
    const { plans } = controller.getPlans();

    expect(plans).toBe(PLANS);
    expect(plans.map((p) => p.id)).toEqual(['free', 'starter', 'pro', 'team', 'enterprise']);

    const [free, starter, pro, team, enterprise] = plans;
    expect([free.priceMonthlyUsd, free.platformLimit, free.monthlyPostQuota]).toEqual([0, 3, 10]);
    expect([starter.priceMonthlyUsd, starter.platformLimit, starter.monthlyPostQuota]).toEqual([29, 5, 100]);
    expect([pro.priceMonthlyUsd, pro.platformLimit, pro.monthlyPostQuota]).toEqual([99, 15, 500]);
    expect([team.priceMonthlyUsd, team.platformLimit, team.monthlyPostQuota]).toEqual([299, 30, 2000]);
    expect(enterprise.priceMonthlyUsd).toBeNull();
    expect(enterprise.platformLimit).toBe(-1);
    expect(enterprise.monthlyPostQuota).toBe(-1);
    expect(plans.map((p) => p.aiTokenQuota)).toEqual([
      50000, 500000, 2500000, 10000000, -1,
    ]);
    expect(enterprise.custom).toBe(true);
  });

  it('returns the canonical four-tier RMB plans for the China market', () => {
    const controller = new BillingController({} as any, {} as any);
    const result = controller.getPlans('cn');
    expect(result.market).toBe('cn');
    expect(result.plans).toBe(CN_PLANS);
    expect(CN_PLANS.map((plan) => plan.id)).toEqual(['free', 'pro', 'team', 'enterprise']);
    expect(CN_PLANS.map((plan) => plan.priceMonthlyCny)).toEqual([0, 128, 699, null]);
    expect(CN_PLANS[0].monthlyPostQuota).toBe(30);
    expect(CN_PLANS[3].custom).toBe(true);
  });

  it('applies free limits when a paid subscription has expired', async () => {
    const prisma = {
      tenant: { findUnique: jest.fn().mockResolvedValue({
        plan: 'pro',
        plan_expires_at: new Date(Date.now() - 60000),
        limits: { max_ai_tokens_monthly: 2500000 },
      }) },
      usageMeter: { findFirst: jest.fn().mockResolvedValue({ ai_tokens: 123 }) },
    };
    const result = await new BillingController(prisma as any, {} as any).getSubscription({
      user: { tenantId: 'tenant-1' },
    });
    expect(result.plan).toBe('free');
    expect(result.monthlyQuota).toBe(50000);
    expect(result.limits.max_ai_tokens_monthly).toBe(50000);
  });

  it('accepts a fresh correctly signed internal payment callback', async () => {
    process.env.PAYMENT_CALLBACK_SECRET = 'test-secret-that-is-at-least-32-characters';
    const billing = { markPaid: jest.fn().mockResolvedValue({ duplicate: false }) };
    const controller = new BillingController({} as any, billing as any);
    const timestamp = String(Math.floor(Date.now() / 1000));
    const body = { eventId: 'evt-1', provider: 'bank_adapter', orderNo: 'CF1', status: 'paid' as const, providerOrderNo: 'BANK1', amount: 128 };
    const signed = `${timestamp}.${body.eventId}.${body.provider}.${body.orderNo}.${body.status}.${body.providerOrderNo}.${body.amount}`;
    const signature = createHmac('sha256', process.env.PAYMENT_CALLBACK_SECRET).update(signed).digest('hex');
    await controller.trustedPaymentCallback(timestamp, signature, body);
    expect(billing.markPaid).toHaveBeenCalledWith(expect.objectContaining({ orderNo: 'CF1', paidAmount: 128, signatureValid: true }));
  });

  it('rejects a forged internal payment callback', async () => {
    process.env.PAYMENT_CALLBACK_SECRET = 'test-secret-that-is-at-least-32-characters';
    const controller = new BillingController({} as any, { markPaid: jest.fn() } as any);
    const body = { eventId: 'evt-1', provider: 'bank_adapter', orderNo: 'CF1', status: 'paid' as const, providerOrderNo: 'BANK1', amount: 128 };
    await expect(controller.trustedPaymentCallback(String(Math.floor(Date.now() / 1000)), '00', body)).rejects.toThrow('签名无效');
  });

  it('verifies a real Alipay RSA2 notification before activating entitlement', async () => {
    const keys = generateKeyPairSync('rsa', { modulusLength: 2048 });
    process.env.ALIPAY_APP_ID = '2026000000000000';
    process.env.ALIPAY_SELLER_ID = 'seller-1';
    process.env.ALIPAY_PUBLIC_KEY = keys.publicKey.export({ type: 'spki', format: 'pem' }).toString();
    const body: Record<string, string> = {
      app_id: process.env.ALIPAY_APP_ID,
      seller_id: process.env.ALIPAY_SELLER_ID,
      out_trade_no: 'CF1001', trade_no: 'ALI1001',
      trade_status: 'TRADE_SUCCESS', total_amount: '128.00',
    };
    const signer = createSign('RSA-SHA256'); signer.update(canonicalAlipayParams(body)); signer.end();
    body.sign = signer.sign(keys.privateKey, 'base64'); body.sign_type = 'RSA2';
    const billing = { markPaid: jest.fn().mockResolvedValue({ duplicate: false }) };
    const response = { type: jest.fn().mockReturnThis(), send: jest.fn().mockReturnValue('sent') };
    await new BillingController({} as any, billing as any).alipayCallback(body, response as any);
    expect(billing.markPaid).toHaveBeenCalledWith(expect.objectContaining({
      orderNo: 'CF1001', providerOrderNo: 'ALI1001', paidAmount: 128, signatureValid: true,
    }));
    expect(response.type).toHaveBeenCalledWith('text/plain');
    expect(response.send).toHaveBeenCalledWith('success');
  });

  it('rejects a validly signed callback for another Alipay seller', async () => {
    const keys = generateKeyPairSync('rsa', { modulusLength: 2048 });
    process.env.ALIPAY_APP_ID = '2026000000000000';
    process.env.ALIPAY_SELLER_ID = 'seller-expected';
    process.env.ALIPAY_PUBLIC_KEY = keys.publicKey.export({ type: 'spki', format: 'pem' }).toString();
    const body: Record<string, string> = {
      app_id: process.env.ALIPAY_APP_ID, seller_id: 'seller-attacker',
      out_trade_no: 'CF1001', trade_no: 'ALI1001', trade_status: 'TRADE_SUCCESS', total_amount: '128.00',
    };
    const signer = createSign('RSA-SHA256'); signer.update(canonicalAlipayParams(body)); signer.end();
    body.sign = signer.sign(keys.privateKey, 'base64'); body.sign_type = 'RSA2';
    await expect(new BillingController({} as any, { markPaid: jest.fn() } as any)
      .alipayCallback(body, {} as any)).rejects.toThrow('商户不匹配');
  });
});
