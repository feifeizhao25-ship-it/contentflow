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
    },
    costLedger: { create: jest.fn() },
    tenant: { findUnique: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
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
    expect(prisma.usageMeter.update).toHaveBeenCalledWith({
      where: { id: 'meter_1' },
      data: { publish_count: { increment: 2 } },
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
  });

  it('creates a monthly meter when none exists', async () => {
    prisma.usageMeter.findFirst.mockResolvedValueOnce(null);
    prisma.usageMeter.create.mockResolvedValueOnce(meter);
    await service.trackUsage('tenant_1', ResourceType.IMAGES, 1);
    expect(prisma.usageMeter.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenant_id: 'tenant_1',
        image_count: 0,
      }),
    });
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
});
