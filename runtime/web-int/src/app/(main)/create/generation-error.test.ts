import { ERROR_CATALOG as apiCatalog } from '../../../../../api/src/common/error-catalog';
import { ERROR_CATALOG } from '@/lib/error-catalog';
import { describeGenerationFailure } from './generation-error';

describe('create page error copy', () => {
  it('uses the same English sentences as the API catalog', () => {
    for (const key of Object.keys(apiCatalog) as Array<keyof typeof apiCatalog>) {
      expect(ERROR_CATALOG[key].en).toBe(apiCatalog[key].en);
    }
  });

  it('does not use the outage sentence for a compliance block or a refused request', () => {
    const compliance = describeGenerationFailure(400, { error: { code: 'CONTENT_COMPLIANCE_BLOCKED', message: 'Blocked by the compliance check.', stage: 'brief' } });
    const refused = describeGenerationFailure(400, { error: { code: 'REQUEST_NOT_ALLOWED', message: '不能处理这个请求' } });
    const outage = describeGenerationFailure(502, { error: { code: 'BAD_GATEWAY', message: 'Generation is unavailable right now. Your brief is preserved; please try again later.' } });
    expect(compliance.kind).toBe('blocked');
    expect(refused.kind).toBe('blocked');
    expect(outage.kind).toBe('outage');
    if (compliance.kind === 'blocked') expect(compliance.message).toBe('Blocked by the compliance check.');
    if (refused.kind === 'blocked') expect(refused.message).toBe(ERROR_CATALOG.REQUEST_NOT_ALLOWED.en);
    if (outage.kind === 'outage') expect(outage.message).toBe(ERROR_CATALOG.SERVICE_UNAVAILABLE.en);
    expect(outage.message).not.toBe(refused.message);
    expect(outage.message).not.toBe(compliance.kind === 'blocked' ? compliance.message : '');
  });

  it('keeps sign-in, quota and missing configuration apart', () => {
    expect(describeGenerationFailure(401, { error: { code: 'UNAUTHORIZED' } }).message).toBe(ERROR_CATALOG.AUTHENTICATION_REQUIRED.en);
    expect(describeGenerationFailure(429, { error: { code: 'AI_MONTHLY_QUOTA', message: 'Monthly allowance reached.' } }).message).toBe('Monthly allowance reached.');
    expect(describeGenerationFailure(503, { error: { code: 'NOT_CONFIGURED' } }).message).toBe(ERROR_CATALOG.NOT_CONFIGURED.en);
  });
});
