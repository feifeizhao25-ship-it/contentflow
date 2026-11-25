import type { NextRequest } from 'next/server';
import { GET as get, POST as post } from 'dev-login-entry';

/** Production resolves absent.ts. Development and test builds resolve handler.ts. See dev-login-build.mjs. */
export function GET(request: NextRequest) {
  return get(request);
}
export function POST(request: NextRequest) {
  return post(request);
}
