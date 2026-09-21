import { apiClient, FriendlyApiError } from './api-client';

/**
 * 素材库（国内版）：一律经后端 /api/v1/materials。
 *
 * 此前这里直接读写 Supabase（Postgres + Storage，境外），与「国内只接国内的数据库」相悖，
 * 而且国内版从来不在 Supabase 登录，拿不到用户，素材页永远是空的。
 * 后端的上传需要先接入境内对象存储（阿里云 OSS / 腾讯云 COS）的签名上传，
 * 未接入前如实返回原因；删除、收藏、改标签同理，不在浏览器里假装成功。
 */
export interface Material {
    id?: string;
    user_id: string;
    name: string;
    url: string;
    type: 'image' | 'video';
    file_size?: number;
    mime_type?: string;
    tags: string[];
    is_favorite: boolean;
    storage_used?: number;
    created_at?: string;
    updated_at?: string;
}

interface ApiMaterial {
    id: string;
    created_by?: string | null;
    material_type: string;
    name?: string | null;
    file_url: string;
    file_size?: number | null;
    file_format?: string | null;
    tags?: unknown;
    created_at?: string;
    updated_at?: string;
}

const NOT_AVAILABLE = '素材存储尚未接入境内对象存储，暂不支持该操作';

function toMaterial(row: ApiMaterial): Material {
    return {
        id: row.id,
        user_id: row.created_by ?? '',
        name: row.name ?? '未命名素材',
        url: row.file_url,
        type: row.material_type === 'video' ? 'video' : 'image',
        file_size: row.file_size ?? undefined,
        mime_type: row.file_format ?? undefined,
        tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
        is_favorite: false,
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}

export async function getUserMaterials(_userId: string, options?: {
    type?: 'image' | 'video';
    tag?: string;
    favorite?: boolean;
    limit?: number;
    offset?: number;
}): Promise<Material[]> {
    const query = options?.type ? `?type=${encodeURIComponent(options.type)}` : '';
    const rows = await apiClient.get<ApiMaterial[]>(`/materials${query}`);
    let list = (Array.isArray(rows) ? rows : []).map(toMaterial);
    if (options?.tag) list = list.filter((m) => m.tags.includes(options.tag!));
    if (options?.favorite !== undefined) list = list.filter((m) => m.is_favorite === options.favorite);
    const start = options?.offset ?? 0;
    return options?.limit ? list.slice(start, start + options.limit) : list.slice(start);
}

/** 上传：由后端决定。未接入对象存储时后端返回原因，这里原样抛给页面展示。 */
export async function uploadMaterial(
    _userId: string,
    file: File,
    _options?: { tags?: string[]; onProgress?: (progress: number) => void },
): Promise<Material | null> {
    const row = await apiClient.post<ApiMaterial>('/materials/upload', {
        name: file.name,
        size: file.size,
        mimeType: file.type,
    });
    return row ? toMaterial(row) : null;
}

export async function deleteMaterial(_materialId: string, _userId: string): Promise<boolean> {
    throw new FriendlyApiError(NOT_AVAILABLE);
}

export async function toggleFavorite(_materialId: string, _userId: string): Promise<boolean> {
    throw new FriendlyApiError(NOT_AVAILABLE);
}

export async function updateMaterialTags(_materialId: string, _userId: string, _tags: string[]): Promise<boolean> {
    throw new FriendlyApiError(NOT_AVAILABLE);
}

export async function getMaterialStats(userId: string): Promise<{
    total: number;
    images: number;
    videos: number;
    storageUsed: number;
    favorites: number;
}> {
    const list = await getUserMaterials(userId);
    return {
        total: list.length,
        images: list.filter((m) => m.type === 'image').length,
        videos: list.filter((m) => m.type === 'video').length,
        storageUsed: list.reduce((sum, m) => sum + (m.file_size ?? 0), 0),
        favorites: list.filter((m) => m.is_favorite).length,
    };
}

export async function searchMaterials(userId: string, keyword: string): Promise<Material[]> {
    const needle = keyword.trim().toLowerCase();
    const list = await getUserMaterials(userId);
    return needle ? list.filter((m) => m.name.toLowerCase().includes(needle) || m.tags.some((t) => t.toLowerCase().includes(needle))) : list;
}

/** 存储用量：已用量按素材累加；上限取当前套餐（/billing/subscription 的 limits.max_storage_gb）。 */
export async function getStorageUsage(userId: string): Promise<{
    used: number;
    limit: number;
    percentage: number;
}> {
    const [stats, subscription] = await Promise.all([
        getMaterialStats(userId),
        apiClient.get<{ limits?: { max_storage_gb?: number } }>('/billing/subscription').catch(() => null),
    ]);
    const gb = Number(subscription?.limits?.max_storage_gb ?? 0);
    const limit = gb > 0 ? gb * 1024 * 1024 * 1024 : 0;
    const percentage = limit > 0 ? Math.min((stats.storageUsed / limit) * 100, 100) : 0;
    return { used: stats.storageUsed, limit, percentage };
}
