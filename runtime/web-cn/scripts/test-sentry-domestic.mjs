/**
 * 国内 Web 的错误上报不得出境。
 *   node --import ./scripts/ts-extensionless.mjs --experimental-strip-types scripts/test-sentry-domestic.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { domesticSentryDsn } from '../src/lib/sentry-dsn.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let failures = 0;
function check(name, fn) {
  try { fn(); console.log(`  PASS ${name}`); } catch (e) { failures++; console.error(`  FAIL ${name}: ${e.message}`); }
}
console.log('Sentry domestic tests');

check('sentry.io DSNs are refused', () => {
  assert.equal(domesticSentryDsn('https://abc@o123.ingest.sentry.io/456'), undefined);
  assert.equal(domesticSentryDsn('https://abc@o1.ingest.us.sentry.io/2'), undefined);
  assert.equal(domesticSentryDsn('https://abc@sentry.io/2'), undefined);
});
check('self-hosted https DSN is kept; http and garbage are refused', () => {
  assert.equal(domesticSentryDsn('https://k@sentry.example.cn/3'), 'https://k@sentry.example.cn/3');
  assert.equal(domesticSentryDsn('https://k@notsentry.io.example.cn/3'), 'https://k@notsentry.io.example.cn/3');
  assert.equal(domesticSentryDsn('http://k@sentry.example.cn/3'), undefined);
  assert.equal(domesticSentryDsn('not a url'), undefined);
  assert.equal(domesticSentryDsn(undefined), undefined);
});
check('instrumentation initialises Sentry only with the vetted DSN', () => {
  const src = fs.readFileSync(path.join(ROOT, 'src/instrumentation.ts'), 'utf8');
  assert.match(src, /domesticSentryDsn\(process\.env\.SENTRY_DSN\)/);
  assert.doesNotMatch(src, /dsn:\s*process\.env/);
});
check('build plugin: telemetry off, source maps only to a domestic SENTRY_URL', () => {
  const cfg = fs.readFileSync(path.join(ROOT, 'next.config.mjs'), 'utf8');
  assert.match(cfg, /telemetry:\s*false/);
  assert.match(cfg, /sentryUrl:\s*domesticSentry \? sentryUrl : undefined/);
  assert.match(cfg, /sourcemaps:\s*\{\s*disable:\s*!\(domesticSentry && process\.env\.SENTRY_AUTH_TOKEN\)/);
});

if (failures) { console.error(`${failures} failed`); process.exit(1); }
console.log('All Sentry domestic tests passed');
