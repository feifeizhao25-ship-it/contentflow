import type { NextRequest } from 'next/server';
import { POST as handle } from 'dev-login-entry';

/** Production resolves absent.ts. Development and test builds resolve handler.ts. See dev-login-build.mjs. */
export function POST(request: NextRequest) {
  return handle(request);
}
