import { proxyLogin } from '@/lib/auth-login-proxy';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  return proxyLogin(request, { exposeToken: true });
}