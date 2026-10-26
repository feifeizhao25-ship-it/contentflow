export interface UtmTouch {
  visitor_id: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  page_type?: string;
}

const FIELDS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'page_type'] as const;
const PII = ['email', 'phone', 'name', 'cookie', 'cookies', 'password', 'token'];

export function assertNoPii(body: Record<string, unknown>): void {
  for (const key of Object.keys(body)) {
    if (PII.includes(key.toLowerCase())) throw new Error('不接收个人身份信息');
  }
}

export function parseUtm(visitorId: string, body: Record<string, unknown>): UtmTouch {
  const touch: UtmTouch = { visitor_id: visitorId };
  const source = (body.utm && typeof body.utm === 'object' ? body.utm : body) as Record<string, unknown>;
  for (const field of FIELDS) {
    const value = source[field];
    if (typeof value !== 'string') continue;
    const cleaned = value.trim().slice(0, 80);
    if (!cleaned || !/^[\w\u4e00-\u9fff:./+-]+$/.test(cleaned)) continue;
    touch[field] = cleaned;
  }
  return touch;
}

/** 最后一次触点覆盖之前的触点。 */
export class LastTouchStore {
  private readonly touches = new Map<string, UtmTouch>();

  remember(touch: UtmTouch): UtmTouch {
    const previous = this.touches.get(touch.visitor_id) ?? { visitor_id: touch.visitor_id };
    const next: UtmTouch = { ...previous, ...stripEmpty(touch), visitor_id: touch.visitor_id };
    this.touches.set(touch.visitor_id, next);
    return next;
  }

  get(visitorId: string): UtmTouch | undefined {
    return this.touches.get(visitorId);
  }
}

function stripEmpty(touch: UtmTouch): UtmTouch {
  const next: UtmTouch = { visitor_id: touch.visitor_id };
  for (const field of FIELDS) if (touch[field]) next[field] = touch[field];
  return next;
}
