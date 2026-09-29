import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../database/prisma.service';

/**
 * 注销账号与导出个人信息。
 *
 * 隐私政策承诺「用户可在账号设置中申请访问、更正、导出或删除」，而代码里
 * 一个入口都没有（UserService.delete 从未被调用；控制器里的 Delete 是没用上的 import）。
 *
 * ## 数据归属
 *
 * 分发侠的数据分两层：
 *   - 工作区（Tenant）拥有内容、平台账号、素材、AI 生成记录、发布任务等业务数据；
 *   - 用户（User）只拥有自己的个人数据：会话、通知、成长目标、积分与成就等。
 *
 * ## 注销时
 *
 * | 情形 | 处理 |
 * |---|---|
 * | 工作区里还有其他在职成员，且我是所有者 | **拒绝（409）**：先转让所有权或移除成员 |
 * | 工作区里还有其他在职成员，我不是所有者 | 只删我的个人数据；我在工作区里创建的内容属于工作区，保留 |
 * | 我是工作区里唯一的在职成员 | 删我的个人数据，**并删整个工作区的业务数据**（内容、平台账号及其授权凭据、素材、AI 生成记录、密钥……） |
 *
 * 一律**保留**：订单、订阅、支付回调、用量与成本流水（财务凭证，依法保存不少于三年）、
 * 操作日志（网络安全法要求日志留存不少于六个月）。它们只带工作区 ID / 用户 ID，
 * 而这两行都已匿名化，不再指向任何人。
 * **工作区行不能删**：PaymentOrder、Subscription 对 Tenant 是 ON DELETE CASCADE，
 * 一删订单跟着没了。所以只匿名化：名称、标识、logo、设置清空，状态置 deleted。
 *
 * User 行同样只匿名化（邮箱换成不可送达的占位地址，手机号、口令哈希、昵称、头像、
 * 第三方登录清空，状态 deleted）。JwtStrategy 每次请求都查库、要求 active，
 * 所以已发出的访问令牌在注销的同一刻失效；刷新令牌同理。
 *
 * 整个过程在一个事务里：任何一步失败整体回滚。
 */

/** 只要求「能执行带参数的 SQL」的最小接口：Prisma 的事务客户端满足它，测试里可换成直连 PostgreSQL 的实现。 */
export interface SqlTx {
  $executeRawUnsafe(sql: string, ...params: unknown[]): Promise<number>;
  $queryRawUnsafe<T = any>(sql: string, ...params: unknown[]): Promise<T>;
}
export interface TxRunner {
  $transaction<T>(fn: (tx: SqlTx) => Promise<T>): Promise<T>;
}

/** 用户自己的个人数据表：列名 user_id，或 PointsLog 这类通过积分账户间接指向。 */
export const USER_OWNED_TABLES: ReadonlyArray<{ table: string; column: string }> = [
  { table: 'UserSession', column: 'user_id' },
  { table: 'GrowthGoal', column: 'user_id' },
  { table: 'PersonaTemplate', column: 'user_id' },
  { table: 'ContentAnnotation', column: 'user_id' },
  { table: 'AccountHealth', column: 'user_id' },
  { table: 'UserNotification', column: 'user_id' },
  { table: 'ABTest', column: 'user_id' },
  { table: 'CompetitorMonitor', column: 'user_id' },
  { table: 'ContentPrediction', column: 'user_id' },
  { table: 'UserGamification', column: 'user_id' },
  { table: 'UserPoints', column: 'user_id' }, // PointsLog、RedemptionRecord 随之级联
  { table: 'UserAchievement', column: 'user_id' },
  { table: 'user_quests', column: 'user_id' },
  { table: 'gamification_profiles', column: 'user_id' },
];

/** 工作区拥有的业务数据表（仅在我是唯一在职成员时删除）。顺序：子表在前。 */
export const TENANT_OWNED_TABLES: ReadonlyArray<string> = [
  'Content', // PlatformContent、PublishTask、ContentStats、ReviewLog、ContentAnnotation、ContentPrediction 级联
  'PlatformAccount', // 含授权凭据；AccountStatsHistory 级联
  'PublishTemplate',
  'DailyReport',
  'Material',
  'MaterialFolder',
  'AIGeneration',
  'personas',
  'TeamTask',
  'ApiKey',
];

/** 依法保留的表（只在这里登记，注销语句里不得出现对它们的 DELETE）。 */
export const RETAINED_TABLES: ReadonlyArray<{ table: string; why: string }> = [
  { table: 'PaymentOrder', why: '订单，交易凭证' },
  { table: 'Subscription', why: '订阅记录' },
  { table: 'PaymentWebhookEvent', why: '支付回调，交易凭证' },
  { table: 'UsageRecord', why: '用量流水' },
  { table: 'usage_meters', why: '用量计量' },
  { table: 'cost_ledger', why: '成本流水' },
  { table: 'ActivityLog', why: '操作日志，网络安全法要求留存不少于六个月' },
];

