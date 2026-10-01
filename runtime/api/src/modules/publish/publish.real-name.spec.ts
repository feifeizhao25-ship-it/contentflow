/**
 * 实名认证开关：REAL_NAME_REQUIRED_FOR_PUBLISH=true 时，没有完成手机号验证与实名认证的用户不能创建发布任务。
 * 实名认证服务本身（公安 / 运营商二要素核验）是外部资质，尚未接入：开关打开后在接入之前没有人能发布——
 * 这是刻意的，不能为了「能用」放过去，也不能伪造「已实名」。
 */
import { ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../../database/prisma.service';
import { PublishQueueService } from '../../queue/publish-queue.service';
import { TenantService } from '../tenant/tenant.service';
import { NotConfiguredRealNameVerifier } from '../auth/real-name/real-name.verifier';
import { AdapterRegistry } from './adapters/adapter.registry';
import { PublishService } from './publish.service';

describe('发布前实名认证开关', () => {
  const prisma = {
    user: { findUnique: jest.fn() },
    content: { findFirst: jest.fn() },
    platformAccount: { findFirst: jest.fn() },
    publishTask: { create: jest.fn() },
  };
  const queue = { addPublishTask: jest.fn() };
  const tenant = { checkQuota: jest.fn(), incrementUsage: jest.fn() };
  const registry = { get: jest.fn() };
  const input = { contentId: 'c1', platformAccountIds: ['a1'], publishType: 'immediate' as const };

  async function make(env: Record<string, string>) {
    const moduleRef = await Test.createTestingModule({
      providers: [
        PublishService,
        { provide: PrismaService, useValue: prisma },
        { provide: PublishQueueService, useValue: queue },
        { provide: TenantService, useValue: tenant },
        { provide: AdapterRegistry, useValue: registry },
        { provide: ConfigService, useValue: { get: (k: string, d?: unknown) => env[k] ?? d } },
      ],
    }).compile();
    return moduleRef.get(PublishService);
  }

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.content.findFirst.mockResolvedValue({ id: 'c1', status: 'approved', title: '标题', body: '正文' });
    prisma.platformAccount.findFirst.mockResolvedValue({ id: 'a1', status: 'active', platform: 'bilibili' });
    prisma.publishTask.create.mockResolvedValue({ id: 't1' });
    tenant.checkQuota.mockResolvedValue(true);
    registry.get.mockReturnValue({ isLive: true });
  });

  it('开关默认关闭：不查用户，照常创建', async () => {
    const service = await make({});
    await expect(service.createTask('t', 'u', input)).resolves.toHaveLength(1);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('开关打开、手机号未验证：403，什么都没写', async () => {
    const service = await make({ REAL_NAME_REQUIRED_FOR_PUBLISH: 'true' });
    prisma.user.findUnique.mockResolvedValue({ phone_verified: false, real_name_verified: false, status: 'active' });
    const err: any = await service.createTask('t', 'u', input).catch((e) => e);
    expect(err).toBeInstanceOf(ForbiddenException);
    expect(JSON.stringify(err.getResponse())).toContain('手机号');
    expect(prisma.publishTask.create).not.toHaveBeenCalled();
    expect(queue.addPublishTask).not.toHaveBeenCalled();
  });

  it('开关打开、手机号已验证但未实名：403 + REAL_NAME_REQUIRED', async () => {
    const service = await make({ REAL_NAME_REQUIRED_FOR_PUBLISH: 'true' });
    prisma.user.findUnique.mockResolvedValue({ phone_verified: true, real_name_verified: false, status: 'active' });
    const err: any = await service.createTask('t', 'u', input).catch((e) => e);
    expect(err).toBeInstanceOf(ForbiddenException);
    expect(err.getResponse().code).toBe('REAL_NAME_REQUIRED');
    expect(err.getResponse().message).toContain('实名认证');
    expect(prisma.publishTask.create).not.toHaveBeenCalled();
  });

  it('开关打开、用户不存在或已注销：403', async () => {
    const service = await make({ REAL_NAME_REQUIRED_FOR_PUBLISH: 'true' });
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.createTask('t', 'u', input)).rejects.toBeInstanceOf(ForbiddenException);
    prisma.user.findUnique.mockResolvedValue({ phone_verified: true, real_name_verified: true, status: 'deleted' });
    await expect(service.createTask('t', 'u', input)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('开关打开、已验证手机号且已实名：照常创建', async () => {
    const service = await make({ REAL_NAME_REQUIRED_FOR_PUBLISH: 'true' });
    prisma.user.findUnique.mockResolvedValue({ phone_verified: true, real_name_verified: true, status: 'active' });
    await expect(service.createTask('t', 'u', input)).resolves.toHaveLength(1);
  });

  it.each(['TRUE', ' true ', '1'])('开关取值 %j 也按打开处理（拼法不同不能悄悄放行）', async (value) => {
    const service = await make({ REAL_NAME_REQUIRED_FOR_PUBLISH: value });
    prisma.user.findUnique.mockResolvedValue({ phone_verified: true, real_name_verified: false, status: 'active' });
    await expect(service.createTask('t', 'u', input)).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('实名认证服务（未接入）', () => {
  it('核验一律报「实名认证服务未接入」，绝不返回已通过', async () => {
    const verifier = new NotConfiguredRealNameVerifier();
    expect(verifier.name).toBe('not-configured');
    const err: any = await verifier.verify({ realName: '张三', idNumber: '110101199001011234', phone: '13800138000' }).catch((e) => e);
    expect(err).toBeInstanceOf(ServiceUnavailableException);
    expect(String(err.message)).toContain('实名认证服务未接入');
    // 报错信息不回显身份证号
    expect(JSON.stringify(err.getResponse())).not.toContain('110101');
  });
});
