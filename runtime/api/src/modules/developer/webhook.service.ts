import { BadRequestException, ForbiddenException, Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { effectiveEntitlements } from '../billing/effective-limits';
import * as crypto from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { WEBHOOK_EVENTS, WebhookDeliveryDeps, assertPublicHttpsWebhookUrl, decryptSecret, deliverWebhook, encryptSecret } from './webhook-delivery';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);
  private readonly delivery: WebhookDeliveryDeps;
  // 第二个参数只给测试替换投递。Nest 不能把这个对象类型当成依赖，否则进程起不来。
  constructor(
    private readonly prisma: PrismaService,
    @Optional() @Inject('WEBHOOK_DELIVERY') delivery?: WebhookDeliveryDeps,
  ) {
    this.delivery = delivery ?? {};
  }
  private db() { return (this.prisma as any).webhookSubscription; }

  /** 定稿（2026-10-18）：Webhook 订阅仅商务版（plan=enterprise）开放，其余档关闭；过期按免费档处理。 */
  private async businessPlan(tenantId: string): Promise<boolean> {
    const tenant = await (this.prisma as any).tenant.findUnique({ where: { id: tenantId } });
    return effectiveEntitlements(tenant ?? { plan: 'free' }).plan === 'enterprise';
  }
  private async assertBusiness(tenantId: string) {
    if (!(await this.businessPlan(tenantId))) throw new ForbiddenException('Webhook 订阅仅商务版开放，请升级后使用');
  }
  async create(tenantId: string, body: { url?: string; events?: string[] }) {
    await this.assertBusiness(tenantId);
    const url = String(body?.url ?? '').trim();
    try { assertPublicHttpsWebhookUrl(url); } catch (e: any) { throw new BadRequestException(e?.message || 'Webhook 地址格式不正确'); }
    const events = [...new Set(body?.events ?? [])].filter((e) => (WEBHOOK_EVENTS as readonly string[]).includes(e));
    if (!events.length) throw new BadRequestException(`至少选择一个事件：${WEBHOOK_EVENTS.join(' / ')}`);
    const secret = 'whsec_' + crypto.randomBytes(24).toString('hex');
    let secretCipher: string;
    try { secretCipher = encryptSecret(secret); } catch (e: any) { throw new BadRequestException(e.message); }
    const sub = await this.db().create({ data: { tenant_id: tenantId, url, events, secret_cipher: secretCipher, status: 'active' } });
    // 签名密钥只在创建时明文返回一次，库里只存密文
    return { id: sub.id, url: sub.url, events: sub.events, status: sub.status, secret, secret_note: '签名密钥只显示这一次，请存入你的密钥管理；后续投递以 X-ContentFlow-Signature 验签。' };
  }
  async list(tenantId: string) {
    await this.assertBusiness(tenantId);
    const rows = await this.db().findMany({ where: { tenant_id: tenantId }, orderBy: { created_at: 'desc' } });
    return rows.map((r: any) => ({ id: r.id, url: r.url, events: r.events, status: r.status, created_at: r.created_at }));
  }
  async remove(tenantId: string, id: string) {
    await this.assertBusiness(tenantId);
    const r = await this.db().findFirst({ where: { id, tenant_id: tenantId } });
    if (!r) throw new BadRequestException('订阅不存在');
    await this.db().delete({ where: { id } });
    return { removed: true, id };
  }
  /** 事件投递：失败只记日志，不阻断主流程（生成/发布）。 */
  async dispatch(tenantId: string, event: string, payload: unknown): Promise<void> {
    try {
      if (!(await this.businessPlan(tenantId))) return;
      const rows = await this.db().findMany({ where: { tenant_id: tenantId, status: 'active' } });
      for (const r of rows ?? []) {
        if (!(Array.isArray(r.events) && r.events.includes(event))) continue;
        const res = await deliverWebhook({ url: r.url, secret: decryptSecret(r.secret_cipher) }, event, payload, this.delivery);
        if (!res.ok) this.logger.warn(`webhook ${r.id} ${event} failed: ${res.error ?? res.status}`);
      }
    } catch (e: any) { this.logger.warn(`webhook dispatch failed: ${e?.message ?? e}`); }
  }
}
