import { assertPublicWebhookDestination, deliverWebhook, isBlockedWebhookAddress, isBlockedWebhookHost, parseIpv6 } from './webhook-delivery';

// SEC-11：地址分类表。只用字面量和假 DNS，不发真实请求。
describe('Webhook 地址分类（SEC-11）', () => {
  it.each([
    '0.0.0.0', '10.0.0.1', '100.64.0.1', '127.0.0.1', '169.254.169.254', '172.16.0.1', '172.31.255.255',
    '192.0.0.8', '192.0.2.1', '192.88.99.1', '192.168.1.1', '198.18.0.1', '198.19.255.1', '198.51.100.1', '203.0.113.1',
    '224.0.0.1', '240.0.0.1', '255.255.255.255',
    '::', '::1', '::127.0.0.1', '::7f00:1', '::ffff:127.0.0.1', '::ffff:7f00:1', '::ffff:a9fe:a9fe', '::ffff:0:a00:1',
    '64:ff9b::a00:1', '64:ff9b:1::1', '100::1', '2001::1', '2001:2::1', '2001:db8::1', '2002:a00:1::1', '2002:7f00:1::',
    '3fff::1', 'fc00::1', 'fd12:3456::1', 'fe80::1', 'fe80::1%eth0', 'febf::1', 'fec0::1', 'ff02::1', 'not-an-ip:zz',
  ])('拒绝 %s', (address) => {
    expect(isBlockedWebhookAddress(address)).toBe(true);
  });

  it.each(['1.1.1.1', '8.8.8.8', '93.184.215.14', '172.32.0.1', '100.128.0.1', '2606:4700:4700::1111', '2001:4860:4860::8888', '::ffff:8.8.8.8', '2002:808:808::1'])(
    '放行公网 %s', (address) => {
      expect(isBlockedWebhookAddress(address)).toBe(false);
    },
  );

  it('IPv6 展开', () => {
    expect(parseIpv6('::ffff:127.0.0.1')).toEqual([0, 0, 0, 0, 0, 0xffff, 0x7f00, 1]);
    expect(parseIpv6('[2001:db8::1]')).toEqual([0x2001, 0xdb8, 0, 0, 0, 0, 0, 1]);
    expect(parseIpv6('1::2::3')).toBeNull();
    expect(parseIpv6('1:2:3:4:5:6:7:8:9')).toBeNull();
  });

  it('主机名末尾带点也按原名判断', () => {
    expect(isBlockedWebhookHost('localhost.')).toBe(true);
    expect(isBlockedWebhookHost('metadata.google.internal.')).toBe(true);
  });

  it('创建时检查：localtest.me 解析到 127.0.0.1 被拒，公网放行，IP 字面量不查 DNS', async () => {
    const lookup = jest.fn(async (host: string) => (host === 'localtest.me' ? [{ address: '127.0.0.1', family: 4 }] : [{ address: '8.8.8.8', family: 4 }]));
    await expect(assertPublicWebhookDestination('https://localtest.me/h', lookup)).rejects.toThrow('本机、内网或保留地址');
    await expect(assertPublicWebhookDestination('https://hooks.example.com/h', lookup)).resolves.toBeInstanceOf(URL);
    lookup.mockClear();
    await expect(assertPublicWebhookDestination('https://8.8.8.8/h', lookup)).resolves.toBeInstanceOf(URL);
    expect(lookup).not.toHaveBeenCalled();
    await expect(assertPublicWebhookDestination('https://[::ffff:7f00:1]/h', lookup)).rejects.toThrow();
    await expect(assertPublicWebhookDestination('https://empty.example/h', async () => [])).rejects.toThrow('无法解析');
  });

  it('投递时检查保留：创建后改指到内网仍拒绝，十六进制映射的字面量也拒绝', async () => {
    const request = jest.fn(async () => ({ statusCode: 200 }));
    const rebound = await deliverWebhook({ url: 'https://hooks.example.com/h', secret: 's' }, 'content.generated', {}, {
      lookup: async () => [{ address: '127.0.0.1', family: 4 }], request,
    });
    expect(rebound.ok).toBe(false);
    const literal = await deliverWebhook({ url: 'https://[::ffff:127.0.0.1]/h', secret: 's' }, 'content.generated', {}, {
      lookup: async (host: string) => [{ address: host.replace(/^\[|\]$/g, ''), family: 6 }], request,
    });
    expect(literal.ok).toBe(false);
    expect(request).not.toHaveBeenCalled();
  });
});
