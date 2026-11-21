import { WebhookService } from './webhook.service';
process.env.WEBHOOK_ENCRYPTION_KEY = 'a'.repeat(64);
// 测试里不做真实 DNS：按表返回，表里没有的域名当作解析失败。
const DNS: Record<string, Array<{ address: string; family: number }>> = {
  'example.com': [{ address: '93.184.215.14', family: 4 }],
  'localtest.me': [{ address: '127.0.0.1', family: 4 }],
  'rebind.example': [{ address: '93.184.215.14', family: 4 }, { address: '10.0.0.5', family: 4 }],
  'meta.example': [{ address: '169.254.169.254', family: 4 }],
  'v6-local.example': [{ address: 'fd00::1', family: 6 }],
  'mapped.example': [{ address: '::ffff:7f00:1', family: 6 }],
  'cgnat.example': [{ address: '100.64.0.1', family: 4 }],
  'testnet.example': [{ address: '203.0.113.7', family: 4 }],
};
const fakeLookup = jest.fn(async (host: string) => {
  if (!DNS[host]) throw Object.assign(new Error(`getaddrinfo ENOTFOUND ${host}`), { code: 'ENOTFOUND' });
  return DNS[host];
});
function svc(plan: string, created: any[] = []) {
  const prisma: any = {
    tenant: { findUnique: async () => ({ plan, plan_expires_at: null, limits: {} }) },
    webhookSubscription: { create: async (x: any) => { created.push(x.data); return { id: 'w1', ...x.data }; }, findMany: async () => [], findFirst: async () => null },
  };
  return new WebhookService(prisma, { lookup: fakeLookup });
}
describe('Webhook 商务版门禁（定稿）', () => {
  it('非商务版拒绝创建', async () => {
    await expect(svc('team').create('t1', { url: 'https://example.com/h', events: ['content.generated'] })).rejects.toMatchObject({ status: 403 });
  });
  it('商务版可创建且密钥只返回一次明文', async () => {
    const r: any = await svc('enterprise').create('t1', { url: 'https://example.com/h', events: ['content.generated'] });
    expect(r.secret).toMatch(/^whsec_/); expect(r.url).toContain('example.com');
  });
  it('非商务版列表也关闭', async () => {
    await expect(svc('free').list('t1')).rejects.toMatchObject({ status: 403 });
  });
  it('拒绝指向本机或内网的地址', async () => {
    const business = svc('enterprise');
    for (const url of ['http://example.com/h', 'https://127.0.0.1/h', 'https://10.1.2.3/h', 'https://169.254.169.254/latest', 'https://localhost/h', 'https://user:pass@example.com/h']) {
      await expect(business.create('t1', { url, events: ['content.generated'] })).rejects.toMatchObject({ status: 400 });
    }
  });
  it('降级或非商务版即使库里有订阅也不投递', async () => {
    const request = jest.fn();
    const prisma: any = {
      tenant: { findUnique: async () => ({ plan: 'team', plan_expires_at: null, limits: {} }) },
      webhookSubscription: { findMany: async () => [{ id: 'w', url: 'https://example.com/h', events: ['content.generated'], secret_cipher: 'x', status: 'active' }] },
    };
    await new WebhookService(prisma, { request }).dispatch('t1', 'content.generated', { ok: true });
    expect(request).not.toHaveBeenCalled();
  });
  it('SEC-11：创建时解析域名，解析到本机、内网、链路本地或保留地址就拒绝且不落库', async () => {
    for (const host of ['localtest.me', 'rebind.example', 'meta.example', 'v6-local.example', 'mapped.example', 'cgnat.example', 'testnet.example']) {
      const created: any[] = [];
      await expect(svc('enterprise', created).create('t1', { url: `https://${host}/h`, events: ['content.generated'] }))
        .rejects.toMatchObject({ status: 400 });
      expect(created).toEqual([]);
    }
  });
  it('SEC-11：域名解析失败也拒绝创建', async () => {
    await expect(svc('enterprise').create('t1', { url: 'https://no-such-host.example/h', events: ['content.generated'] }))
      .rejects.toMatchObject({ status: 400, message: expect.stringContaining('无法解析') });
  });
  it('SEC-11：公网域名照常创建，创建时查的是 URL 里的主机名', async () => {
    fakeLookup.mockClear();
    const created: any[] = [];
    const r: any = await svc('enterprise', created).create('t1', { url: 'https://example.com:8443/h?x=1', events: ['content.generated'] });
    expect(r.id).toBe('w1');
    expect(fakeLookup).toHaveBeenCalledWith('example.com');
    expect(created).toHaveLength(1);
  });
  it('SEC-11：IPv6 字面量写成十六进制的 IPv4 映射也拒绝（URL 会把 ::ffff:127.0.0.1 改写成 ::ffff:7f00:1）', async () => {
    for (const url of ['https://[::ffff:127.0.0.1]/h', 'https://[::ffff:a9fe:a9fe]/h', 'https://[::127.0.0.1]/h', 'https://[64:ff9b::a00:1]/h', 'https://[fe80::1]/h', 'https://0x7f.1/h', 'https://2130706433/h', 'https://localhost./h']) {
      await expect(svc('enterprise').create('t1', { url, events: ['content.generated'] })).rejects.toMatchObject({ status: 400 });
    }
  });
});
