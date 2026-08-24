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
