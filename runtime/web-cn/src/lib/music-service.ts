/**
 * Background Music Service
 * AI 背景音乐匹配服务 - 根据视频情绪推荐音乐
 */

export type MusicMood = 
    | 'upbeat'       // 欢快
    | 'relaxed'      // 放松
    | 'dramatic'     // 戏剧性
    | 'romantic'     // 浪漫
    | 'mysterious'   // 神秘
    | 'energetic'    // 充满能量
    | 'peaceful'     // 平静
    | 'inspiring'    // 励志
    | 'nostalgic'    // 怀旧
    | 'tense'        // 紧张
    | 'playful'      // 俏皮
    | 'epic'         // 史诗;

export type VideoEmotion = 
    | 'happy'        // 开心
    | 'sad'          // 悲伤
    | 'excited'      // 兴奋
    | 'calm'         // 平静
    | 'romantic'     // 浪漫
    | 'mysterious'   // 神秘
    | 'motivational' // 励志
    | 'humorous'     // 幽默
    | 'serious'      // 严肃
    | 'tension'      // 紧张;

export interface MusicTrack {
    id: string;
    title: string;
    artist: string;
    duration: number;        // 时长（秒）
    mood: MusicMood[];
    tempo: number;           // BPM
    energy: number;          // 能量值 0-100
    genre: string;
    url?: string;            // 音乐 URL
    previewUrl?: string;     // 预览 URL
    tags: string[];
    license: string;         // 许可证类型
    isCopyrightFree: boolean;
}

export interface MusicMatchParams {
    videoDuration: number;
    emotion: VideoEmotion;
    style?: string;
    genre?: string;
    tempo?: number;
    energy?: number;
    needLoop?: boolean;      // 是否需要循环
    allowDownload?: boolean;
}

export interface MusicMatchResult {
    tracks: MusicTrack[];
    recommendedMood: MusicMood;
    confidence: number;       // 匹配度 0-100
    playlist: MusicTrack[];
    totalDuration: number;
}

export interface MusicLicenseInfo {
    type: string;
    description: string;
    allowed: string[];
    requirement?: string;
    restriction?: string;
}

// ==================== 内置音乐库（模拟数据） ====================

