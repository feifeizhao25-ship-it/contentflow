import { supabase } from './supabase';

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

// 上传素材到 Supabase Storage
export async function uploadMaterial(
    userId: string,
    file: File,
    options?: { tags?: string[]; onProgress?: (progress: number) => void }
): Promise<Material | null> {
    try {
        const fileName = `${Date.now()}-${file.name}`;
        const filePath = `${userId}/${fileName}`;

        // 上传到 Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('materials')
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: false
            });

        if (uploadError) {
            console.error('Upload error:', uploadError);
            throw uploadError;
        }

        // 获取公开 URL
        const { data: { publicUrl } } = supabase.storage
            .from('materials')
            .getPublicUrl(filePath);

        // 保存素材记录到数据库
        const { data: material, error: dbError } = await supabase
            .from('materials')
            .insert({
                user_id: userId,
                name: file.name,
                url: publicUrl,
                type: file.type.startsWith('image') ? 'image' : 'video',
                file_size: file.size,
                mime_type: file.type,
                tags: options?.tags || ['未分类'],
                is_favorite: false
            })
            .select()
            .single();

        if (dbError) {
            console.error('Database error:', dbError);
            throw dbError;
        }

        return material;
    } catch (error) {
        console.error('uploadMaterial error:', error);
        return null;
    }
}

// 获取用户素材列表
export async function getUserMaterials(userId: string, options?: {
    type?: 'image' | 'video';
    tag?: string;
    favorite?: boolean;
    limit?: number;
    offset?: number;
}): Promise<Material[]> {
    try {
        let query = supabase
            .from('materials')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (options?.type) {
            query = query.eq('type', options.type);
        }
        if (options?.tag) {
            query = query.contains('tags', [options.tag]);
        }
        if (options?.favorite !== undefined) {
            query = query.eq('is_favorite', options.favorite);
        }
        if (options?.limit) {
            query = query.limit(options.limit);
        }
        if (options?.offset) {
            query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Error fetching materials:', error);
            throw error;
        }

        return data || [];
    } catch (error) {
        console.error('getUserMaterials error:', error);
        return [];
    }
}

// 删除素材
export async function deleteMaterial(materialId: string, userId: string): Promise<boolean> {
    try {
        // 获取素材信息
        const { data: material, error: fetchError } = await supabase
            .from('materials')
            .select('url')
            .eq('id', materialId)
            .eq('user_id', userId)
            .single();

        if (fetchError || !material) {
            console.error('Material not found');
            return false;
        }

        // 从 Storage 删除文件
        const urlPath = material.url.split('/').pop();
        if (urlPath) {
            await supabase.storage
                .from('materials')
                .remove([`${userId}/${urlPath}`]);
        }

        // 从数据库删除记录
        const { error: deleteError } = await supabase
            .from('materials')
            .delete()
            .eq('id', materialId)
            .eq('user_id', userId);

        if (deleteError) {
            console.error('Error deleting material:', deleteError);
            throw deleteError;
        }

        return true;
    } catch (error) {
        console.error('deleteMaterial error:', error);
        return false;
    }
}

// 切换收藏状态
export async function toggleFavorite(materialId: string, userId: string): Promise<boolean> {
    try {
        // 先获取当前状态
        const { data: material } = await supabase
            .from('materials')
            .select('is_favorite')
            .eq('id', materialId)
            .eq('user_id', userId)
            .single();

        if (!material) {
            return false;
        }

        const { error } = await supabase
            .from('materials')
            .update({ 
                is_favorite: !material.is_favorite,
                updated_at: new Date().toISOString()
            })
            .eq('id', materialId)
            .eq('user_id', userId);

        if (error) {
            console.error('Error toggling favorite:', error);
            throw error;
        }

        return true;
    } catch (error) {
        console.error('toggleFavorite error:', error);
        return false;
    }
}

// 更新素材标签
export async function updateMaterialTags(materialId: string, userId: string, tags: string[]): Promise<boolean> {
    try {
        const { error } = await supabase
            .from('materials')
            .update({
                tags,
                updated_at: new Date().toISOString()
            })
            .eq('id', materialId)
            .eq('user_id', userId);

        if (error) {
            console.error('Error updating tags:', error);
            throw error;
        }

        return true;
    } catch (error) {
        console.error('updateMaterialTags error:', error);
        return false;
    }
}

// 获取素材统计
export async function getMaterialStats(userId: string): Promise<{
    total: number;
    images: number;
    videos: number;
    storageUsed: number;
    favorites: number;
}> {
    try {
        const { data: materials } = await supabase
            .from('materials')
            .select('type, file_size, is_favorite')
            .eq('user_id', userId);

        if (!materials || materials.length === 0) {
            return { total: 0, images: 0, videos: 0, storageUsed: 0, favorites: 0 };
        }

        const stats = {
            total: materials.length,
            images: materials.filter(m => m.type === 'image').length,
            videos: materials.filter(m => m.type === 'video').length,
            storageUsed: materials.reduce((sum, m) => sum + (m.file_size || 0), 0),
            favorites: materials.filter(m => m.is_favorite).length
        };

        return stats;
    } catch (error) {
        console.error('getMaterialStats error:', error);
        return { total: 0, images: 0, videos: 0, storageUsed: 0, favorites: 0 };
    }
}

// 搜索素材
export async function searchMaterials(userId: string, keyword: string): Promise<Material[]> {
    try {
        const { data, error } = await supabase
            .from('materials')
            .select('*')
            .eq('user_id', userId)
            .or(`name.ilike.%${keyword}%,tags.cs.{${keyword}}`)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error searching materials:', error);
            throw error;
        }

        return data || [];
    } catch (error) {
        console.error('searchMaterials error:', error);
        return [];
    }
}

// 获取素材存储使用量
export async function getStorageUsage(userId: string): Promise<{
    used: number;
    limit: number;
    percentage: number;
}> {
    try {
        const stats = await getMaterialStats(userId);
        
        // 免费版 1GB，Pro 10GB
        const limit = 10 * 1024 * 1024 * 1024; // 10GB in bytes
        const percentage = Math.min((stats.storageUsed / limit) * 100, 100);

        return {
            used: stats.storageUsed,
            limit,
            percentage
        };
    } catch (error) {
        console.error('getStorageUsage error:', error);
        return { used: 0, limit: 10 * 1024 * 1024 * 1024, percentage: 0 };
    }
}
