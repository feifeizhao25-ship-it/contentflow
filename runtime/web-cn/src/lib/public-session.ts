/**
 * 公开页的登录探针。
 * ff_token 是 httpOnly，页面脚本读不到。没有登录 cookie 时只问本站 /api/auth/session
 * （该接口不访问后端），不再去打 /auth/profile、/billing/subscription 这类需要登录的接口，
 * 避免访客打开定价页时控制台出现 401。
 */

export const PUBLIC_APP_PATHS = ['/', '/login', '/register', '/pricing', '/privacy', '/terms'] as const;

export function isPublicAppPath(pathname: string): boolean {
  const path = (pathname.split('?')[0] || '/').replace(/\/+$/, '') || '/';
  return (PUBLIC_APP_PATHS as readonly string[]).includes(path);
}

/** 公开页只有已经登录才请求工作台接口；其余页面保持原样。 */
export function shouldRequestAuthedChrome(pathname: string, signedIn: boolean): boolean {
  return !isPublicAppPath(pathname) || signedIn;
}

export async function readSignedIn(fetchImpl: typeof fetch = fetch): Promise<boolean> {
  try {
    const response = await fetchImpl('/api/auth/session', { cache: 'no-store', credentials: 'same-origin' });
    if (!response.ok) return false;
    const body = await response.json();
    return body?.signedIn === true;
  } catch {
    return false;
  }
}

/** 当前页面是否可以发起需要登录的请求。公开页访客返回 false，且不会访问后端身份接口。 */
export async function authedChromeAllowed(pathname: string, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  if (!isPublicAppPath(pathname)) return true;
  return readSignedIn(fetchImpl);
}
