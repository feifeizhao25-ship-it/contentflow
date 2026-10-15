import { orderStatusText } from './billing.service';

describe('orderStatusText', () => {
  it('内部状态码转成中文，不漏英文', () => {
    for (const s of ['pending', 'paid', 'refund_pending', 'refunded', 'closed', 'whatever']) {
      expect(orderStatusText(s)).toMatch(/^[\u4e00-\u9fff]+$/);
    }
    expect(orderStatusText('paid')).toBe('已支付');
  });
});
