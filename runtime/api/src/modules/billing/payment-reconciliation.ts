import { AlipaySdk } from 'alipay-sdk';
import { queryWeChatOrder, closeWeChatOrder } from './wechat-pay.adapter';

export type PaymentState = {
  state: 'paid' | 'pending' | 'closed';
  transactionId?: string;
  amount?: number;
};
function alipay() {
  const appId = process.env.ALIPAY_APP_ID;
  const privateKey = process.env.ALIPAY_PRIVATE_KEY;
  const alipayPublicKey = process.env.ALIPAY_PUBLIC_KEY;
  if (!appId || !privateKey || !alipayPublicKey) throw new Error('支付宝查询配置不完整');
  const gateway = process.env.ALIPAY_GATEWAY_URL || 'https://openapi.alipay.com/gateway.do';
  if (!['https://openapi.alipay.com/gateway.do', 'https://openapi-sandbox.dl.alipaydev.com/gateway.do'].includes(gateway)) {
    throw new Error('支付宝网关地址无效');
  }
  return new AlipaySdk({ appId, privateKey: privateKey.replace(/\\n/g, '\n'), alipayPublicKey: alipayPublicKey.replace(/\\n/g, '\n'), gateway, camelcase: false, timeout: 10000 });
}
export async function queryPayment(provider: string, orderNo: string): Promise<PaymentState> {
  if (provider === 'wechat') {
    const result = await queryWeChatOrder(orderNo);
    if (result.trade_state === 'SUCCESS') {
      if (!result.transaction_id || result.amount?.currency !== 'CNY' || !Number.isInteger(result.amount?.total)) throw new Error('微信订单金额无效');
      return { state: 'paid', transactionId: result.transaction_id, amount: result.amount.total / 100 };
    }
    if (result.trade_state === 'CLOSED') return { state: 'closed' };
    if (['NOTPAY', 'USERPAYING'].includes(result.trade_state)) return { state: 'pending' };
    throw new Error('微信订单状态需人工核对');
  }
  if (provider === 'alipay') {
    const result = await alipay().exec('alipay.trade.query', { bizContent: { out_trade_no: orderNo } }, { validateSign: true });
    if (result.code !== '10000' || result.out_trade_no !== orderNo) throw new Error('支付宝订单查询未确认');
    if (['TRADE_SUCCESS', 'TRADE_FINISHED'].includes(result.trade_status as string)) {
      const amount = Number(result.total_amount);
      if (!result.trade_no || !Number.isFinite(amount) || amount <= 0) throw new Error('支付宝订单金额无效');
      return { state: 'paid', transactionId: result.trade_no as string, amount };
    }
    if (result.trade_status === 'TRADE_CLOSED') return { state: 'closed' };
    if (result.trade_status === 'WAIT_BUYER_PAY') return { state: 'pending' };
    throw new Error('支付宝订单状态需人工核对');
  }
  throw new Error('该支付方式需要人工对账');
}
export async function closePayment(provider: string, orderNo: string): Promise<void> {
  if (provider === 'wechat') return closeWeChatOrder(orderNo);
  if (provider === 'alipay') {
    const result = await alipay().exec('alipay.trade.close', { bizContent: { out_trade_no: orderNo } }, { validateSign: true });
    if (result.code !== '10000' || result.out_trade_no !== orderNo) throw new Error('支付宝关单未确认');
    return;
  }
  throw new Error('不支持自动关闭该支付渠道');
}
