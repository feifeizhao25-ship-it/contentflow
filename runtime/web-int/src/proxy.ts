import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = new Set(['/', '/pricing', '/login', '/register', '/experience-week']);

// First path segment of routes that read an account. Anything else is not a
// workspace page: leave it alone so Next.js can render not-found.tsx (404).
const PROTECTED_SEGMENTS = new Set([
  'accounts',
  'analytics',
  'brand-voice',
  'calendar',
  'content-packs',
  'create',
  'data-network',
  'developers',
  'library',
  'materials',
  'publishing',
  'settings',
  'skills',
  'team',
]);

export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (
    PUBLIC_PATHS.has(path) ||
    path.startsWith('/legal/') ||
    path.startsWith('/api/auth') ||
    path.startsWith('/api/v1/') ||
    path.startsWith('/_next')
  ) {
    return NextResponse.next();
  }

  const segment = path.split('/')[1] ?? '';
  if (!PROTECTED_SEGMENTS.has(segment)) {
    return NextResponse.next();
  }

  if (!request.cookies.get('ff_token')) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', path);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
