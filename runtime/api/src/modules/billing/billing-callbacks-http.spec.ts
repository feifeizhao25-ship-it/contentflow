/**
 * 支付回调的 HTTP 层：真实 configureApp（校验管道、异常过滤器、响应包装），真实验签与解密，
 * 只把 markPaid / markRefunded 换成桩。直接调控制器方法的测试看不到这一层：
 *   - 支付宝通知是 application/x-www-form-urlencoded，应答必须是纯文本 success，不能被包装成 JSON；
 *   - 微信签名是对「原始请求体字节」做的，必须能拿到 rawBody；
 *   - 验签失败 / 内容无效必须是 4xx（平台会重试），不能是 500，更不能放行。
 */
import { createCipheriv, createHmac, createSign, generateKeyPairSync } from 'crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const request = require('supertest');
import { configureApp } from '../../bootstrap';
import { PrismaService } from '../../database/prisma.service';
import { canonicalAlipayParams } from './alipay.adapter';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';

describe('支付回调（HTTP 层）', () => {
  let app: INestApplication;
  const billing = { markPaid: jest.fn(), markRefunded: jest.fn() };
  const env = { ...process.env };

  const alipayKeys = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const wechatPlatform = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const apiV3Key = '12345678901234567890123456789012';
  const CALLBACK_SECRET = 'callback-secret-that-is-at-least-32-chars';

  beforeEach(async () => {
    jest.resetAllMocks();
    billing.markPaid.mockResolvedValue({ duplicate: false });
    billing.markRefunded.mockResolvedValue({ status: 'refunded' });
    Object.assign(process.env, {
      ALIPAY_APP_ID: '2026000000000000',
      ALIPAY_SELLER_ID: 'seller-1',
      ALIPAY_PUBLIC_KEY: alipayKeys.publicKey.export({ type: 'spki', format: 'pem' }).toString(),
      WECHAT_PAY_MCH_ID: '1900000109',
      WECHAT_PAY_APP_ID: 'wx2026000000000000',
      WECHAT_PAY_API_V3_KEY: apiV3Key,
      WECHAT_PAY_PLATFORM_PUBLIC_KEY: wechatPlatform.publicKey.export({ type: 'spki', format: 'pem' }).toString(),
      WECHAT_PAY_PLATFORM_SERIAL_NO: 'PLATFORMSERIAL',
      PAYMENT_CALLBACK_SECRET: CALLBACK_SECRET,
    });
    const moduleRef = await Test.createTestingModule({
      controllers: [BillingController],
      providers: [
        { provide: BillingService, useValue: billing },
        { provide: PrismaService, useValue: {} },
      ],
    }).compile();
    app = moduleRef.createNestApplication({ rawBody: true }); // 与 main.ts 一致
    configureApp(app, []);
    await app.init();
  });
  afterEach(async () => {
    await app.close();
    process.env = { ...env };
  });

  describe('支付宝 /billing/callbacks/alipay', () => {
    const notify = (over: Record<string, string> = {}, sign = true) => {
      const body: Record<string, string> = {
        app_id: process.env.ALIPAY_APP_ID!, seller_id: 'seller-1', out_trade_no: 'CF1001', trade_no: 'ALI1001',
        trade_status: 'TRADE_SUCCESS', total_amount: '128.00', ...over,
      };
      if (sign) {
        const signer = createSign('RSA-SHA256');
        signer.update(canonicalAlipayParams(body)); signer.end();
        body.sign = signer.sign(alipayKeys.privateKey, 'base64');
        body.sign_type = 'RSA2';
      }
      return body;
    };
    const post = (body: Record<string, string>) =>
      request(app.getHttpServer()).post('/api/v1/billing/callbacks/alipay').type('form').send(body);

    it('表单格式的合法通知：应答是纯文本 success（不是 JSON 包装），并入账一次', async () => {
      const res = await post(notify());
      expect(res.status).toBe(200);
      expect(res.text).toBe('success');
      expect(res.headers['content-type']).toMatch(/text\/plain/);
      expect(billing.markPaid).toHaveBeenCalledTimes(1);
      expect(billing.markPaid).toHaveBeenCalledWith(expect.objectContaining({ orderNo: 'CF1001', provider: 'alipay', paidAmount: 128 }));
    });

    it('金额被改（签名对不上）：401，不入账', async () => {
      const body = notify();
      body.total_amount = '0.01';
      expect((await post(body)).status).toBe(401);
      expect(billing.markPaid).not.toHaveBeenCalled();
    });

    it('没有签名 / 签名是乱码：401，不入账', async () => {
      expect((await post(notify({}, false))).status).toBe(401);
      expect((await post({ ...notify(), sign: 'not-base64-!!' })).status).toBe(401);
      expect(billing.markPaid).not.toHaveBeenCalled();
    });

    it('签名正确但 app_id 不是我们的：401', async () => {
      expect((await post(notify({ app_id: '2099999999999999' }))).status).toBe(401);
      expect(billing.markPaid).not.toHaveBeenCalled();
    });

    it('交易未成功（TRADE_CLOSED / WAIT_BUYER_PAY）：应答 success 让平台停止重试，但不入账', async () => {
      for (const trade_status of ['TRADE_CLOSED', 'WAIT_BUYER_PAY']) {
        const res = await post(notify({ trade_status }));
        expect(res.status).toBe(200);
        expect(res.text).toBe('success');
      }
      expect(billing.markPaid).not.toHaveBeenCalled();
    });

    it('验签通过但入账失败（例如金额与订单不符）：错误状态码，平台会重试，不应答 success', async () => {
      billing.markPaid.mockRejectedValueOnce(Object.assign(new Error('x'), { status: 400 }));
      const res = await post(notify());
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.text).not.toBe('success');
    });
  });

  describe('微信支付 /billing/callbacks/wechat', () => {
    const transaction = (over: Record<string, unknown> = {}) => ({
      mchid: process.env.WECHAT_PAY_MCH_ID, appid: process.env.WECHAT_PAY_APP_ID,
      out_trade_no: 'CF1001', transaction_id: 'WX1001', trade_state: 'SUCCESS',
      amount: { total: 12800, currency: 'CNY' }, ...over,
    });
    const encrypt = (tx: unknown) => {
      const nonce = Buffer.from('notifyNonce1');
      const aad = Buffer.from('transaction');
      const cipher = createCipheriv('aes-256-gcm', Buffer.from(apiV3Key), nonce);
      cipher.setAAD(aad);
      const encrypted = Buffer.concat([cipher.update(JSON.stringify(tx)), cipher.final(), cipher.getAuthTag()]);
      return { algorithm: 'AEAD_AES_256_GCM', ciphertext: encrypted.toString('base64'), nonce: nonce.toString(), associated_data: aad.toString() };
    };
    const send = (rawBody: string, opts: { ts?: string; serial?: string; tamper?: boolean } = {}) => {
      const timestamp = opts.ts ?? String(Math.floor(Date.now() / 1000));
      const nonce = 'notify-nonce';
      const signer = createSign('RSA-SHA256');
      signer.update(`${timestamp}\n${nonce}\n${rawBody}\n`); signer.end();
      return request(app.getHttpServer())
        .post('/api/v1/billing/callbacks/wechat')
        .set('content-type', 'application/json')
        .set('wechatpay-serial', opts.serial ?? 'PLATFORMSERIAL')
        .set('wechatpay-timestamp', timestamp)
        .set('wechatpay-nonce', nonce)
        .set('wechatpay-signature', opts.tamper ? 'AAAA' : signer.sign(wechatPlatform.privateKey, 'base64'))
        .send(rawBody);
    };
    const body = (tx: unknown = transaction()) => JSON.stringify({ id: 'evt-1', resource: encrypt(tx) });

    it('合法通知（签名对原始字节、AES-GCM 解密）：入账，金额按分换算为元', async () => {
      const res = await send(body());
      expect(res.status).toBe(200);
      expect(billing.markPaid).toHaveBeenCalledWith(expect.objectContaining({
        orderNo: 'CF1001', provider: 'wechat', providerOrderNo: 'WX1001', paidAmount: 128,
      }));
    });

    it('同一份通知重复到达：每次都交给 markPaid，由它按事件号幂等（控制器自己不吞）', async () => {
      const raw = body();
      await send(raw); await send(raw);
      expect(billing.markPaid).toHaveBeenCalledTimes(2);
      expect(billing.markPaid.mock.calls[0][0].providerEventId).toBe(billing.markPaid.mock.calls[1][0].providerEventId);
    });

    it('签名错 / 序列号不是我们的 / 时间戳过期（防重放）：401，不入账', async () => {
      expect((await send(body(), { tamper: true })).status).toBe(401);
      expect((await send(body(), { serial: 'OTHERSERIAL' })).status).toBe(401);
      expect((await send(body(), { ts: String(Math.floor(Date.now() / 1000) - 3600) })).status).toBe(401);
      expect(billing.markPaid).not.toHaveBeenCalled();
    });

    it('签名对、内容被换（签的是原文，发的是改过的字节）：401', async () => {
      const raw = body();
      const timestamp = String(Math.floor(Date.now() / 1000));
      const signer = createSign('RSA-SHA256');
      signer.update(`${timestamp}\nn\n${raw}\n`); signer.end();
      const res = await request(app.getHttpServer())
        .post('/api/v1/billing/callbacks/wechat').set('content-type', 'application/json')
        .set('wechatpay-serial', 'PLATFORMSERIAL').set('wechatpay-timestamp', timestamp).set('wechatpay-nonce', 'n')
        .set('wechatpay-signature', signer.sign(wechatPlatform.privateKey, 'base64'))
        .send(raw.replace('evt-1', 'evt-2'));
      expect(res.status).toBe(401);
      expect(billing.markPaid).not.toHaveBeenCalled();
    });

    it('商户号 / 应用号不是我们的、或密文被破坏：4xx（不是 500），不入账', async () => {
      const wrongMerchant = await send(body(transaction({ mchid: '1999999999' })));
      expect(wrongMerchant.status).toBeGreaterThanOrEqual(400);
      expect(wrongMerchant.status).toBeLessThan(500);
      const garbled = await send(JSON.stringify({ id: 'e', resource: { algorithm: 'AEAD_AES_256_GCM', ciphertext: Buffer.alloc(40).toString('base64'), nonce: 'notifyNonce1', associated_data: 'transaction' } }));
      expect(garbled.status).toBeGreaterThanOrEqual(400);
      expect(garbled.status).toBeLessThan(500);
      const noResource = await send(JSON.stringify({ id: 'e' }));
      expect(noResource.status).toBeGreaterThanOrEqual(400);
      expect(noResource.status).toBeLessThan(500);
      expect(billing.markPaid).not.toHaveBeenCalled();
    });

    it('交易状态不是 SUCCESS：确认收到，不入账', async () => {
      const res = await send(body(transaction({ trade_state: 'CLOSED' })));
      expect(res.status).toBe(200);
      expect(billing.markPaid).not.toHaveBeenCalled();
    });

    it('币种不是 CNY 或金额不是整数分：400，不入账', async () => {
      expect((await send(body(transaction({ amount: { total: 12800, currency: 'USD' } })))).status).toBe(400);
      expect((await send(body(transaction({ amount: { total: 12800.5, currency: 'CNY' } })))).status).toBe(400);
      expect(billing.markPaid).not.toHaveBeenCalled();
    });
  });

  describe('可信内部回调 /billing/callbacks/internal（HMAC）', () => {
    const payload = { eventId: 'evt-1', provider: 'wechat', orderNo: 'CF1', status: 'paid', providerOrderNo: 'BANK1', amount: 128 };
    const sign = (ts: string, p: typeof payload & Record<string, unknown>) =>
      createHmac('sha256', CALLBACK_SECRET).update(`${ts}.${p.eventId}.${p.provider}.${p.orderNo}.${p.status}.${p.providerOrderNo}.${p.amount ?? ''}`).digest('hex');
    const post = (p: Record<string, unknown>, ts = String(Math.floor(Date.now() / 1000)), signature?: string) =>
      request(app.getHttpServer()).post('/api/v1/billing/callbacks/internal')
        .set('x-payment-timestamp', ts).set('x-payment-signature', signature ?? sign(ts, p as any)).send(p);

    it('签名与时间都对：入账', async () => {
      expect((await post(payload)).status).toBe(200);
      expect(billing.markPaid).toHaveBeenCalledWith(expect.objectContaining({ orderNo: 'CF1', paidAmount: 128 }));
    });

    it('改了金额（签名是按原金额算的）：401', async () => {
      const ts = String(Math.floor(Date.now() / 1000));
      const res = await post({ ...payload, amount: 1 }, ts, sign(ts, payload));
      expect(res.status).toBe(401);
      expect(billing.markPaid).not.toHaveBeenCalled();
    });

    it('时间戳过期（超过 5 分钟）、签名缺失或不是十六进制：401', async () => {
      const old = String(Math.floor(Date.now() / 1000) - 3600);
      expect((await post(payload, old)).status).toBe(401);
      expect((await post(payload, undefined, 'zz')).status).toBe(401);
      expect((await post(payload, undefined, '')).status).toBe(401);
      expect(billing.markPaid).not.toHaveBeenCalled();
    });

    it('没配回调密钥（或太短）：503，不会用空密钥验签放行', async () => {
      process.env.PAYMENT_CALLBACK_SECRET = '';
      expect((await post(payload)).status).toBe(503);
      process.env.PAYMENT_CALLBACK_SECRET = 'short';
      expect((await post(payload)).status).toBe(503);
      expect(billing.markPaid).not.toHaveBeenCalled();
    });

    it('退款通知：走 markRefunded，不走 markPaid', async () => {
      const refund = { ...payload, status: 'refunded' };
      expect((await post(refund)).status).toBe(200);
      expect(billing.markRefunded).toHaveBeenCalledWith('CF1', 'BANK1');
      expect(billing.markPaid).not.toHaveBeenCalled();
    });

    it('已支付通知缺金额：400', async () => {
      const { amount, ...noAmount } = payload;
      void amount;
      expect((await post(noAmount)).status).toBe(400);
      expect(billing.markPaid).not.toHaveBeenCalled();
    });
  });

  it('main.ts 打开了 rawBody（微信验签要用原始字节，没有它所有微信通知都会 401）', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const src = require('fs').readFileSync(require('path').join(__dirname, '../../main.ts'), 'utf8');
    expect(src).toMatch(/rawBody:\s*true/);
  });
});
