import { SystemController } from './system.controller';

describe('SystemController', () => {
  const prisma = { $queryRaw: jest.fn() };
  const redis = { ping: jest.fn() };

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('returns a healthy response for container probes', () => {
    const response = new SystemController(prisma as any, redis as any).healthCheck();
    expect(response).toEqual(
      expect.objectContaining({
        status: 'ok',
        service: 'fenfa-ai-api',
      }),
    );
    expect(Number.isNaN(Date.parse(response.timestamp))).toBe(false);
  });

  it('reports ready only when database and redis respond', async () => {
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    redis.ping.mockResolvedValue('PONG');

    await expect(
      new SystemController(prisma as any, redis as any).readinessCheck(),
    ).resolves.toEqual({
      status: 'ready',
      checks: { database: 'ok', redis: 'ok' },
    });
  });

  it('fails closed without leaking dependency errors', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('password=secret'));
    redis.ping.mockRejectedValue(new Error('redis://secret'));

    await expect(
      new SystemController(prisma as any, redis as any).readinessCheck(),
    ).rejects.toMatchObject({
      response: {
        status: 'not_ready',
        checks: { database: 'error', redis: 'error' },
      },
      status: 503,
    });
  });
});
