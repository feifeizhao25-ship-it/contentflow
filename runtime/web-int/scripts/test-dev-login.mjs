/**
 * 共2 (international): the test login exists only in development and test builds.
 * This asserts which file production selects, and that the marker is not in that file.
 * The production bundle check is assert-prod-build-has-no-dev-login.mjs, run after next build.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { devLoginEntry } from '../dev-login-build.mjs';
import { POST as absent } from '../src/dev-login/absent.ts';
import { POST as devLogin, DEV_LOGIN_MARKER } from '../src/dev-login/handler.ts';

const marker = 'contentflow-dev-login-channel-v1';
assert.equal(DEV_LOGIN_MARKER, marker);
assert.equal(devLoginEntry('production'), './src/dev-login/absent.ts');
assert.equal(devLoginEntry('development'), './src/dev-login/handler.ts');
assert.equal(devLoginEntry('test'), './src/dev-login/handler.ts');
assert.equal(fs.readFileSync('src/dev-login/absent.ts', 'utf8').includes(marker), false);
assert.equal(fs.readFileSync('src/app/api/auth/dev-login/route.ts', 'utf8').includes(marker), false);
assert.equal(fs.readFileSync('src/dev-login/handler.ts', 'utf8').includes(marker), true);
assert.equal(fs.readFileSync('next.config.mjs', 'utf8').includes('devLoginEntry'), true);

const empty = await absent();
assert.equal(empty.status, 404);

function request(headers, body) {
  return {
    headers: { get: (name) => headers[String(name).toLowerCase()] ?? null },
    json: async () => body,
  };
}

const hidden = await devLogin(request({}, { email: 'a@b.c' }));
assert.equal(hidden.status, 404);

const previous = process.env.DEV_LOGIN_PASSWORD;
delete process.env.DEV_LOGIN_PASSWORD;
const unconfigured = await devLogin(request({ 'x-dev-login': marker }, { email: 'a@b.c' }));
assert.equal(unconfigured.status, 404);

process.env.DEV_LOGIN_PASSWORD = 'local-test-password';
let sent = null;
const original = global.fetch;
global.fetch = async (url, init) => {
  sent = { url: String(url), body: init.body };
  return { ok: true, status: 200, json: async () => ({ data: { token: 'local-token', user: { name: 'Shot User' } } }) };
};
try {
  const ok = await devLogin(request({ 'x-dev-login': marker }, { email: 'int-shot@local.test' }));
  assert.equal(ok.status, 200);
  const payload = await ok.json();
  assert.equal(payload.user.name, 'Shot User');
  assert.equal(String(sent.url).endsWith('/api/v1/auth/login'), true);
  assert.equal(JSON.parse(sent.body).email, 'int-shot@local.test');
  assert.equal(JSON.parse(sent.body).password, 'local-test-password');
} finally {
  global.fetch = original;
  if (previous === undefined) delete process.env.DEV_LOGIN_PASSWORD;
  else process.env.DEV_LOGIN_PASSWORD = previous;
}

console.log('dev login channel: development only, production entry is absent');