/**
 * schema.prisma 里每一张表都必须在这里登记它在注销时的归宿。
 * 新增模型的人必须回答：这张表里的行属于谁、注销时删还是依法保留——
 * account-erasure.spec.ts 会拿 schema.prisma 逐表核对，漏登记就失败。
 *
 *   user          用户自己的个人数据，按 user_id 删
 *   tenant        工作区拥有的业务数据，工作区唯一在职成员注销时删
 *   cascade       随上级表的外键级联删除（写明上级）
 *   identity      Tenant / User 行本身：匿名化，不删（订单外键指向它们）
 *   retained      依法保留
 *   global        与任何用户无关的全局数据（写明理由）
 */
export const TABLE_CLASSIFICATION: Readonly<Record<string, { kind: 'user' | 'tenant' | 'cascade' | 'identity' | 'retained' | 'global'; note?: string }>> = {
  Tenant: { kind: 'identity' },
  User: { kind: 'identity' },
  UserSession: { kind: 'user' },
  GrowthGoal: { kind: 'user' },
  PersonaTemplate: { kind: 'user' },
  ContentAnnotation: { kind: 'user', note: '另随 Content 级联' },
  AccountHealth: { kind: 'user' },
  UserNotification: { kind: 'user' },
  ABTest: { kind: 'user' },
  CompetitorMonitor: { kind: 'user' },
  ContentPrediction: { kind: 'user', note: '另随 Content 级联' },
  UserGamification: { kind: 'user' },
  UserPoints: { kind: 'user' },
  UserAchievement: { kind: 'user' },
  user_quests: { kind: 'user' },
  gamification_profiles: { kind: 'user' },
  PointsLog: { kind: 'cascade', note: 'UserPoints' },
  RedemptionRecord: { kind: 'cascade', note: 'UserPoints' },
  Content: { kind: 'tenant' },
  PlatformAccount: { kind: 'tenant', note: '含授权凭据' },
  PublishTemplate: { kind: 'tenant' },
  DailyReport: { kind: 'tenant' },
  Material: { kind: 'tenant' },
  MaterialFolder: { kind: 'tenant' },
  AIGeneration: { kind: 'tenant' },
  personas: { kind: 'tenant' },
  TeamTask: { kind: 'tenant' },
  ApiKey: { kind: 'tenant' },
  AccountStatsHistory: { kind: 'cascade', note: 'PlatformAccount' },
  PlatformContent: { kind: 'cascade', note: 'Content' },
  PublishTask: { kind: 'cascade', note: 'Content' },
  ContentStats: { kind: 'cascade', note: 'PublishTask' },
  ReviewLog: { kind: 'cascade', note: 'Content' },
  PaymentOrder: { kind: 'retained' },
  Subscription: { kind: 'retained' },
  PaymentWebhookEvent: { kind: 'retained' },
  UsageRecord: { kind: 'retained' },
  usage_meters: { kind: 'retained' },
  cost_ledger: { kind: 'retained' },
  ActivityLog: { kind: 'retained' },
  Reward: { kind: 'global', note: '积分商城商品定义' },
  Achievement: { kind: 'global', note: '成就定义' },
  quests: { kind: 'global', note: '任务定义' },
  HotTopic: { kind: 'global', note: '平台热点，公开数据' },
  ViralContent: { kind: 'global', note: '平台爆款库，公开数据' },
  ScheduledTaskQueue: { kind: 'global', note: '系统任务队列，无用户列（当前代码未使用）' },
};

/** 导出时不给的列：授权凭据、支付链接、幂等键。 */
const EXPORT_STRIP = ['auth_data_encrypted', 'auth_refresh_token_encrypted', 'payment_url', 'idempotency_key', 'token_hash'];
const EXPORT_ROW_LIMIT = 5000;

export interface ErasureResult {
  personalRows: number;
  workspaceDeleted: boolean;
  retained: string[];
}

@Injectable()
export class AccountErasureService {
  private readonly logger = new Logger(AccountErasureService.name);

  constructor(private readonly prisma: PrismaService) {}

  private get runner(): TxRunner {
    return this.prisma as unknown as TxRunner;
  }

