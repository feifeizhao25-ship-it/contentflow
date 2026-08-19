export const getStylePrompt = (style: string): string => {
    // Normalize style to uppercase for env lookup
    const envKey = `PROMPT_STYLE_${style.toUpperCase()}`;

    // Try to get from process.env
    const fromEnv = process.env[envKey];
    if (fromEnv) return fromEnv;

    // Fallbacks if env not set
    const defaults: Record<string, string> = {
        professional: "professional, clean, photorealistic, 8k, high quality, studio lighting, minimal, modern office",
        humorous: "funny, vibrant colors, expressive, cartoon style, dynamic, joyful, exaggerated features",
        xhs_influencer: "lifestyle photography, soft natural lighting, cozy, high quality, instagrammable, pastel colors, aesthetic",
        anime: "anime style, vibrant colors, clean lines, high quality illustration, makoto shinkai style, beautiful scenery",
        chinese_ink: "traditional chinese ink wash painting style, artistic, minimalist, brush strokes, elegant, high quality",
        cinematic: "cinematic lighting, dramatic, high quality, moody, anamorphic lens, 8k, photorealistic",
        vintage: "vintage photography style, 90s film look, grain, warm colors, nostalgic, high quality",
        cyberpunk: "cyberpunk, neon lights, futuristic, sci-fi, dark city, glowing, high tech, vivid colors",
    };

    return defaults[style.toLowerCase()] || "";
};

export const getPlatformVideoRatio = (platform: string): '16:9' | '9:16' | '1:1' => {
    const portraitPlatforms = ['douyin', 'xhs', 'channels', 'kuaishou'];
    if (portraitPlatforms.includes(platform)) return '9:16';
    return '16:9';
}

export const getPlatformImageSize = (platform: string): 'square' | 'portrait' | 'landscape' => {
    const portraitPlatforms = ['xhs', 'douyin', 'channels', 'kuaishou'];
    const landscapePlatforms = ['bilibili', 'wechat', 'toutiao', 'baijiahao', 'zhihu'];

    if (portraitPlatforms.includes(platform)) return 'portrait';
    if (landscapePlatforms.includes(platform)) return 'landscape';
    return 'square';
}
