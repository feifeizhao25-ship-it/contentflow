import { AlipaySdk } from 'alipay-sdk';
import { queryPayment, closePayment } from './payment-reconciliation';
jest.mock('alipay-sdk', () => ({ AlipaySdk: jest.fn() }));
describe('verified Alipay management calls', () => {
  const original = process.env;
  const exec = jest.fn();
  beforeEach(() => {
    jest.resetAllMocks();
    process.env = { ...original, ALIPAY_APP_ID: 'test', ALIPAY_PRIVATE_KEY: 'test', ALIPAY_PUBLIC_KEY: 'test' };
    (AlipaySdk as jest.Mock).mockImplementation(() => ({ exec }));
  });
  afterEach(() => { process.env = original; });
  it('requires SDK response verification and binds the order number', async () => {
    exec.mockResolvedValue({ code: '10000', out_trade_no: 'CF1', trade_no: 'ALI1', trade_status: 'TRADE_SUCCESS', total_amount: '99.00' });
    expect(await queryPayment('alipay', 'CF1')).toEqual({ state: 'paid', transactionId: 'ALI1', amount: 99 });
    expect(exec).toHaveBeenCalledWith('alipay.trade.query', { bizContent: { out_trade_no: 'CF1' } }, { validateSign: true });
  });
  it('rejects another order even if the response reports success', async () => {
    exec.mockResolvedValue({ code: '10000', out_trade_no: 'CF2', trade_status: 'TRADE_CLOSED' });
    await expect(queryPayment('alipay', 'CF1')).rejects.toThrow('未确认');
    await expect(closePayment('alipay', 'CF1')).rejects.toThrow('未确认');
  });
  it('fails closed when signature verification fails', async () => {
    exec.mockRejectedValue(new Error('signature invalid'));
    await expect(closePayment('alipay', 'CF1')).rejects.toThrow('signature invalid');
    expect(exec).toHaveBeenCalledWith('alipay.trade.close', expect.anything(), { validateSign: true });
  });
});
