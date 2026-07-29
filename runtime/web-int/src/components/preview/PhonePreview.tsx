    const getPlatformStyle = () => {
        switch (platform) {
            case 'tiktok':
                return {
                    bg: 'bg-black',
                    textColor: 'text-white',
                    header: 'TikTok',
                    accent: 'text-white'
                };
            case 'instagram':
                return {
                    bg: 'bg-white',
                    textColor: 'text-zinc-900',
                    header: 'Instagram',
                    accent: 'text-pink-600'
                };
            case 'youtube':
                return {
                    bg: 'bg-white',
                    textColor: 'text-zinc-900',
                    header: 'YouTube',
                    accent: 'text-red-600'
                };
            case 'x':
            case 'twitter':
                return {
                    bg: 'bg-white',
                    textColor: 'text-zinc-900',
                    header: 'X',
                    accent: 'text-zinc-900'
                };
            case 'linkedin':
                return {
                    bg: 'bg-white',
                    textColor: 'text-zinc-900',
                    header: 'LinkedIn',
                    accent: 'text-blue-700'
                };
            default:
            <div className={clsx("absolute top-8 left-0 w-full h-10 flex items-center justify-center z-10 border-b", platform === 'tiktok' ? 'bg-transparent border-white/10' : 'bg-white/90 backdrop-blur border-zinc-100')}>
                <span className={clsx("text-sm font-bold", platform === 'tiktok' ? 'text-white' : 'text-zinc-800')}>
                            <span key={tag} className={clsx("text-xs", platform === 'tiktok' ? 'text-blue-400' : 'text-blue-600')}>
            <div className={clsx("absolute bottom-0 left-0 w-full h-16 border-t flex items-center justify-between px-6 z-20", platform === 'tiktok' ? 'bg-black border-white/10 text-white' : 'bg-white border-zinc-100 text-zinc-600')}>
