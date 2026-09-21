/**
 * 会员下单：浏览器只负责「请后端建单 → 带用户去付款 → 轮询后端确认开通」。
 *
 * - 订单号、金额、支付链接全部由后端（NestJS `POST /billing/orders`）按服务端套餐价格生成；
 *   浏览器不生成订单号、不传金额、不自行激活权益。
 * - 权益只在支付平台的签名回调到达后端后才变化；前端只轮询 `GET /billing/subscription` 看结果。
 * - 商户资料未配置时后端返回 503，这里把原因原样展示给用户，不假装成功。
 */

export type PaymentMethod = 'wechat' | 'alipay';
export type BillingCycle = 'monthly' | 'yearly';

export interface CheckoutRequest {
  planId: string;
  billingCycle: BillingCycle;
  paymentMethod: PaymentMethod;
}

export interface CheckoutOrder {
  orderNo: string;
  amount: number | null;
  paymentMethod: PaymentMethod;
  paymentUrl: string | null;
}

export type CheckoutAction =
  | { kind: 'redirect'; url: string }
  | { kind: 'qrcode'; value: string }
  | { kind: 'duplicate' };

export interface SubscriptionSnapshot {
  plan: string;
  renewalDate: string | null;
}

export class PaymentError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'PaymentError';
    this.status = status;
  }
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;
const defaultFetch: FetchLike = (input, init) => fetch(input, init);

async function readEnvelope(response: Response): Promise<any> {
  let envelope: any = null;
  try {
    envelope = await response.json();
  } catch {
    envelope = null;
  }
  if (!response.ok) {
    const raw = envelope?.message ?? envelope?.error?.message ?? envelope?.data?.message;
    const text = Array.isArray(raw) ? raw.join('；') : typeof raw === 'string' ? raw : '';
    throw new PaymentError(text || explainStatus(response.status), response.status);
  }
  return envelope?.data ?? envelope;
}

export function explainStatus(status: number): string {
  if (status === 401) return '登录已过期，请重新登录后再购买';
  if (status === 403) return '只有工作区所有者或管理员可以购买会员';
  if (status === 409) return '该订单请求已提交过，请刷新页面后重试';
  if (status === 503) return '支付服务尚未开通，暂时无法下单';
  return '下单失败，请稍后重试';
}

/** 同一次「确认支付」只用一个幂等键：网络重试不会建出第二笔订单。 */
export function newIdempotencyKey(): string {
  return `cf-web-${crypto.randomUUID()}`;
}

export async function createCheckoutOrder(
  request: CheckoutRequest,
  idempotencyKey: string,
  fetchImpl: FetchLike = defaultFetch,
): Promise<CheckoutOrder> {
  const response = await fetchImpl('/api/v1/billing/orders', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json', 'idempotency-key': idempotencyKey },
    body: JSON.stringify({
      planId: request.planId,
      billingCycle: request.billingCycle,
      paymentMethod: request.paymentMethod,
    }),
  });
  const order = await readEnvelope(response);
  const orderNo = order?.order_no ?? order?.orderNo;
  if (typeof orderNo !== 'string' || !orderNo) throw new PaymentError('下单结果缺少订单号', 502);
  const amount = order?.amount == null ? null : Number(order.amount);
  return {
    orderNo,
    amount: amount != null && Number.isFinite(amount) ? amount : null,
    paymentMethod: request.paymentMethod,
    paymentUrl: typeof order?.paymentUrl === 'string' && order.paymentUrl ? order.paymentUrl : null,
  };
}

/**
 * 决定拿到订单后怎么让用户付款。
 * - 支付宝电脑网站支付：跳转到后端签好名的收银台地址（只接受 https）。
 * - 微信 Native 支付：把 `weixin://` 开头的 code_url 画成二维码，让用户用手机扫。
 * - 没有支付链接：同一幂等键的重复请求，后端返回的是已有订单（不再签发新链接）。
 */
export function checkoutAction(order: CheckoutOrder): CheckoutAction {
  const url = order.paymentUrl;
  if (!url) return { kind: 'duplicate' };
  if (order.paymentMethod === 'alipay') {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new PaymentError('支付宝收银台地址无效', 502);
    }
    if (parsed.protocol !== 'https:') throw new PaymentError('支付宝收银台地址必须是 HTTPS', 502);
    return { kind: 'redirect', url };
  }
  if (!url.startsWith('weixin://')) throw new PaymentError('微信支付二维码内容无效', 502);
  return { kind: 'qrcode', value: url };
}

export async function fetchSubscriptionSnapshot(fetchImpl: FetchLike = defaultFetch): Promise<SubscriptionSnapshot> {
  const response = await fetchImpl('/api/v1/billing/subscription', {
    credentials: 'same-origin',
    cache: 'no-store',
  });
  const data = await readEnvelope(response);
  return { plan: String(data?.plan ?? 'free'), renewalDate: data?.renewalDate ?? null };
}

/** 开通或续费成功：套餐变成所购套餐，或（续费同一套餐时）到期日往后推。 */
export function isActivated(before: SubscriptionSnapshot, after: SubscriptionSnapshot, planId: string): boolean {
  if (after.plan !== planId) return false;
  if (before.plan !== planId) return true;
  const prev = before.renewalDate ? Date.parse(before.renewalDate) : 0;
  const next = after.renewalDate ? Date.parse(after.renewalDate) : 0;
  return next > prev;
}

export interface WaitOptions {
  intervalMs?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
  fetchImpl?: FetchLike;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

/** 轮询后端直到权益到账；超时或取消返回 false（用户可能还没扫码，或回调还在路上）。 */
export async function waitForActivation(
  before: SubscriptionSnapshot,
  planId: string,
  options: WaitOptions = {},
): Promise<boolean> {
  const interval = options.intervalMs ?? 3000;
  const now = options.now ?? Date.now;
  const deadline = now() + (options.timeoutMs ?? 10 * 60 * 1000);
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  while (!options.signal?.aborted && now() < deadline) {
    await sleep(interval);
    if (options.signal?.aborted) return false;
    try {
      const current = await fetchSubscriptionSnapshot(options.fetchImpl);
      if (isActivated(before, current, planId)) return true;
    } catch (error) {
      if (error instanceof PaymentError && error.status === 401) throw error;
      // 其他网络抖动：继续等
    }
  }
  return false;
}

/** 支付宝付款后会带着 out_trade_no 等参数回到 ALIPAY_RETURN_URL（应设为本站 /pricing）。 */
export function isAlipayReturn(params: { get(name: string): string | null }): boolean {
  return Boolean(params.get('out_trade_no')) && params.get('method') === 'alipay.trade.page.pay.return';
}
