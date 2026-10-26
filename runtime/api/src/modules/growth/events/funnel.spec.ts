import { CN_PLANS } from '../../billing/plans.constant';
import { FunnelStore } from './funnel.service';

describe('流量漏斗', () => {
  it('最后一次触点归因，并按工作区汇总访问、试用和付费', () => {
    const store = new FunnelStore();
    const visitor = 'visitor-01';
    store.record({ event: 'site_view', visitor_id: visitor, body: { utm_source: 'baidu', page_type: 'template' } });
    store.record({ event: 'site_view', visitor_id: visitor, tenant_id: 't-1', body: { utm_source: 'wechat', page_type: 'pricing' } });
    store.record({ event: 'trial_start', visitor_id: visitor, tenant_id: 't-1', user_id: 'u-1' });
    store.record({ event: 'first_pack_exported', visitor_id: visitor, tenant_id: 't-1', user_id: 'u-1' });
    store.record({ event: 'subscription_paid', visitor_id: visitor, tenant_id: 't-1', user_id: 'u-1' });
    expect(store.attributionOf(visitor)?.utm_source).toBe('wechat');
    const summary = store.summary({ tenant_id: 't-1' });
    expect(summary.counts.site_view).toBe(1);
    expect(summary.counts.trial_start).toBe(1);
    expect(summary.counts.subscription_paid).toBe(1);
    expect(summary.attribution).toEqual([expect.objectContaining({ utm_source: 'wechat', subscription_paid: 1 })]);
    expect(store.summary({ tenant_id: 'other' }).counts.subscription_paid).toBe(0);
  });

  it('不接收个人身份信息', () => {
    const store = new FunnelStore();
    expect(() => store.record({ event: 'site_view', visitor_id: 'visitor-01', body: { email: 'a@example.com' } })).toThrow('个人身份');
  });

  it('免费版仍是每月 5 条，Business 配额仍是待确认', () => {
    expect(CN_PLANS.find((plan) => plan.id === 'free')?.monthlyPostQuota).toBe(5);
    expect(CN_PLANS.find((plan) => plan.id === 'enterprise')?.quotaStatus).toBe('unconfirmed');
  });
});
