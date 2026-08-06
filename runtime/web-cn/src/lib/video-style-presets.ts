/**
 * Video Style Presets
 * 视频风格预设系统 - 提供 12 种热门风格模板
 */

// ==================== 类型定义 ====================

export type VideoStyleId = 
    | 'cinematic' 
    | 'anime' 
    | '3d_render' 
    | 'cyberpunk' 
    | 'nature' 
    | 'minimalist'
    | 'vintage' 
    | 'high_energy' 
    | 'warm_cozy' 
    | 'tech_future'
    | 'product_showcase'
    | 'storytelling';

export interface VideoStylePreset {
    id: VideoStyleId;
    name: string;
    nameCn: string;
    icon: string;
    description: string;
    promptTemplate: string;      // 画面 prompt 模板
    negativePrompt: string;      // 负面 prompt
    keywords: string[];          // 风格关键词
    color: string;               // UI 展示颜色
    aspectRatios: string[];      // 支持的尺寸
}

export interface StyleApplyParams {
    basePrompt: string;
    style: VideoStyleId;
    aspectRatio?: '16:9' | '9:16' | '1:1';
    customKeywords?: string[];
}

// ==================== 风格预设定义 ====================

export const VIDEO_STYLE_PRESETS: VideoStylePreset[] = [
    {
        id: 'cinematic',
        name: 'Cinematic',
        nameCn: '电影质感',
        icon: '🎬',
        description: '电影级画面，大光圈，浅景深，电影感调色',
        promptTemplate: `{prompt}, cinematic masterpiece, film grain, anamorphic lens flares, shallow depth of field, dramatic lighting, movie still, 4k ultra hd, director's vision`,
        negativePrompt: 'cartoon, anime, 3d render, low quality, blurry, amateur, oversaturated, plastic skin',
        keywords: ['电影感', '浅景深', '戏剧光', '4K'],
        color: '#6366f1',
        aspectRatios: ['16:9', '1:1']
    },
    {
        id: 'anime',
        name: 'Anime Style',
        nameCn: '二次元动漫',
        icon: '🎨',
        description: '日本动漫风格，精致线条，色彩鲜艳',
        promptTemplate: `{prompt}, anime style, Japanese animation, hand drawn, detailed linework, vibrant colors, cel shading, studio ghibli inspired, masterpiece`,
        negativePrompt: 'photorealistic, 3d render, realistic, oil painting, sketch, low quality anime, poor anatomy',
        keywords: ['动漫', '二次元', '手绘', '赛璐璐'],
        color: '#ec4899',
        aspectRatios: ['16:9', '9:16', '1:1']
    },
    {
        id: '3d_render',
        name: '3D Render',
        nameCn: '3D 渲染',
        icon: '🧊',
        description: 'CGI 3D 渲染效果，干净现代',
        promptTemplate: `{prompt}, 3d render, CGI, octane render, blender 3d, unreal engine 5, photorealistic, studio lighting, clean lines, high detail`,
        negativePrompt: 'hand drawn, sketch, photograph, anime, cartoon, low poly, blurry',
        keywords: ['3D', 'CGI', '渲染', 'Octane'],
        color: '#14b8a6',
        aspectRatios: ['16:9', '1:1']
    },
    {
        id: 'cyberpunk',
        name: 'Cyberpunk',
        nameCn: '赛博朋克',
        icon: '🌃',
        description: '霓虹灯效，未来科技感，赛博风格',
        promptTemplate: `{prompt}, cyberpunk, neon lights, futuristic city, synthwave, holographic, cyberpunk aesthetic, volumetric lighting, blue and pink tones, blade runner style`,
        negativePrompt: 'natural, daylight, peaceful, rustic, medieval, vintage, warm colors',
        keywords: ['赛博', '霓虹', '未来', '科幻'],
        color: '#8b5cf6',
        aspectRatios: ['16:9', '9:16']
    },
    {
        id: 'nature',
        name: 'Nature',
        nameCn: '自然风光',
        icon: '🌲',
        description: '自然光线，清晰细节，户外场景',
        promptTemplate: `{prompt}, natural lighting, golden hour, soft sunlight, wilderness, landscape photography, national geographic style, high detail, 8k`,
        negativePrompt: 'indoor, artificial lighting, neon, dark, gloomy, urban, architectural',
        keywords: ['自然', '风光', '户外', '阳光'],
        color: '#22c55e',
        aspectRatios: ['16:9', '1:1']
    },
    {
        id: 'minimalist',
        name: 'Minimalist',
        nameCn: '极简风格',
        icon: '⬜',
        description: '简约设计，大量留白，现代感',
        promptTemplate: `{prompt}, minimalist design, clean lines, lots of white space, modern, sleek, simple composition, uncluttered, elegant`,
        negativePrompt: 'cluttered, busy, chaotic, overdetailed, vintage, ornate, maximalist',
        keywords: ['极简', '留白', '现代', '简约'],
        color: '#94a3b8',
        aspectRatios: ['16:9', '1:1', '9:16']
    },
    {
        id: 'vintage',
        name: 'Vintage',
        nameCn: '复古怀旧',
        icon: '📼',
        description: '胶片质感，复古色调，怀旧氛围',
        promptTemplate: `{prompt}, vintage aesthetic, film grain, faded colors, 1970s style, nostalgic, warm tones, faded film, retro photography, soft focus`,
        negativePrompt: 'modern, crisp, high contrast, neon, futuristic, digital clean',
        keywords: ['复古', '胶片', '怀旧', '温暖'],
        color: '#f59e0b',
        aspectRatios: ['16:9', '1:1']
    },
    {
        id: 'high_energy',
        name: 'High Energy',
        nameCn: '高能量',
        icon: '⚡',
        description: '动感十足，鲜艳色彩，适合带货',
        promptTemplate: `{prompt}, high energy, vibrant colors, dynamic composition, eye-catching, commercial style, bold, exciting, fast paced visuals, 4k commercial`,
        negativePrompt: 'calm, slow, muted colors, peaceful, dull, boring',
        keywords: ['动感', '鲜艳', '带货', '商业'],
        color: '#ef4444',
        aspectRatios: ['9:16', '16:9', '1:1']
    },
    {
        id: 'warm_cozy',
        name: 'Warm & Cozy',
        nameCn: '温暖治愈',
        icon: '☕',
        description: '柔和光线，温馨氛围，治愈系',
        promptTemplate: `{prompt}, warm and cozy, soft lighting, pastel colors, comforting atmosphere, peaceful, healing, gentle, soothing, homey`,
        negativePrompt: 'harsh, cold, dark, industrial, neon, intense, loud',
        keywords: ['温暖', '治愈', '柔和', '温馨'],
        color: '#f97316',
        aspectRatios: ['1:1', '9:16', '16:9']
    },
    {
        id: 'tech_future',
        name: 'Tech Future',
        nameCn: '科技未来',
        icon: '🔮',
        description: '高科技感，未来科技，智能风格',
        promptTemplate: `{prompt}, futuristic technology, sleek design, holographic, AI technology, smart, innovative, cutting edge, clean tech, white and blue tones`,
        negativePrompt: 'rustic, vintage, organic, natural, retro, analog',
        keywords: ['科技', '未来', 'AI', '智能'],
        color: '#0ea5e9',
        aspectRatios: ['16:9', '1:1']
    },
    {
        id: 'product_showcase',
        name: 'Product Showcase',
        nameCn: '产品展示',
        icon: '📦',
        description: '产品摄影，电商风格，专业展示',
        promptTemplate: `{prompt}, product photography, e-commerce, commercial lighting, clean background, professional product shot, studio quality, Amazon product style, crisp details`,
        negativePrompt: 'lifestyle, outdoor, candid, messy, cluttered background, artistic',
        keywords: ['产品', '电商', '展示', '商业'],
        color: '#10b981',
        aspectRatios: ['1:1', '16:9', '9:16']
    },
    {
        id: 'storytelling',
        name: 'Storytelling',
        nameCn: '故事叙事',
        icon: '📖',
        description: '叙事感强，情感丰富，电影感',
        promptTemplate: `{prompt}, storytelling, narrative, emotional, cinematic, atmospheric, expressive, film still, compelling story, character driven`,
        negativePrompt: 'static, flat, emotionless, catalog, commercial, sterile',
        keywords: ['故事', '叙事', '情感', '电影'],
        color: '#64748b',
        aspectRatios: ['16:9', '1:1']
    }
];

