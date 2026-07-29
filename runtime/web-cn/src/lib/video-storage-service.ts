/**
 * Video Storage Service
 * 视频存储服务 - 管理用户生成的视频
 */

export interface VideoProject {
    id: string;
    userId: string;
    title: string;
    description?: string;
    
    // 视频信息
    videoUrl: string;
    thumbnailUrl?: string;
    duration: number;          // 时长（秒）
    width: number;
    height: number;
    fileSize: number;          // 文件大小（字节）
    
    // 生成参数
    script?: string;
    style?: string;
    voiceoverUrl?: string;
    musicUrl?: string;
    
    // 元数据
    tags: string[];
    category?: string;
    isPublic: boolean;
    views: number;
    likes: number;
    
    // 时间
    createdAt: Date;
    updatedAt: Date;
}

// 保存视频参数
export interface SaveVideoParams {
    userId: string;
    title: string;
    description?: string;
    videoUrl: string;
    thumbnailUrl?: string;
    duration: number;
    width: number;
    height: number;
    fileSize: number;
    script?: string;
    style?: string;
    voiceoverUrl?: string;
    musicUrl?: string;
    tags?: string[];
    category?: string;
    isPublic?: boolean;
}

// 更新视频参数
export interface UpdateVideoParams {
    title?: string;
    description?: string;
    thumbnailUrl?: string;
    tags?: string[];
    category?: string;
    isPublic?: boolean;
}

// 视频列表查询参数
export interface VideoQueryParams {
    userId: string;
    page?: number;
    limit?: number;
    category?: string;
    tags?: string[];
    isPublic?: boolean;
    sortBy?: 'createdAt' | 'views' | 'likes';
    sortOrder?: 'asc' | 'desc';
}

// 视频统计
export interface VideoStats {
    totalVideos: number;
    totalDuration: number;     // 总时长（秒）
    totalSize: number;         // 总大小（字节）
    totalViews: number;
    totalLikes: number;
}

// ==================== 本地存储键 ====================

const STORAGE_KEYS = {
    VIDEOS: 'fenfa_videos',
    DRAFTS: 'fenfa_video_drafts',
};

// ==================== 核心功能 ====================

/**
 * 保存视频到本地存储
 */
