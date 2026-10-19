import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../database/prisma.service';
import { ResourceType, UsageService } from './usage.service';

describe('UsageService', () => {
  let service: UsageService;
  const meter = {
    id: 'meter_1',
    tenant_id: 'tenant_1',
    period: '2026-07',
    ai_tokens: 0,
    image_count: 0,
    video_count: 0,
    publish_count: 0,
    storage_mb: 0,
  };
  const prisma = {
    usageMeter: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
    },
    costLedger: { create: jest.fn() },
    tenant: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation((callback) => callback(prisma));
    prisma.usageMeter.findFirst.mockResolvedValue(meter);
    prisma.usageMeter.update.mockResolvedValue(meter);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsageService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(UsageService);
  });

  it('increments the selected usage meter field', async () => {
    await service.trackUsage('tenant_1', ResourceType.PUBLISHES, 2);
    expect(prisma.usageMeter.upsert).toHaveBeenCalledWith({
      where: { tenant_id_period: { tenant_id: 'tenant_1', period: expect.any(String) } },
      create: { tenant_id: 'tenant_1', period: expect.any(String), publish_count: 2 },
      update: { publish_count: { increment: 2 } },
    });
  });

  it('records token cost details', async () => {
    await service.trackUsage('tenant_1', ResourceType.TOKENS, 1000, {
      refId: 'request_1',
    });
    expect(prisma.costLedger.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenant_id: 'tenant_1',
        tokens_used: 1000,
        ref_id: 'request_1',
      }),
    });
    // 不再写没有出处的「每千 token 0.002 美元」估算金额
    expect(prisma.costLedger.create.mock.calls[0][0].data.cost_est_usd).toBe(0);
  });

  it.each([-1, 0.5, NaN, Infinity, 2147483648])('rejects invalid amount %s before writes', async (amount) => {
    await expect(service.trackUsage('tenant_1', ResourceType.TOKENS, amount)).rejects.toThrow(RangeError);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('does not write zero usage', async () => {
    await service.trackUsage('tenant_1', ResourceType.TOKENS, 0);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('allows usage below the tenant limit and rejects usage at the limit', async () => {
    prisma.tenant.findUnique.mockResolvedValue({
      limits: { max_publishes_monthly: 10 },
    });
    prisma.usageMeter.findFirst
      .mockResolvedValueOnce({ ...meter, publish_count: 9 })
      .mockResolvedValueOnce({ ...meter, publish_count: 10 });

    await expect(
      service.checkQuota('tenant_1', ResourceType.PUBLISHES),
    ).resolves.toBe(true);
    await expect(
      service.checkQuota('tenant_1', ResourceType.PUBLISHES),
    ).resolves.toBe(false);
  });

  it('compares AI token usage with a token limit, not a call-count limit', async () => {
    prisma.tenant.findUnique.mockResolvedValue({
      limits: { max_ai_tokens_monthly: 50000 },
    });
    prisma.usageMeter.findFirst
      .mockResolvedValueOnce({ ...meter, ai_tokens: 49999 })
      .mockResolvedValueOnce({ ...meter, ai_tokens: 50000 });

    await expect(service.checkQuota('tenant_1', ResourceType.TOKENS)).resolves.toBe(true);
    await expect(service.checkQuota('tenant_1', ResourceType.TOKENS)).resolves.toBe(false);
  });

  it('converts legacy AI call limits during tenant migration', async () => {
    prisma.tenant.findUnique.mockResolvedValue({
      limits: { max_ai_calls_monthly: 20 },
    });
    prisma.usageMeter.findFirst.mockResolvedValue({ ...meter, ai_tokens: 49999 });
    await expect(service.checkQuota('tenant_1', ResourceType.TOKENS)).resolves.toBe(true);
  });
});
