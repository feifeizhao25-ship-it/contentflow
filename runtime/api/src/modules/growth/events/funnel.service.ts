import { LastTouchStore, UtmTouch, assertNoPii, parseUtm } from '../attribution/utm.service';
import { FunnelEventName, isFunnelEvent } from './event.schema';

export interface StoredFunnelEvent {
  id: string;
  event: FunnelEventName;
  visitor_id: string;
  tenant_id?: string;
  user_id?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  page_type?: string;
  created_at: string;
}

export interface FunnelSummary {
  counts: Record<FunnelEventName, number>;
  attribution: { utm_source: string; site_view: number; trial_start: number; subscription_paid: number }[];
}

export class FunnelStore {
  private sequence = 0;
  private readonly events: StoredFunnelEvent[] = [];
  private readonly touches = new LastTouchStore();

  record(input: { event: string; visitor_id: string; tenant_id?: string; user_id?: string; body?: Record<string, unknown> }): StoredFunnelEvent {
    if (!isFunnelEvent(input.event)) throw new Error('未知事件');
    const body = input.body ?? {};
    assertNoPii(body);
    if (!/^[\w-]{8,64}$/.test(input.visitor_id)) throw new Error('visitor_id 格式不正确');
    const touch = this.touches.remember(parseUtm(input.visitor_id, body));
    this.sequence += 1;
    const stored: StoredFunnelEvent = {
      id: `ge-${this.sequence}`,
      event: input.event,
      visitor_id: input.visitor_id,
      tenant_id: input.tenant_id,
      user_id: input.user_id,
      created_at: new Date().toISOString(),
      utm_source: touch.utm_source,
      utm_medium: touch.utm_medium,
      utm_campaign: touch.utm_campaign,
      utm_content: touch.utm_content,
      utm_term: touch.utm_term,
      page_type: touch.page_type,
    };
    this.events.push(stored);
    return stored;
  }

  attributionOf(visitorId: string): UtmTouch | undefined {
    return this.touches.get(visitorId);
  }

  summary(filter?: { tenant_id?: string }): FunnelSummary {
    const rows = filter?.tenant_id ? this.events.filter((event) => event.tenant_id === filter.tenant_id) : this.events;
    const counts = {
      site_view: 0,
      trial_start: 0,
      first_pack_exported: 0,
      subscription_paid: 0,
      seat_added: 0,
      plan_upgraded: 0,
    };
    const bySource = new Map<string, { utm_source: string; site_view: number; trial_start: number; subscription_paid: number }>();
    for (const row of rows) {
      counts[row.event] += 1;
      const source = row.utm_source || '(direct)';
      const bucket = bySource.get(source) ?? { utm_source: source, site_view: 0, trial_start: 0, subscription_paid: 0 };
      if (row.event === 'site_view' || row.event === 'trial_start' || row.event === 'subscription_paid') bucket[row.event] += 1;
      bySource.set(source, bucket);
    }
    return { counts, attribution: [...bySource.values()] };
  }
}
