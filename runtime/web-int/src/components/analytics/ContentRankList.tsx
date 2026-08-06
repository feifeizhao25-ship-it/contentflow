const RANK_DATA = [
    { id: '1', title: 'AI Startup: From 0 to 1', platform: 'linkedin', views: '102k', likes: '5.2k', score: 98, trend: 'up' },
    { id: '2', title: 'Weekend Food Vlog', platform: 'tiktok', views: '85k', likes: '3.1k', score: 92, trend: 'flat' },
    { id: '3', title: 'Deep Dive: Vue 3 vs React', platform: 'youtube', views: '51k', likes: '1.2k', score: 88, trend: 'up' },
    { id: '4', title: 'Corporate Jargon Translator', platform: 'instagram', views: '32k', likes: '892', score: 85, trend: 'down' },
];
                        <Option value="tiktok">TikTok</Option>
                        <Option value="instagram">Instagram</Option>
                        <Option value="linkedin">LinkedIn</Option>
                                        {item.platform === 'tiktok' ? '🎵' : item.platform === 'linkedin' ? '💼' : item.platform === 'youtube' ? '▶️' : '📸'}
