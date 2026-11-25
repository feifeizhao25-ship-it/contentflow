import { ERROR_CATALOG, fallbackMessage } from '@/lib/error-catalog';

export type GenerationFailure =
  | { kind: 'blocked'; stage: 'brief' | 'draft'; message: string }
  | { kind: 'signin'; message: string }
  | { kind: 'quota'; message: string }
  | { kind: 'missing'; message: string }
  | { kind: 'outage'; message: string }
  | { kind: 'invalid'; message: string };

const BLOCKED = new Set(['CONTENT_COMPLIANCE_BLOCKED', 'REQUEST_NOT_ALLOWED']);
const QUOTA = new Set(['QUOTA_EXHAUSTED', 'AI_MONTHLY_QUOTA', 'QUOTA_EXCEEDED']);

function englishMessage(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() && !/[\u3400-\u9fff]/.test(value) ? value : fallback;
}

/** 创作页按错误码取对照表。合规拦截和服务故障不能共用一句。 */
export function describeGenerationFailure(status: number, body: { error?: { code?: unknown; message?: unknown; stage?: unknown } } | null): GenerationFailure {
  const code = typeof body?.error?.code === 'string' ? body.error.code : '';
  const backend = body?.error?.message;
  if (BLOCKED.has(code)) {
    const stage = body?.error?.stage === 'draft' ? 'draft' : 'brief';
    return { kind: 'blocked', stage, message: englishMessage(backend, fallbackMessage(code, true)) };
  }
  if (QUOTA.has(code)) return { kind: 'quota', message: englishMessage(backend, ERROR_CATALOG.QUOTA_EXHAUSTED.en) };
  if (status === 401 || code === 'AUTHENTICATION_REQUIRED') {
    return { kind: 'signin', message: ERROR_CATALOG.AUTHENTICATION_REQUIRED.en };
  }
  if (status === 403 || code === 'NOT_PERMITTED') return { kind: 'invalid', message: ERROR_CATALOG.NOT_PERMITTED.en };
  if (code === 'NOT_CONFIGURED') return { kind: 'missing', message: ERROR_CATALOG.NOT_CONFIGURED.en };
  if (status >= 500 || code === 'SERVICE_UNAVAILABLE') return { kind: 'outage', message: ERROR_CATALOG.SERVICE_UNAVAILABLE.en };
  if (status === 429 || code === 'RATE_LIMITED') return { kind: 'invalid', message: ERROR_CATALOG.RATE_LIMITED.en };
  return { kind: 'invalid', message: englishMessage(backend, ERROR_CATALOG.VALIDATION_FAILED.en) };
}