export function saveVideo(params: SaveVideoParams): VideoProject {
    const videos = getAllVideos();
    
    const newVideo: VideoProject = {
        id: `video-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        userId: params.userId,
        title: params.title,
        description: params.description,
        videoUrl: params.videoUrl,
        thumbnailUrl: params.thumbnailUrl,
        duration: params.duration,
        width: params.width,
        height: params.height,
        fileSize: params.fileSize,
        script: params.script,
        style: params.style,
        voiceoverUrl: params.voiceoverUrl,
        musicUrl: params.musicUrl,
        tags: params.tags || [],
        category: params.category,
        isPublic: params.isPublic ?? false,
        views: 0,
        likes: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
    };
    
    videos.unshift(newVideo);
    localStorage.setItem(STORAGE_KEYS.VIDEOS, JSON.stringify(videos));
    
    return newVideo;
}

/**
 * 获取所有视频
 */
export function getAllVideos(): VideoProject[] {
    if (typeof window === 'undefined') return [];
    
    const data = localStorage.getItem(STORAGE_KEYS.VIDEOS);
    if (!data) return [];
    
    try {
        return JSON.parse(data).map((v: any) => ({
            ...v,
            createdAt: new Date(v.createdAt),
            updatedAt: new Date(v.updatedAt),
        }));
    } catch {
        return [];
    }
}

/**
 * 获取用户的视频
 */
export function getUserVideos(userId: string, params?: Partial<VideoQueryParams>): VideoProject[] {
    const videos = getAllVideos();
    
    return videos.filter(v => v.userId === userId);
}

/**
 * 分页获取用户视频
 */
export function getVideosByPage(params: VideoQueryParams): { videos: VideoProject[]; total: number } {
    let videos = getAllVideos().filter(v => v.userId === params.userId);
    
    // 筛选
    if (params.category) {
        videos = videos.filter(v => v.category === params.category);
    }
    
    if (params.tags && params.tags.length > 0) {
        videos = videos.filter(v => 
            params.tags!.some(tag => v.tags.includes(tag))
        );
    }
    
    if (params.isPublic !== undefined) {
        videos = videos.filter(v => v.isPublic === params.isPublic);
    }
    
    // 排序
    const sortBy = params.sortBy || 'createdAt';
    const sortOrder = params.sortOrder || 'desc';
    
    videos.sort((a, b) => {
        let comparison = 0;
        switch (sortBy) {
            case 'createdAt':
                comparison = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                break;
            case 'views':
                comparison = b.views - a.views;
                break;
            case 'likes':
                comparison = b.likes - a.likes;
                break;
        }
        return sortOrder === 'desc' ? comparison : -comparison;
    });
    
    // 分页
    const page = params.page || 1;
    const limit = params.limit || 10;
    const start = (page - 1) * limit;
    const end = start + limit;
    
    return {
        videos: videos.slice(start, end),
        total: videos.length,
    };
}

/**
 * 获取单个视频
 */
export function getVideo(id: string): VideoProject | null {
    const videos = getAllVideos();
    return videos.find(v => v.id === id) || null;
}

/**
 * 更新视频
 */
export function updateVideo(id: string, params: UpdateVideoParams): VideoProject | null {
    const videos = getAllVideos();
    const index = videos.findIndex(v => v.id === id);
    
    if (index === -1) return null;
    
    videos[index] = {
        ...videos[index],
        ...params,
        updatedAt: new Date(),
    };
    
    localStorage.setItem(STORAGE_KEYS.VIDEOS, JSON.stringify(videos));
    
    return videos[index];
}

/**
 * 删除视频
 */
export function deleteVideo(id: string): boolean {
    const videos = getAllVideos();
    const filtered = videos.filter(v => v.id !== id);
    
    if (filtered.length === videos.length) return false;
    
    localStorage.setItem(STORAGE_KEYS.VIDEOS, JSON.stringify(filtered));
    return true;
}

/**
 * 增加播放量
 */
export function incrementViews(id: string): void {
    const video = getVideo(id);
    if (video) {
        updateVideo(id, {});
    }
}

/**
 * 增加点赞数
 */
export function toggleLike(id: string): boolean {
    const videos = getAllVideos();
    const video = videos.find(v => v.id === id);
    
    if (!video) return false;
    
    // 这里可以添加用户点赞记录的逻辑
    video.likes = (video.likes || 0) + 1;
    localStorage.setItem(STORAGE_KEYS.VIDEOS, JSON.stringify(videos));
    
    return true;
}

/**
 * 获取用户视频统计
 */
export function getUserVideoStats(userId: string): VideoStats {
    const videos = getAllVideos().filter(v => v.userId === userId);
    
    return {
        totalVideos: videos.length,
        totalDuration: videos.reduce((sum, v) => sum + v.duration, 0),
        totalSize: videos.reduce((sum, v) => sum + v.fileSize, 0),
        totalViews: videos.reduce((sum, v) => sum + v.views, 0),
        totalLikes: videos.reduce((sum, v) => sum + v.likes, 0),
    };
}

/**
 * 获取视频分类
 */
export function getVideoCategories(userId: string): { category: string; count: number }[] {
    const videos = getAllVideos().filter(v => v.userId === userId);
    const categories: Record<string, number> = {};
    
    videos.forEach(v => {
        if (v.category) {
            categories[v.category] = (categories[v.category] || 0) + 1;
        }
    });
    
    return Object.entries(categories).map(([category, count]) => ({
        category,
        count,
    }));
}

/**
 * 获取热门标签
 */
export function getPopularTags(userId: string, limit: number = 10): { tag: string; count: number }[] {
    const videos = getAllVideos().filter(v => v.userId === userId);
    const tags: Record<string, number> = {};
    
    videos.forEach(v => {
        v.tags.forEach(tag => {
            tags[tag] = (tags[tag] || 0) + 1;
        });
    });
    
    return Object.entries(tags)
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);
}

/**
 * 搜索视频
 */
export function searchVideos(
    userId: string,
    query: string,
    limit: number = 20
): VideoProject[] {
    const lowerQuery = query.toLowerCase();
    const videos = getAllVideos().filter(v => v.userId === userId);
    
    return videos.filter(v =>
        v.title.toLowerCase().includes(lowerQuery) ||
        v.description?.toLowerCase().includes(lowerQuery) ||
        v.tags.some(t => t.toLowerCase().includes(lowerQuery)) ||
        v.script?.toLowerCase().includes(lowerQuery)
    ).slice(0, limit);
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * 格式化时长
 */
export function formatDuration(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    
    if (h > 0) {
        return `${h}:${pad(m)}:${pad(s)}`;
    }
    return `${m}:${pad(s)}`;
}

function pad(num: number): string {
    return num.toString().padStart(2, '0');
}

// ==================== 草稿管理 ====================

export interface VideoDraft {
    id: string;
    userId: string;
    title: string;
    script?: string;
    style?: string;
    segments: VideoSegmentDraft[];
    voiceover?: VoiceoverDraft;
    music?: MusicDraft;
    subtitles?: SubtitleDraft[];
    createdAt: Date;
    updatedAt: Date;
}

interface VideoSegmentDraft {
    id: string;
    prompt: string;
    imageUrl?: string;
    duration: number;
    transition?: string;
}

interface VoiceoverDraft {
    text: string;
    voice: string;
    audioUrl?: string;
}

interface MusicDraft {
    mood: string;
    url?: string;
    volume: number;
}

interface SubtitleDraft {
    text: string;
    startTime: number;
    endTime: number;
}

/**
 * 保存草稿
 */
export function saveDraft(draft: Omit<VideoDraft, 'id' | 'createdAt' | 'updatedAt'>): VideoDraft {
    const drafts = getAllDrafts();
    
    const newDraft: VideoDraft = {
        ...draft,
        id: `draft-${Date.now()}`,
        createdAt: new Date(),
        updatedAt: new Date(),
    };
    
    drafts.unshift(newDraft);
    localStorage.setItem(STORAGE_KEYS.DRAFTS, JSON.stringify(drafts));
    
    return newDraft;
}

/**
 * 获取所有草稿
 */
export function getAllDrafts(): VideoDraft[] {
    if (typeof window === 'undefined') return [];
    
    const data = localStorage.getItem(STORAGE_KEYS.DRAFTS);
    if (!data) return [];
    
    try {
        return JSON.parse(data);
    } catch {
        return [];
    }
}

/**
 * 获取用户草稿
 */
export function getUserDrafts(userId: string): VideoDraft[] {
    return getAllDrafts().filter(d => d.userId === userId);
}

/**
 * 删除草稿
 */
export function deleteDraft(id: string): boolean {
    const drafts = getAllDrafts();
    const filtered = drafts.filter(d => d.id !== id);
    
    if (filtered.length === drafts.length) return false;
    
    localStorage.setItem(STORAGE_KEYS.DRAFTS, JSON.stringify(filtered));
    return true;
}

// ==================== 导出 ====================

export const videoStorageService = {
    save: saveVideo,
    getAll: getAllVideos,
    getByUser: getUserVideos,
    getByPage: getVideosByPage,
    get: getVideo,
    update: updateVideo,
    delete: deleteVideo,
    incrementViews,
    toggleLike,
    getStats: getUserVideoStats,
    getVideoCategories,
    getPopularTags,
    search: searchVideos,
    formatFileSize,
    formatDuration,
    drafts: {
        save: saveDraft,
        getAll: getAllDrafts,
        getByUser: getUserDrafts,
        delete: deleteDraft,
    },
};

export default videoStorageService;
