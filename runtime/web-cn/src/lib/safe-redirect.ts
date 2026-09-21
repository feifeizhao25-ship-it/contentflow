/**
 * 登录后回跳地址：只接受本站内的相对路径。
 * 原来登录页忽略 `?redirect=`，一律进 /overview——会员页「登录后继续购买」、
 * 以及中间件把未登录用户送去登录时带的原页面，都回不去。
 * 拒绝 `//evil.com`、`/\evil.com`、`https://…`、`javascript:` 等，避免开放重定向。
 */
export function safeRedirectTarget(raw: string | null | undefined, fallback = '/overview'): string {
    if (!raw || typeof raw !== 'string') return fallback;
    if (!raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return fallback;
    if (/[\u0000-\u001f]/.test(raw)) return fallback;
    try {
        const url = new URL(raw, 'https://placeholder.invalid');
        if (url.origin !== 'https://placeholder.invalid') return fallback;
        if (url.pathname === '/login' || url.pathname === '/register') return fallback;
        return `${url.pathname}${url.search}${url.hash}`;
    } catch {
        return fallback;
    }
}