// ==================== 平台适配映射 ====================

const PLATFORM_ASPECT_RATIOS: Record<string, string[]> = {
    'douyin': ['9:16'],
    'xhs': ['9:16', '1:1'],
    'weixin': ['16:9'],
    'bilibili': ['16:9'],
    'weibo': ['1:1', '16:9'],
    'zhihu': ['16:9'],
    'youtube': ['16:9', '9:16', '1:1'],
    'instagram': ['1:1', '9:16'],
    'tiktok': ['9:16'],
};

// ==================== 核心功能函数 ====================

/**
 * 根据风格 ID 获取预设
 */
export function getStylePreset(styleId: VideoStyleId): VideoStylePreset | undefined {
    return VIDEO_STYLE_PRESETS.find(p => p.id === styleId);
}

/**
 * 获取所有可用风格
 */
export function getAllStyles(): VideoStylePreset[] {
    return VIDEO_STYLE_PRESETS;
}

/**
 * 根据平台获取推荐风格
 */
export function getStylesByPlatform(platform: string): VideoStylePreset[] {
    const ratios = PLATFORM_ASPECT_RATIOS[platform.toLowerCase()] || ['16:9'];
    return VIDEO_STYLE_PRESETS.filter(style => 
        style.aspectRatios.some(r => ratios.includes(r))
    );
}

