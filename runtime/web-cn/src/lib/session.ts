import { apiClient } from './api-client';

/**
 * 当前登录用户。国内版的登录态是 httpOnly 的 ff_token cookie，由
 * /api/v1/[...path] 代理换成 Bearer 交给后端；这里统一从后端读身份。
 *
 * 此前这些地方用的是 Supabase 的 `auth.getUser()` / `getSession()`——国内版
 * 从来不在 Supabase 登录，所以永远拿不到用户：素材页不加载、权益一律按免费、
 * 「退出登录」只调了 supabase.auth.signOut()，**ff_token 还在，人并没有退出**。
 */
export interface Tenant {
    id: string;
    name: string;
    plan: string;
}

export interface Profile {
    id: string;
    tenant_id: string;
    email: string;
    name?: string;
    avatar_url?: string;
    role: string;
}

interface ProfileResponse {
    user?: {
        id?: string;
        email?: string;
        name?: string;
        role?: string;
        avatar_url?: string;
        tenant?: { id?: string; name?: string; plan?: string };
    };
}

export async function fetchCurrentUser(): Promise<{ profile: Profile; tenant: Tenant | null } | null> {
    let data: ProfileResponse;
    try {
        data = await apiClient.get<ProfileResponse>('/auth/profile');
    } catch {
        return null;
    }
    const user = data?.user;
    if (!user?.id || !user.email) return null;
    const tenant = user.tenant?.id
        ? { id: user.tenant.id, name: user.tenant.name ?? '', plan: user.tenant.plan ?? 'free' }
        : null;
    return {
        profile: {
            id: user.id,
            tenant_id: tenant?.id ?? '',
            email: user.email,
            name: user.name ?? undefined,
            avatar_url: user.avatar_url ?? undefined,
            role: user.role ?? 'viewer',
        },
        tenant,
    };
}

/** 退出登录：清掉 httpOnly 的 ff_token 与 refresh cookie（只有服务端能清）。 */
export async function logout(): Promise<void> {
    try {
        await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } finally {
        if (typeof window !== 'undefined') window.location.href = '/login';
    }
}
