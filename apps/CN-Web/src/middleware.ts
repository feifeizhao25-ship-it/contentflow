    if (pathname.startsWith('/api/proxy')) {
        return applyCSP(request, NextResponse.next());
    }

    // 本地验收 demo 页面仅在开发环境公开，生产环境仍走登录保护。
    if (process.env.NODE_ENV !== 'production' && pathname.startsWith('/demo')) {
        return applyCSP(request, NextResponse.next());
    }

    if (pathname.startsWith('/api/')) {
