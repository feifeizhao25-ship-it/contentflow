import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/', '/login', '/register', '/pricing', '/privacy', '/terms'];

// (main) 路由组下需要登录的首段路径。只有这些路径在未登录时重定向到登录页；
// 其余未知路径直接放行，由 Next.js 渲染中文 404 页（src/app/not-found.tsx）。
const PROTECTED_SEGMENTS = new Set([
    'accounts',
    'achievements',
    'ai-create',
    'analytics',
    'calendar',
    'community',
    'competitor',
    'contents',
    'create',
    'dashboard',
    'developer',
    'growth',
    'hot',
    'materials',
    'monetization',
    'my-videos',
    'overview',
    'persona',
    'points',
    'publish',
    'schedule',
    'settings',
    'studio',
    'team',
    'traffic-sandwich',
    'video-studio',
]);

export async function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;

    if (
        PUBLIC_PATHS.includes(pathname) ||
        pathname.startsWith('/api') ||
        pathname.startsWith('/_next') ||
        pathname.startsWith('/public') ||
        pathname.match(/\.(?:svg|png|jpg|jpeg|gif|webp|ico)$/)
    ) {
        return NextResponse.next();
    }

    const segment = pathname.split('/')[1] ?? '';
    if (!PROTECTED_SEGMENTS.has(segment)) {
        // 未知路径：不做登录重定向，交给 not-found 渲染 404。
        return NextResponse.next();
    }

    const token = request.cookies.get('ff_token')?.value;
    if (!token) {
        const loginUrl = request.nextUrl.clone();
        loginUrl.pathname = '/login';
        loginUrl.searchParams.set('redirect', pathname);
        return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * Feel free to modify this pattern to include more paths.
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};
