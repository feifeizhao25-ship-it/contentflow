import { proxyToGateway } from '@/lib/api-proxy';
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: { platform: string } }) {
  return proxyToGateway(request, { path: `v1/oauth/authorize/${params.platform}` });
}
import { proxyToGateway } from '@/lib/api-proxy';
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: { platform: string } }) {
  return proxyToGateway(request, { path: `v1/oauth/authorize/${params.platform}` });
}
import { proxyToGateway } from '@/lib/api-proxy';
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

const pathFor = (platform: string) => `v1/oauth/callback/${platform}`;

export async function GET(request: NextRequest, { params }: { params: { platform: string } }) {
  return proxyToGateway(request, { path: pathFor(params.platform) });
}

export async function POST(request: NextRequest, { params }: { params: { platform: string } }) {
  return proxyToGateway(request, { path: pathFor(params.platform) });
}
import { proxyToGateway } from '@/lib/api-proxy';
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

const pathFor = (platform: string) => `v1/oauth/callback/${platform}`;

export async function GET(request: NextRequest, { params }: { params: { platform: string } }) {
  return proxyToGateway(request, { path: pathFor(params.platform) });
}

export async function POST(request: NextRequest, { params }: { params: { platform: string } }) {
  return proxyToGateway(request, { path: pathFor(params.platform) });
}
import { proxyToGateway } from '@/lib/api-proxy';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const body = await request.text();
  const parsed = body ? JSON.parse(body) : {};
  const skillId = parsed.skill_id || parsed.skillId || parsed.id;
  const proxyRequest = new Request(request.url, {
    method: 'POST',
    headers: request.headers,
    body,
  });
  return proxyToGateway(proxyRequest, {
    path: skillId ? `v1/skills/execute/${skillId}` : 'v1/skills/execute',
  });
}
import { proxyToGateway } from '@/lib/api-proxy';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const body = await request.text();
  const parsed = body ? JSON.parse(body) : {};
  const skillId = parsed.skill_id || parsed.skillId || parsed.id;
  const proxyRequest = new Request(request.url, {
    method: 'POST',
    headers: request.headers,
    body,
  });
  return proxyToGateway(proxyRequest, {
    path: skillId ? `v1/skills/execute/${skillId}` : 'v1/skills/execute',
  });
}