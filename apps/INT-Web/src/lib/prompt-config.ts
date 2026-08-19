        instagram_creator: "lifestyle photography, soft natural lighting, cozy, high quality, instagrammable, pastel colors, aesthetic",
        anime: "anime style, vibrant colors, clean lines, high quality illustration, makoto shinkai style, beautiful scenery",
        ink_wash: "traditional ink wash painting style, artistic, minimalist, brush strokes, elegant, high quality",
export const getPlatformVideoRatio = (platform: string): '16:9' | '9:16' | '1:1' => {
    const portraitPlatforms = ['tiktok', 'instagram'];
    if (portraitPlatforms.includes(platform)) return '9:16';
    return '16:9';
}

export const getPlatformImageSize = (platform: string): 'square' | 'portrait' | 'landscape' => {
    const portraitPlatforms = ['tiktok', 'instagram'];
    const landscapePlatforms = ['youtube', 'linkedin', 'x', 'twitter', 'reddit'];
