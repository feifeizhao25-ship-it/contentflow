export const FUNNEL_EVENTS = [
  'site_view',
  'trial_start',
  'first_pack_exported',
  'subscription_paid',
  'seat_added',
  'plan_upgraded',
] as const;

export type FunnelEventName = (typeof FUNNEL_EVENTS)[number];

export function isFunnelEvent(value: string): value is FunnelEventName {
  return (FUNNEL_EVENTS as readonly string[]).includes(value);
}
