import { signWebhookPayload, deliverWebhook, encryptSecret, decryptSecret, sendPinnedHttps } from './webhook-delivery';
describe('webhook（批2）', () => {
  it('签名可复算且密钥加解密往返', () => {
    expect(signWebhookPayload('s', 'abc')).toMatch(/^sha256=[0-9a-f]{64}$/);
    process.env.WEBHOOK_ENCRYPTION_KEY = 'a'.repeat(64);
    const c = encryptSecret('whsec_test'); expect(c).not.toContain('whsec_test'); expect(decryptSecret(c)).toBe('whsec_test');
  });
  it('投递连到已校验的公网 IP，Host 和 SNI 仍是原域名，失败不抛', async () => {
    const calls: any[] = [];
    const lookup = jest.fn(async () => [{ address: '1.1.1.1', family: 4 }]);
    const request = jest.fn(async (opts: any) => { calls.push(opts); return { statusCode: 200 }; });
    const ok = await deliverWebhook({ url: 'https://example.com/h', secret: 's' }, 'content.generated', { id: 1 }, { lookup, request });
    expect(ok.ok).toBe(true);
    expect(calls[0].ip).toBe('1.1.1.1');
    expect(calls[0].hostname).toBe('example.com');
    expect(calls[0].hostHeader).toBe('example.com');
    expect(calls[0].headers['X-ContentFlow-Event']).toBe('content.generated');
    expect(calls[0].headers['X-ContentFlow-Signature']).toBe(signWebhookPayload('s', calls[0].body));
    lookup.mockResolvedValue([{ address: '127.0.0.1', family: 4 }]);
    const blocked = await deliverWebhook({ url: 'https://example.com/h', secret: 's' }, 'content.generated', {}, { lookup, request });
    expect(blocked.ok).toBe(false);
    expect(request).toHaveBeenCalledTimes(1);
    const down = await deliverWebhook({ url: 'https://example.com/h', secret: 's' }, 'content.generated', {}, { lookup: async () => [{ address: '1.1.1.1', family: 4 }], request: async () => { throw new Error('down'); } });
    expect(down.ok).toBe(false);
  });
  it('解析结果里只要有内网、元数据或映射地址就拒绝，并且不跟随重定向', async () => {
    const request = jest.fn(async () => ({ statusCode: 302 }));
    for (const address of ['10.1.2.3', '169.254.169.254', '::ffff:127.0.0.1', 'fd00::1']) {
      const blocked = await deliverWebhook({ url: 'https://hooks.example.com/h', secret: 's' }, 'content.generated', {}, {
        lookup: async () => [{ address: '8.8.8.8', family: 4 }, { address, family: address.includes(':') ? 6 : 4 }],
        request,
      });
      expect(blocked.ok).toBe(false);
    }
    expect(request).not.toHaveBeenCalled();
    const redirect = await deliverWebhook({ url: 'https://hooks.example.com/h', secret: 's' }, 'content.generated', {}, {
      lookup: async () => [{ address: '8.8.8.8', family: 4 }],
      request,
    });
    expect(redirect).toMatchObject({ ok: false, status: 302 });
    expect(request).toHaveBeenCalledTimes(1);
  });
  it('默认 HTTPS 请求连到指定 IP，SNI 和 Host 用原域名', async () => {
    const seen: any[] = [];
    const requestImpl = ((options: any, cb: (res: { statusCode: number; resume: () => void }) => void) => {
      seen.push(options);
      cb({ statusCode: 204, resume() {} });
      return { on() { return this; }, write() {}, end() {}, destroy() {} };
    }) as any;
    const result = await sendPinnedHttps({
      ip: '8.8.8.8', family: 4, hostname: 'hooks.example.com', hostHeader: 'hooks.example.com',
      port: 443, path: '/h', headers: { 'Content-Type': 'application/json' }, body: '{}', timeoutMs: 5000,
    }, requestImpl);
    expect(result.statusCode).toBe(204);
    expect(seen[0].host).toBe('8.8.8.8');
    expect(seen[0].servername).toBe('hooks.example.com');
    expect(seen[0].headers.Host).toBe('hooks.example.com');
    await new Promise<void>((resolve, reject) => {
      seen[0].lookup('hooks.example.com', {}, (err: Error | null, address: string) => {
        if (err) reject(err);
        else {
          expect(address).toBe('8.8.8.8');
          resolve();
        }
      });
    });
  });
});