const BUILTIN_MUSIC_TRACKS: MusicTrack[] = [
    {
        id: 'bgm-001',
        title: 'Sunny Morning',
        artist: 'Creative Commons',
        duration: 180,
        mood: ['upbeat', 'playful'],
        tempo: 120,
        energy: 70,
        genre: 'Pop',
        tags: ['轻松', '快乐', '早晨', '阳光'],
        license: 'CC0',
        isCopyrightFree: true,
    },
    {
        id: 'bgm-002',
        title: 'Peaceful Meditation',
        artist: 'Zen Sounds',
        duration: 240,
        mood: ['relaxed', 'peaceful'],
        tempo: 60,
        energy: 20,
        genre: 'Ambient',
        tags: ['冥想', '放松', '平静', '治愈'],
        license: 'CC0',
        isCopyrightFree: true,
    },
    {
        id: 'bgm-003',
        title: 'Epic Journey',
        artist: 'Cinematic Studio',
        duration: 200,
        mood: ['epic', 'dramatic', 'inspiring'],
        tempo: 90,
        energy: 85,
        genre: 'Cinematic',
        tags: ['史诗', '励志', '大气', '电影感'],
        license: 'CC-BY',
        isCopyrightFree: true,
    },
    {
        id: 'bgm-004',
        title: 'Romantic Sunset',
        artist: 'Love Songs',
        duration: 210,
        mood: ['romantic', 'peaceful'],
        tempo: 75,
        energy: 45,
        genre: 'Romance',
        tags: ['浪漫', '夕阳', '爱情', '温柔'],
        license: 'CC-BY-NC',
        isCopyrightFree: false,
    },
    {
        id: 'bgm-005',
        title: 'Mystery Chase',
        artist: 'Horror Themes',
        duration: 150,
        mood: ['mysterious', 'tense'],
        tempo: 110,
        energy: 65,
        genre: 'Thriller',
        tags: ['悬疑', '紧张', '追逐', '神秘'],
        license: 'CC0',
        isCopyrightFree: true,
    },
    {
        id: 'bgm-006',
        title: 'Workout Power',
        artist: 'Gym Beats',
        duration: 180,
        mood: ['energetic', 'upbeat'],
        tempo: 140,
        energy: 95,
        genre: 'Electronic',
        tags: ['健身', '能量', '运动', '力量'],
        license: 'CC-BY',
        isCopyrightFree: true,
    },
    {
        id: 'bgm-007',
        title: 'Coffee Shop',
        artist: 'Lo-Fi Beats',
        duration: 240,
        mood: ['relaxed', 'nostalgic'],
        tempo: 85,
        energy: 35,
        genre: 'Lo-Fi',
        tags: ['咖啡', '怀旧', '轻松', '午后'],
        license: 'CC0',
        isCopyrightFree: true,
    },
    {
        id: 'bgm-008',
        title: 'Dream Big',
        artist: 'Motivation',
        duration: 200,
        mood: ['inspiring', 'epic'],
        tempo: 100,
        energy: 80,
        genre: 'Inspirational',
        tags: ['梦想', '励志', '成功', '努力'],
        license: 'CC-BY',
        isCopyrightFree: true,
    },
    {
        id: 'bgm-009',
        title: 'Funny Moments',
        artist: 'Comedy Sound',
        duration: 120,
        mood: ['playful', 'upbeat'],
        tempo: 130,
        energy: 60,
        genre: 'Comedy',
        tags: ['搞笑', '有趣', '幽默', '轻松'],
        license: 'CC0',
        isCopyrightFree: true,
    },
    {
        id: 'bgm-010',
        title: 'News Theme',
        artist: 'Broadcasting',
        duration: 30,
        mood: ['dramatic', 'epic'],
        tempo: 95,
        energy: 55,
        genre: 'News',
        tags: ['新闻', '严肃', '正式', '播报'],
        license: 'CC0',
        isCopyrightFree: true,
    },
    {
        id: 'bgm-011',
        title: 'Nature Sounds',
        artist: 'ASMR',
        duration: 300,
        mood: ['peaceful', 'relaxed'],
        tempo: 0,
        energy: 10,
        genre: 'Nature',
        tags: ['自然', '治愈', '森林', '鸟鸣'],
        license: 'CC0',
        isCopyrightFree: true,
    },
    {
        id: 'bgm-012',
        title: 'Victory Fanfare',
        artist: 'Orchestra',
        duration: 60,
        mood: ['epic', 'dramatic', 'inspiring'],
        tempo: 120,
        energy: 90,
        genre: 'Classical',
        tags: ['胜利', '庆祝', '成功', '荣耀'],
        license: 'CC0',
        isCopyrightFree: true,
    },
];

// ==================== 情绪到音乐风格映射 ====================

const EMOTION_TO_MOOD: Record<VideoEmotion, MusicMood[]> = {
    'happy': ['upbeat', 'playful', 'energetic'],
    'sad': ['peaceful', 'nostalgic', 'relaxed'],
    'excited': ['energetic', 'upbeat', 'epic'],
    'calm': ['peaceful', 'relaxed', 'romantic'],
    'romantic': ['romantic', 'peaceful'],
    'mysterious': ['mysterious', 'tense'],
    'motivational': ['inspiring', 'epic', 'energetic'],
    'humorous': ['playful', 'upbeat'],
    'serious': ['dramatic', 'epic'],
    'tension': ['tense', 'mysterious', 'dramatic'],
};

// ==================== 视频类型到音乐风格映射 ====================

