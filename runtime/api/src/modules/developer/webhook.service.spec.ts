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
  it('拒绝指向本机或内网的地址', async () => {
    const business = svc('enterprise');
    for (const url of ['http://example.com/h', 'https://127.0.0.1/h', 'https://10.1.2.3/h', 'https://169.254.169.254/latest', 'https://localhost/h', 'https://user:pass@example.com/h']) {
      await expect(business.create('t1', { url, events: ['content.generated'] })).rejects.toMatchObject({ status: 400 });
    }
  });
  it('降级或非 Business 即使库里有订阅也不投递', async () => {
    const request = jest.fn();
    const prisma: any = {
      tenant: { findUnique: async () => ({ plan: 'team', plan_expires_at: null, limits: {} }) },
      webhookSubscription: { findMany: async () => [{ id: 'w', url: 'https://example.com/h', events: ['content.generated'], secret_cipher: 'x', status: 'active' }] },
    };
    await new WebhookService(prisma, { request }).dispatch('t1', 'content.generated', { ok: true });
    expect(request).not.toHaveBeenCalled();
  });
});
