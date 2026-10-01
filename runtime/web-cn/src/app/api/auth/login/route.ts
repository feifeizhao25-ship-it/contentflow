import { NextRequest } from 'next/server';
import { proxyAuth } from '../../_lib/auth-proxy';

export async function POST(request: NextRequest) {
  return proxyAuth(request, '/api/v1/auth/login');
}
