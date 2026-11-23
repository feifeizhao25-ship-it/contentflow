import { WebhookService } from './webhook.service';
import { RetryableWebhookDnsError, assertPublicWebhookDestination, resolveWebhookAddresses } from './webhook-delivery';
import { auditWebhookSubscriptions } from './webhook-audit';
import { main as auditMain } from '../../../scripts/audit-webhook-destinations';
import * as path from 'path';

process.env.WEBHOOK_ENCRYPTION_KEY = 'a'.repeat(64);
const err = (code: string) => Object.assign(new Error(code), { code });

// 全部用假 DNS，不发真实请求。
describe('SEC-11 后续：创建时 DNS 暂时故障与 NXDOMAIN 分开处理', () => {
  it('SERVFAIL / EAI_AGAIN 重试一次后成功就放行', async () => {
    const lookup = jest.fn().mockRejectedValueOnce(err('ESERVFAIL')).mockResolvedValueOnce([{ address: '8.8.8.8', family: 4 }]);
    await expect(assertPublicWebhookDestination('https://hooks.example.com/h', lookup)).resolves.toBeInstanceOf(URL);
    expect(lookup).toHaveBeenCalledTimes(2);
  });
  it('连续两次暂时故障：抛可重试错误，只试两次', async () => {
    const lookup = jest.fn().mockRejectedValue(err('EAI_AGAIN'));
    await expect(resolveWebhookAddresses('hooks.example.com', lookup)).rejects.toBeInstanceOf(RetryableWebhookDnsError);
    expect(lookup).toHaveBeenCalledTimes(2);
  });
  it('超时（1 秒没有回应）也算暂时故障', async () => {
    jest.useFakeTimers();
    try {
      const lookup = jest.fn(() => new Promise<never>(() => undefined));
      const p = resolveWebhookAddresses('slow.example', lookup).catch((e) => e);
      await jest.advanceTimersByTimeAsync(1000 + 150 + 1000 + 10);
      expect(await p).toBeInstanceOf(RetryableWebhookDnsError);
      expect(lookup).toHaveBeenCalledTimes(2);
    } finally {
      jest.useRealTimers();
    }
  });
  it('NXDOMAIN（ENOTFOUND / ENODATA）不重试，直接拒绝', async () => {
    for (const code of ['ENOTFOUND', 'ENODATA']) {
      const lookup = jest.fn().mockRejectedValue(err(code));
      await expect(resolveWebhookAddresses('nope.example', lookup)).rejects.toThrow('无法解析');
      expect(lookup).toHaveBeenCalledTimes(1);
    }
  });
  it('解析到内网地址：不重试，直接拒绝', async () => {
    const lookup = jest.fn().mockResolvedValue([{ address: '10.0.0.1', family: 4 }]);
    await expect(assertPublicWebhookDestination('https://intra.example/h', lookup)).rejects.toThrow('本机、内网或保留地址');
    expect(lookup).toHaveBeenCalledTimes(1);
  });
  it('创建接口：暂时故障返回 503 + retryable，NXDOMAIN 返回 400，都不落库', async () => {
    const created: any[] = [];
    const prisma: any = {
      tenant: { findUnique: async () => ({ plan: 'enterprise', plan_expires_at: null, limits: {} }) },
      webhookSubscription: { create: async (x: any) => { created.push(x); return { id: 'w', ...x.data }; } },
    };
    const flaky = new WebhookService(prisma, { lookup: jest.fn().mockRejectedValue(err('ESERVFAIL')) });
    const r1 = await flaky.create('t', { url: 'https://hooks.example.com/h', events: ['content.generated'] }).catch((e) => e);
    expect(r1.getStatus()).toBe(503);
    expect(r1.getResponse()).toMatchObject({ retryable: true });
    expect(String(r1.getResponse().message)).toContain('请稍后重试');
    const gone = new WebhookService(prisma, { lookup: jest.fn().mockRejectedValue(err('ENOTFOUND')) });
    await expect(gone.create('t', { url: 'https://gone.example/h', events: ['content.generated'] })).rejects.toMatchObject({ status: 400 });
    expect(created).toEqual([]);
  });
});

const DNS: Record<string, any> = {
  'hooks.example.com': [{ address: '93.184.215.14', family: 4 }],
  'localtest.me': [{ address: '127.0.0.1', family: 4 }],
  'rebind.example': [{ address: '93.184.215.14', family: 4 }, { address: '10.0.0.5', family: 4 }],
  'v6-local.example': [{ address: 'fd00::1', family: 6 }],
};
const fixtureLookup = async (host: string) => {
  if (host === 'flaky.example') throw err('ESERVFAIL');
  if (!DNS[host]) throw err('ENOTFOUND');
  return DNS[host];
};

describe('只读审计脚本：列出已存订阅里指向非公网的条目（本地样例，不连库）', () => {
  it('按原因分类，不输出 URL 路径', async () => {
    const rows = require('./__fixtures__/webhook-audit-rows.json');
    const findings = await auditWebhookSubscriptions(rows, fixtureLookup);
    const byId = Object.fromEntries(findings.map((f) => [f.id, f.reason]));
    expect(byId).toEqual({
      'w-localtest': 'private_or_reserved_address',
      'w-rebind': 'private_or_reserved_address',
      'w-v6': 'private_or_reserved_address',
      'w-mapped-literal': 'blocked_host',
      'w-gone': 'nxdomain',
      'w-flaky': 'dns_temporarily_unavailable',
      'w-http': 'not_https',
      'w-bad': 'invalid_url',
    });
    expect(findings.find((f) => f.id === 'w-rebind')!.addresses).toEqual(['10.0.0.5']);
    expect(JSON.stringify(findings)).not.toContain('token=');
  });
  it('CLI：--fixture 读本地文件；不给参数或 --from-db 没有只读确认时拒绝运行', async () => {
    const write = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    try {
      const findings = await auditMain(['--fixture', path.join(__dirname, '__fixtures__/webhook-audit-rows.json')], fixtureLookup);
      expect(findings).toHaveLength(8);
      const out = JSON.parse(String(write.mock.calls[0][0]));
      expect(out).toMatchObject({ checked: 10, flagged: 8 });
      delete process.env.AUDIT_WEBHOOKS_READONLY;
      await expect(auditMain(['--from-db'], fixtureLookup)).rejects.toThrow('AUDIT_WEBHOOKS_READONLY');
      await expect(auditMain([], fixtureLookup)).rejects.toThrow('用法');
    } finally {
      write.mockRestore();
    }
  });
});
