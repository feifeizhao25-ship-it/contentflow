import { WebhookService } from './webhook.service';
process.env.WEBHOOK_ENCRYPTION_KEY = 'a'.repeat(64);
function svc(plan: string) {
  const prisma: any = {
    tenant: { findUnique: async () => ({ plan, plan_expires_at: null, limits: {} }) },
    webhookSubscription: { create: async (x: any) => ({ id: 'w1', ...x.data }), findMany: async () => [], findFirst: async () => null },
  };
  return new WebhookService(prisma);
}
describe('Webhook Business 门禁（定稿）', () => {
  it('非 Business 拒绝创建', async () => {
    await expect(svc('team').create('t1', { url: 'https://example.com/h', events: ['content.generated'] })).rejects.toMatchObject({ status: 403 });
  });
  it('Business 可创建且密钥只返回一次明文', async () => {
    const r: any = await svc('enterprise').create('t1', { url: 'https://example.com/h', events: ['content.generated'] });
    expect(r.secret).toMatch(/^whsec_/); expect(r.url).toContain('example.com');
  });
  it('非 Business 列表也关闭', async () => {
    await expect(svc('free').list('t1')).rejects.toMatchObject({ status: 403 });
  });
});