const VIDEO_TYPE_TO_MOOD: Record<string, MusicMood[]> = {
    'product_review': ['upbeat', 'energetic'],
    'knowledge_share': ['peaceful', 'relaxed'],
    'life_vlog': ['upbeat', 'peaceful'],
    'hot_take': ['dramatic', 'energetic'],
    'tutorial': ['peaceful', 'relaxed'],
    'storytelling': ['dramatic', 'romantic', 'epic'],
    'motivation': ['inspiring', 'epic'],
    'comedy': ['playful', 'upbeat'],
    'news_commentary': ['dramatic', 'epic'],
    'asmr': ['peaceful', 'relaxed'],
};

// ==================== 核心功能函数 ====================

/**
 * 根据视频信息推荐音乐
 */
export function recommendMusic(params: MusicMatchParams): MusicMatchResult {
    const { videoDuration, emotion, style, tempo, energy, needLoop = true } = params;

    // 1. 确定推荐的情绪风格
    const recommendedMoods = EMOTION_TO_MOOD[emotion] || ['peaceful'];

    // 2. 计算匹配度并排序
    const scoredTracks = BUILTIN_MUSIC_TRACKS.map(track => {
        let score = 0;

        // 情绪匹配度（最重要）
        const moodMatch = track.mood.filter(m => recommendedMoods.includes(m)).length;
        score += moodMatch * 30;

        // BPM 匹配（如果指定）
        if (tempo !== undefined) {
            const tempoDiff = Math.abs(track.tempo - tempo);
            score += Math.max(0, 20 - tempoDiff) * 2;
        }

        // 能量匹配（如果指定）
        if (energy !== undefined) {
            const energyDiff = Math.abs(track.energy - energy);
            score += Math.max(0, 15 - energyDiff) * 2;
        }

        // 免费音乐优先级
        if (track.isCopyrightFree) {
            score += 10;
        }

        return { track, score: Math.min(100, score) };
    });

    // 3. 按分数排序
    scoredTracks.sort((a, b) => b.score - a.score);

    // 4. 选择最佳匹配
    const bestMatch = scoredTracks[0];
    const topTracks = scoredTracks.slice(0, 5).map(s => s.track);

    // 5. 生成播放列表
    let playlist: MusicTrack[] = [];
    let totalDuration = 0;

    if (needLoop) {
        // 循环播放以覆盖视频时长
        for (const track of topTracks) {
            while (totalDuration < videoDuration) {
                playlist.push({ ...track, id: `${track.id}-${totalDuration}` });
                totalDuration += track.duration;
                if (totalDuration >= videoDuration) break;
            }
            if (totalDuration >= videoDuration) break;
        }
    } else {
        // 只选择一首最合适的
        playlist = topTracks.slice(0, 1);
        totalDuration = playlist[0]?.duration || 0;
    }

    return {
        tracks: topTracks,
        recommendedMood: recommendedMoods[0],
        confidence: bestMatch?.score || 50,
        playlist,
        totalDuration: Math.min(totalDuration, videoDuration),
    };
}

/**
 * 根据视频类型推荐音乐
 */
export function recommendMusicByVideoType(
    videoType: string,
    duration: number
): MusicMatchResult {
    const moods = VIDEO_TYPE_TO_MOOD[videoType] || ['peaceful', 'relaxed'];

    const scoredTracks = BUILTIN_MUSIC_TRACKS.map(track => {
        let score = 0;
        const moodMatch = track.mood.filter(m => moods.includes(m)).length;
        score += moodMatch * 30;
        if (track.isCopyrightFree) score += 10;
        return { track, score: Math.min(100, score) };
    });

    scoredTracks.sort((a, b) => b.score - a.score);

    return {
        tracks: scoredTracks.slice(0, 5).map(s => s.track),
        recommendedMood: moods[0],
        confidence: scoredTracks[0]?.score || 50,
        playlist: scoredTracks.slice(0, 3).map(s => s.track),
        totalDuration: duration,
    };
}

/**
 * 搜索音乐
 */
export function searchMusic(query: string): MusicTrack[] {
    const lowerQuery = query.toLowerCase();
    
    return BUILTIN_MUSIC_TRACKS.filter(track =>
        track.title.toLowerCase().includes(lowerQuery) ||
        track.artist.toLowerCase().includes(lowerQuery) ||
        track.genre.toLowerCase().includes(lowerQuery) ||
        track.tags.some(tag => tag.toLowerCase().includes(lowerQuery)) ||
        track.mood.some(m => m.includes(lowerQuery))
    );
}

