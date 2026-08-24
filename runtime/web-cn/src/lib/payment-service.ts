/**
 * 支付只能由 NestJS 后端创建订单并通过支付渠道签名回调确认。
 * 本模块保留旧调用签名，但在真实网关接入前一律失败关闭；浏览器不得生成
 * 订单号、交易号或直接激活/取消订阅。
 */

export type PaymentMethod = 'wechat' | 'alipay' | 'bank_transfer';

export interface PaymentRequest {
  planId: string;
  paymentMethod: PaymentMethod;
}

export interface PaymentResult {
  success: false;
  code: 'PAYMENT_BACKEND_NOT_CONFIGURED';
  message: string;
}

const unavailable = (): PaymentResult => ({
  success: false,
  code: 'PAYMENT_BACKEND_NOT_CONFIGURED',
  message: '支付服务尚未完成商户配置，未创建订单或开通权益',
});

export async function createPaymentOrder(_request: PaymentRequest): Promise<PaymentResult> {
  return unavailable();
}

export async function verifyPayment(_orderId: string): Promise<PaymentResult> {
  return unavailable();
}

export async function activateSubscription(): Promise<never> {
  throw new Error(unavailable().message);
}

export async function cancelSubscription(): Promise<never> {
  throw new Error(unavailable().message);
}
