type EventProperties = Record<string, unknown>;

export function trackEvent(name: string, properties: EventProperties = {}): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent('contentflow:analytics', {
      detail: { name, properties, timestamp: new Date().toISOString() },
    }),
  );
}
