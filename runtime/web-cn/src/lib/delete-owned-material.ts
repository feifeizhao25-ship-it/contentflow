import type { SupabaseClient } from '@supabase/supabase-js';

/** 存储失败时保留记录供重试；不能将文件残留报告为删除成功。 */
export async function deleteOwnedMaterial(client: SupabaseClient, materialId: string, userId: string): Promise<boolean> {
    try {
        const { data: material, error } = await client.from('materials').select('url')
            .eq('id', materialId).eq('user_id', userId).single();
        if (error || !material) return false;

        const bucket = client.storage.from('materials');
        const { data: { publicUrl } } = bucket.getPublicUrl(`${userId}/`);
        const prefix = new URL(publicUrl);
        const url = new URL(material.url);
        if (url.origin !== prefix.origin || !url.pathname.startsWith(prefix.pathname)) return false;
        const name = decodeURIComponent(url.pathname.slice(prefix.pathname.length));
        if (!name || name.includes('/') || name.includes('\\') || name.includes('\0') || name === '.' || name === '..') return false;
        const { error: storageError } = await bucket.remove([`${userId}/${name}`]);
        if (storageError) return false;

        const { data: deleted, error: deleteError } = await client.from('materials').delete()
            .eq('id', materialId).eq('user_id', userId).select('id');
        return !deleteError && Array.isArray(deleted) && deleted.some(row => row.id === materialId);
    } catch {
        return false;
    }
}
