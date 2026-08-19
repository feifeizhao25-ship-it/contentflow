import { supabase } from './supabase';

export interface Content {
    id?: string;
    user_id: string;
    workspace_id?: string;
    title: string;
    content: string;
    summary?: string;
    platform: string;
    status: 'draft' | 'scheduled' | 'published';
    topic?: string;
    style?: string;
    images?: string[];
    tags?: string[];
    scheduled_date?: string;
    scheduled_time?: string;
    published_at?: string;
    views?: number;
    likes?: number;
    comments?: number;
    shares?: number;
    created_at?: string;
    updated_at?: string;
}

// 创建内容
export async function createContent(content: Omit<Content, 'id' | 'created_at' | 'updated_at'>): Promise<Content | null> {
    const { data, error } = await supabase
        .from('contents')
        .insert(content)
        .select()
        .single();

    if (error) {
        console.error('Error creating content:', error);
        throw error;
    }

    return data;
}

// 获取用户的所有内容
export async function getUserContents(userId: string, options?: { 
    limit?: number; 
    offset?: number;
    status?: string;
    platform?: string;
}): Promise<Content[]> {
    let query = supabase
        .from('contents')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (options?.status) {
        query = query.eq('status', options.status);
    }
    if (options?.platform) {
        query = query.eq('platform', options.platform);
    }
    if (options?.limit) {
        query = query.limit(options.limit);
    }
    if (options?.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching contents:', error);
        throw error;
    }

    return data || [];
}

// 获取单条内容
export async function getContent(contentId: string): Promise<Content | null> {
    const { data, error } = await supabase
        .from('contents')
        .select('*')
        .eq('id', contentId)
        .single();

    if (error) {
        if (error.code === 'PGRST116') {
            return null; // Not found
        }
        console.error('Error fetching content:', error);
        throw error;
    }

    return data;
}

// 更新内容
export async function updateContent(contentId: string, updates: Partial<Content>): Promise<Content | null> {
    const { data, error } = await supabase
        .from('contents')
        .update(updates)
        .eq('id', contentId)
        .select()
        .single();

    if (error) {
        console.error('Error updating content:', error);
        throw error;
    }

    return data;
}

// 删除内容
export async function deleteContent(contentId: string): Promise<void> {
    const { error } = await supabase
        .from('contents')
        .delete()
        .eq('id', contentId);

    if (error) {
        console.error('Error deleting content:', error);
        throw error;
    }
}

// 更新发布统计
export async function updatePublishStats(contentId: string, stats: { views?: number; likes?: number; comments?: number; shares?: number }): Promise<void> {
    const { error } = await supabase
        .from('contents')
        .update({
            ...stats,
            updated_at: new Date().toISOString()
        })
        .eq('id', contentId);

    if (error) {
        console.error('Error updating stats:', error);
        throw error;
    }
}

// 批量获取内容
export async function batchGetContents(contentIds: string[]): Promise<Content[]> {
    const { data, error } = await supabase
        .from('contents')
        .select('*')
        .in('id', contentIds);

    if (error) {
        console.error('Error batch fetching contents:', error);
        throw error;
    }

    return data || [];
}

// 搜索内容
export async function searchContents(userId: string, keyword: string): Promise<Content[]> {
    const { data, error } = await supabase
        .from('contents')
        .select('*')
        .eq('user_id', userId)
        .or(`title.ilike.%${keyword}%,content.ilike.%${keyword}%`)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error searching contents:', error);
        throw error;
    }

    return data || [];
}
