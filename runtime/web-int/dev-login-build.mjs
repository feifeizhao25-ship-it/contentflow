/**
 * Which test-login implementation the build uses.
 * Production (NODE_ENV=production) must point at absent.ts, which has no channel.
 * Development (next dev) and tests (NODE_ENV=test) point at handler.ts.
 */
export function devLoginEntry(nodeEnv) {
  return nodeEnv === 'production' ? './src/dev-login/absent.ts' : './src/dev-login/handler.ts';
}
