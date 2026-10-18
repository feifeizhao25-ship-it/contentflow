import { signWebhookPayload, deliverWebhook, encryptSecret, decryptSecret } from './webhook-delivery';
describe('webhook（批2）', () => {
  it('签名可复算且密钥加解密往返', () => {
    expect(signWebhookPayload('s', 'abc')).toMatch(/^sha256=[0-9a-f]{64}$/);
    process.env.WEBHOOK_ENCRYPTION_KEY = 'a'.repeat(64);
    const c = encryptSecret('whsec_test'); expect(c).not.toContain('whsec_test'); expect(decryptSecret(c)).toBe('whsec_test');
  });
  it('投递带事件与签名头，失败不抛', async () => {
    const okFetch: any = async (_u: string, init: any) => { expect(init.headers['X-ContentFlow-Event']).toBe('content.generated'); expect(init.headers['X-ContentFlow-Signature']).toMatch(/^sha256=/); return { ok: true, status: 200 }; };
    expect((await deliverWebhook(okFetch, { url: 'https://example.com/h', secret: 's' }, 'content.generated', { id: 1 })).ok).toBe(true);
    const badFetch: any = async () => { throw new Error('down'); };
    expect((await deliverWebhook(badFetch, { url: 'https://example.com/h', secret: 's' }, 'content.generated', {})).ok).toBe(false);
  });
});
