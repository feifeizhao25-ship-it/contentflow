import { GlobalWorkspaceMigration, planWorkspaceFix } from './global-workspace-migration';

const zhSettings = { timezone: 'Asia/Shanghai', language: 'zh-CN', notification_email: true };

describe('international workspace clean-up: planning', () => {
  it('renames the auto-generated name after the owner and resets untouched Chinese settings', () => {
    expect(planWorkspaceFix({ id: 't1', name: 'Ada的工作室', settings: zhSettings }, 'Ada')).toEqual({
      name: "Ada's workspace",
      settings: { timezone: 'UTC', language: 'en-US', notification_email: true },
    });
  });

  it('falls back to "My workspace" when the owner has no English name', () => {
    expect(planWorkspaceFix({ id: 't1', name: '我的工作室', settings: zhSettings }, '张三')?.name).toBe('My workspace');
    expect(planWorkspaceFix({ id: 't1', name: '我的工作室', settings: zhSettings }, null)?.name).toBe('My workspace');
  });

  it('leaves a workspace name the owner typed alone, but reports it', () => {
    expect(planWorkspaceFix({ id: 't1', name: '深圳增长小组', settings: { timezone: 'UTC', language: 'en-US' } }, 'Ada')).toEqual({ custom: true });
  });

  it('does not touch settings the user already changed or English accounts', () => {
    expect(planWorkspaceFix({ id: 't1', name: "Ada's workspace", settings: { timezone: 'Europe/London', language: 'zh-CN' } }, 'Ada')).toBeNull();
    expect(planWorkspaceFix({ id: 't1', name: "Ada's workspace", settings: { timezone: 'UTC', language: 'en-US' } }, 'Ada')).toBeNull();
  });
});

describe('international workspace clean-up: run', () => {
  const makePrisma = (rows: any[]) => {
    const updates: any[] = [];
    return {
      updates,
      $queryRaw: jest.fn().mockResolvedValue(rows),
      user: { findFirst: jest.fn().mockResolvedValue({ name: 'Ada' }) },
      tenant: { update: jest.fn(async (arg: any) => { updates.push(arg); }) },
    };
  };
  const env = { ...process.env };
  afterEach(() => { process.env = { ...env }; });

  it('updates default-named international tenants and is a no-op the second time', async () => {
    const prisma = makePrisma([
      { id: 't1', name: 'Ada的工作室', settings: zhSettings },
      { id: 't2', name: '深圳增长小组', settings: { timezone: 'UTC', language: 'en-US' } },
    ]);
    const svc = new GlobalWorkspaceMigration(prisma as any);
    const first = await svc.run();
    expect(first).toEqual({ scanned: 2, renamed: 1, settingsUpdated: 1, customLeftAlone: 1 });
    expect(prisma.updates).toHaveLength(1);
    expect(prisma.updates[0]).toMatchObject({ where: { id: 't1' }, data: { name: "Ada's workspace", settings: { language: 'en-US', timezone: 'UTC' } } });
    prisma.$queryRaw.mockResolvedValue([]);
    expect(await svc.run()).toEqual({ scanned: 0, renamed: 0, settingsUpdated: 0, customLeftAlone: 0 });
  });

  it('never runs in the domestic edition, and can be switched off', async () => {
    const prisma = makePrisma([{ id: 't1', name: 'Ada的工作室', settings: zhSettings }]);
    const svc = new GlobalWorkspaceMigration(prisma as any);
    process.env.MARKET_REGION = 'cn';
    await svc.onApplicationBootstrap();
    process.env.MARKET_REGION = 'global';
    process.env.GLOBAL_WORKSPACE_MIGRATION = '0';
    await svc.onApplicationBootstrap();
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
    expect(prisma.updates).toHaveLength(0);
  });

  it('a database error does not stop start-up', async () => {
    const prisma = makePrisma([]);
    prisma.$queryRaw.mockRejectedValue(new Error('db down'));
    process.env.MARKET_REGION = 'global';
    await expect(new GlobalWorkspaceMigration(prisma as any).onApplicationBootstrap()).resolves.toBeUndefined();
  });
});