  /** 有口令的账号必须再输一次口令，才允许做这件不可恢复的事。 */
  async assertPassword(userId: string, password?: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { password_hash: true, status: true },
    });
    if (!user || user.status !== 'active') throw new NotFoundException('账号不存在或已注销');
    if (user.password_hash) {
      const ok = !!password && (await bcrypt.compare(password, user.password_hash));
      if (!ok) throw new UnauthorizedException('密码不正确');
    }
  }

  async erase(userId: string): Promise<ErasureResult> {
    const result = await this.runner.$transaction(async (tx) => {
      const rows = await tx.$queryRawUnsafe<Array<{ id: string; tenant_id: string; role: string; status: string }>>(
        'SELECT id, tenant_id, role, status FROM "User" WHERE id = $1 FOR UPDATE',
        userId,
      );
      const me = rows[0];
      if (!me || me.status === 'deleted') throw new NotFoundException('账号不存在或已注销');

      // 锁住同工作区的所有在职成员再数，避免两个人同时注销都以为自己是「最后一个」
      const others = await tx.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT id FROM "User" WHERE tenant_id = $1 AND id <> $2 AND status = 'active' FOR UPDATE`,
        me.tenant_id,
        userId,
      );
      const soleMember = others.length === 0;
      if (!soleMember && me.role === 'owner') {
        throw new ConflictException({
          code: 'OWNER_HAS_MEMBERS',
          message: `工作区里还有 ${others.length} 位成员，请先转让所有权或移除成员，再注销账号`,
        });
      }

      let personalRows = 0;
      for (const { table, column } of USER_OWNED_TABLES) {
        personalRows += await tx.$executeRawUnsafe(`DELETE FROM "${table}" WHERE ${column} = $1`, userId);
      }

      if (soleMember) {
        for (const table of TENANT_OWNED_TABLES) {
          await tx.$executeRawUnsafe(`DELETE FROM "${table}" WHERE tenant_id = $1`, me.tenant_id);
        }
        // 没有人会再续费：进行中的订阅置为已取消（订单与订阅记录本身保留）
        await tx.$executeRawUnsafe(
          `UPDATE "Subscription" SET status = 'cancelled', cancel_at_period_end = TRUE, cancelled_at = NOW(), updated_at = NOW()
           WHERE tenant_id = $1 AND status = 'active'`,
          me.tenant_id,
        );
        await tx.$executeRawUnsafe(
          `UPDATE "Tenant" SET name = '已注销工作区', slug = 'deleted-' || id, logo_url = NULL,
             settings = '{}'::jsonb, status = 'deleted', updated_at = NOW() WHERE id = $1`,
          me.tenant_id,
        );
      }

      await tx.$executeRawUnsafe(
        `UPDATE "User" SET email = 'deleted-' || id || '@deleted.invalid', phone = NULL, password_hash = NULL,
           name = NULL, avatar_url = NULL, oauth_providers = '{}'::jsonb, preferences = '{}'::jsonb,
           permissions = '[]'::jsonb, email_verified = FALSE, phone_verified = FALSE,
           status = 'deleted', updated_at = NOW() WHERE id = $1`,
        userId,
      );

      return { personalRows, workspaceDeleted: soleMember, retained: RETAINED_TABLES.map((r) => r.table) };
    });
    this.logger.log(`account erased (workspaceDeleted=${result.workspaceDeleted})`);
    return result;
  }

  /** 本人的全部个人信息（JSON）。授权凭据、支付链接等不导出。 */
  async export(userId: string): Promise<Record<string, unknown>> {
    return this.runner.$transaction(async (tx) => {
      const rows = await tx.$queryRawUnsafe<any[]>(
        `SELECT to_jsonb(u) - 'password_hash' - 'oauth_providers' - 'permissions' AS row FROM "User" u
         WHERE id = $1 AND status <> 'deleted'`,
        userId,
      );
      if (!rows[0]) throw new NotFoundException('账号不存在或已注销');
      const account = rows[0].row;
      const tenantId: string = account.tenant_id;

      const strip = `ARRAY[${EXPORT_STRIP.map((s) => `'${s}'`).join(',')}]::text[]`;
      const select = async (table: string, where: string, ...params: unknown[]) => {
        const r = await tx.$queryRawUnsafe<any[]>(
          `SELECT to_jsonb(t) - ${strip} AS row FROM "${table}" t WHERE ${where} LIMIT ${EXPORT_ROW_LIMIT}`,
          ...params,
        );
        return r.map((x) => x.row);
      };

      const others = await tx.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT id FROM "User" WHERE tenant_id = $1 AND id <> $2 AND status = 'active'`,
        tenantId,
        userId,
      );
      const soleMember = others.length === 0;

      const personal: Record<string, unknown[]> = {};
      for (const { table, column } of USER_OWNED_TABLES) {
        personal[table] = await select(table, `${column} = $1`, userId);
      }
      // 工作区的业务数据：唯一成员时是「我的」，否则只给我创建的
      const scope = soleMember ? 'tenant_id = $1' : 'tenant_id = $1 AND created_by = $2';
      const params = soleMember ? [tenantId] : [tenantId, userId];
      const workspace: Record<string, unknown[]> = {
        contents: await select('Content', scope, ...params),
        platform_accounts: await select('PlatformAccount', scope, ...params),
        materials: await select('Material', scope, ...params),
        publish_templates: await select('PublishTemplate', scope, ...params),
      };
      if (soleMember) {
        workspace.ai_generations = await select('AIGeneration', 'tenant_id = $1', tenantId);
        workspace.publish_tasks = await select('PublishTask', 'tenant_id = $1', tenantId);
      } else {
        workspace.ai_generations = await select('AIGeneration', 'tenant_id = $1 AND user_id = $2', tenantId, userId);
      }
      const orders = soleMember ? await select('PaymentOrder', 'tenant_id = $1', tenantId) : [];

      return {
        account,
        personal,
        workspace,
        orders,
        exported_at: new Date().toISOString(),
        export_format: 'json',
      };
    });
  }
}
