    const getPlatformIcon = (key: string) => {
        const map: Record<string, string> = {
            tiktok: '🎵',
            instagram: '📸',
            youtube: '▶️',
            x: '𝕏',
            twitter: '𝕏',
            linkedin: '💼',
            reddit: '👽',
        };
        return map[key] || '📱';
    };
                        <Option value="tiktok">TikTok</Option>
                        <Option value="instagram">Instagram</Option>
                        <Option value="youtube">YouTube</Option>
                        <Option value="x">X</Option>
                        <Option value="linkedin">LinkedIn</Option>