/**
 * 根据 mood 获取音乐
 */
export function getMusicByMood(mood: MusicMood, limit: number = 5): MusicTrack[] {
    return BUILTIN_MUSIC_TRACKS
        .filter(track => track.mood.includes(mood))
        .slice(0, limit);
}

/**
 * 获取所有可用音乐
 */
export function getAllMusic(): MusicTrack[] {
    return BUILTIN_MUSIC_TRACKS;
}

/**
 * 获取免费音乐
 */
export function getCopyrightFreeMusic(): MusicTrack[] {
    return BUILTIN_MUSIC_TRACKS.filter(track => track.isCopyrightFree);
}

/**
 * 音乐情绪预览（返回可视化的情绪卡片）
 */
export function getMoodPreview(): { mood: MusicMood; label: string; icon: string; color: string }[] {
    return [
        { mood: 'upbeat', label: '欢快', icon: '😊', color: '#FFD700' },
        { mood: 'relaxed', label: '放松', icon: '😌', color: '#98D8C8' },
        { mood: 'dramatic', label: '戏剧性', icon: '🎭', color: '#7B68EE' },
        { mood: 'romantic', label: '浪漫', icon: '💕', color: '#FF6B6B' },
        { mood: 'mysterious', label: '神秘', icon: '🔮', color: '#4A4A4A' },
        { mood: 'energetic', label: '充满能量', icon: '⚡', color: '#FF4500' },
        { mood: 'peaceful', label: '平静', icon: '🕊️', color: '#87CEEB' },
        { mood: 'inspiring', label: '励志', icon: '🌟', color: '#FFD700' },
        { mood: 'nostalgic', label: '怀旧', icon: '📸', color: '#DDA0DD' },
        { mood: 'tense', label: '紧张', icon: '😰', color: '#4B0082' },
        { mood: 'playful', label: '俏皮', icon: '😜', color: '#FF69B4' },
        { mood: 'epic', label: '史诗', icon: '🏰', color: '#C0C0C0' },
    ];
}

/**
 * 计算音乐播放时长
 */
export function calculateMusicDuration(
    musicDuration: number,
    videoDuration: number,
    loop: boolean = true
): number {
    if (!loop) return Math.min(musicDuration, videoDuration);
    
    // 循环播放直到覆盖视频
    const loops = Math.ceil(videoDuration / musicDuration);
    return Math.min(musicDuration * loops, videoDuration);
}

/**
 * 音乐版权信息
 */
export function getMusicLicenseInfo(): MusicLicenseInfo[] {
    return [
        {
            type: 'CC0',
            description: 'Public domain, no rights reserved',
            allowed: ['Commercial use', 'Modification', 'Distribution', 'Private use'],
        },
        {
            type: 'CC-BY',
            description: 'Attribution required',
            allowed: ['Commercial use', 'Modification', 'Distribution', 'Private use'],
            requirement: 'Must credit the author',
        },
        {
            type: 'CC-BY-NC',
            description: 'Attribution - Non-commercial',
            allowed: ['Modification', 'Distribution', 'Private use'],
            restriction: 'No commercial use allowed',
        },
        {
            type: 'CC-BY-SA',
            description: 'Attribution - ShareAlike',
            allowed: ['Commercial use', 'Modification', 'Distribution'],
            requirement: 'Must credit author, derivative works must use same license',
        },
    ];
}

// ==================== 导出 ====================

export const musicService = {
    recommend: recommendMusic,
    recommendByVideoType: recommendMusicByVideoType,
    search: searchMusic,
    getByMood: getMusicByMood,
    getAll: getAllMusic,
    getCopyrightFree: getCopyrightFreeMusic,
    getMoodPreview,
    getLicenseInfo: getMusicLicenseInfo,
    calculateDuration: calculateMusicDuration,
};

export default musicService;
