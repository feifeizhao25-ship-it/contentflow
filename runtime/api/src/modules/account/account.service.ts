import { BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';

export const PLATFORM_NAMES: Record<string, string> = {
  douyin: '抖音',
  xiaohongshu: '小红书',
  weixin: '微信视频号',
  bilibili: 'B站',
  weibo: '微博',
  kuaishou: '快手',
};
import { PrismaService } from '../../database/prisma.service';
import { TenantService } from '../tenant/tenant.service';

@Injectable()
export class AccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantService: TenantService,
  ) {}

  async findAll(tenantId: string, options?: { platform?: string; status?: string }) {
    const where: any = { tenant_id: tenantId };
    if (options?.platform) where.platform = options.platform;
    if (options?.status) where.status = options.status;

    const rows = await this.prisma.platformAccount.findMany({
      where,
      orderBy: { created_at: 'desc' },
    });
    // 到期或降档后，超出当前生效名额的账号仍留在列表里，但标成不能再发布。
    const allowance = await this.tenantService.accountAllowance(tenantId);
    const allowed = allowance.allowedIds;
    return rows.map((row: { id: string }) => ({
      ...row,
      within_plan: allowed == null || allowed.has(row.id),
    }));
  }

  async findById(id: string, tenantId: string) {
    const account = await this.prisma.platformAccount.findFirst({
      where: { id, tenant_id: tenantId },
    });
    if (!account) throw new NotFoundException('账号不存在');
    return account;
  }

  async delete(id: string, tenantId: string) {
    return this.prisma.platformAccount.update({
      where: { id, tenant_id: tenantId },
      data: { status: 'deleted' },
    });
  }

  /**
   * 平台账号授权只走各平台官方开放平台的 OAuth。
   *
   * 原来这里返回写死的地址：抖音的 connect 页没有 client_key、redirect_uri、state，
   * 打开即报错；小红书的 `xhslink.com/oauth/authorize` 并不存在；微信给的是公众号网页授权，
   * 与发布无关。后端也没有接收授权码、换取令牌的回调。
   * 在拿到已认证的开放平台应用、并实现回调之前，如实说明未开通。
   * （红线：不接受账号密码、Cookie 或任何模拟登录方式。）
   */
  async getAuthUrl(platform: string, tenantId?: string): Promise<never> {
    const name = PLATFORM_NAMES[platform];
    if (!name) throw new BadRequestException('不支持的平台');
    // 套餐的平台账号数已满时先说明上限（403），不让用户走完授权才发现绑不上。
    if (tenantId) await this.tenantService.assertCanBindAccount(tenantId);
    throw new ServiceUnavailableException(
      `${name}开放平台授权尚未开通：需要已认证的开放平台应用与授权回调，开通前无法绑定账号`,
    );
  }
}