/**
 * 应用风格到 prompt
 */
export function applyStyleToPrompt(params: StyleApplyParams): {
    positive: string;
    negative: string;
    enhanced: string;
} {
    const { basePrompt, style, aspectRatio = '16:9', customKeywords = [] } = params;
    
    const preset = getStylePreset(style);
    
    if (!preset) {
        return {
            positive: basePrompt,
            negative: '',
            enhanced: basePrompt
        };
    }
    
    // 1. 生成正向 prompt
    let positive = preset.promptTemplate
        .replace('{prompt}', basePrompt);
    
    // 添加自定义关键词
    if (customKeywords.length > 0) {
        positive += `, ${customKeywords.join(', ')}`;
    }
    
    // 添加尺寸相关关键词
    if (aspectRatio === '9:16') {
        positive += ', vertical video, portrait mode';
    } else if (aspectRatio === '1:1') {
        positive += ', square format';
    }
    
    // 2. 生成负向 prompt
    let negative = preset.negativePrompt;
    
    // 添加尺寸相关的负面约束
    if (aspectRatio === '9:16') {
        negative += ', horizontally oriented, landscape format';
    }
    
    // 3. 生成增强版完整 prompt（用于 API 调用）
    const enhanced = `${positive}, 8k, high quality, masterpiece, sharp focus, professional photography`;
    
    return {
        positive: positive.trim(),
        negative: negative.trim(),
        enhanced: enhanced.trim()
    };
}

/**
 * 获取风格的显示名称
 */
export function getStyleName(styleId: VideoStyleId): string {
    const preset = getStylePreset(styleId);
    return preset ? `${preset.icon} ${preset.nameCn}` : styleId;
}

/**
 * 搜索风格
 */
export function searchStyles(query: string): VideoStylePreset[] {
    const lowerQuery = query.toLowerCase();
    return VIDEO_STYLE_PRESETS.filter(style =>
        style.name.toLowerCase().includes(lowerQuery) ||
        style.nameCn.includes(query) ||
        style.keywords.some(k => k.toLowerCase().includes(lowerQuery))
    );
}

/**
 * 获取随机风格（用于推荐）
 */
export function getRandomStyles(count: number = 3): VideoStylePreset[] {
    const shuffled = [...VIDEO_STYLE_PRESETS].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
}

/**
 * 获取热门风格（带 emoji 的特殊处理）
 */
export function getTrendingStyles(): VideoStylePreset[] {
    return VIDEO_STYLE_PRESETS.filter(s => 
        ['high_energy', 'cinematic', 'cyberpunk', 'anime', 'product_showcase'].includes(s.id)
    );
}

// ==================== 导出统一接口 ====================

export const videoStylePresets = {
    presets: VIDEO_STYLE_PRESETS,
    getPreset: getStylePreset,
    getAll: getAllStyles,
    getByPlatform: getStylesByPlatform,
    apply: applyStyleToPrompt,
    getName: getStyleName,
    search: searchStyles,
    getRandom: getRandomStyles,
    getTrending: getTrendingStyles
};

export default videoStylePresets;
