import { create } from 'zustand';

interface GamificationState {
    level: number;
    xp: number;
    nextLevelXp: number;
    streak: number;
    achievements: any[];
    isLoading: boolean;

    fetchStatus: (userId?: string) => Promise<void>;
    addXp: (amount: number) => void;
}

export const useGamificationStore = create<GamificationState>((set) => ({
    level: 1,
    xp: 0,
    nextLevelXp: 100,
    streak: 0,
    achievements: [],
    isLoading: false,

    // userId 参数保留只为兼容既有调用方，**不再拼进请求**。
    // 后端已改为从 JWT 的 req.user.id 取身份（此前从 query/body 取，
    // 任何人都能给任意账号加 XP）。这里继续传等于把一个已废弃的
    // 越权入口留在前端。
    fetchStatus: async (_userId?: string) => {
        set({ isLoading: true });
        try {
            // Parallel fetch
            const [statusRes, achievementsRes] = await Promise.all([
                fetch('/api/v1/gamification/status'),
                fetch('/api/v1/gamification/achievements'),
            ]);

            // NestJS 全局 TransformInterceptor 把响应包成 { success, data, meta }。
            // 此前直接读 statusData.level 永远是 undefined —— 等级/经验/连续天数
            // 全部渲染成空，且因为 `!statusData.error` 恒为真而不报错。
            const statusEnvelope = await statusRes.json();
            const achievementsEnvelope = await achievementsRes.json();
            const statusData = statusEnvelope?.data ?? statusEnvelope;
            const achievementsData = achievementsEnvelope?.data ?? achievementsEnvelope;

            if (statusRes.ok && statusData && !statusData.error) {
                set({
                    level: statusData.level,
                    xp: statusData.xp,
                    nextLevelXp: statusData.next_level_xp,
                    streak: statusData.current_streak,
                });
            }

            if (Array.isArray(achievementsData)) {
                set((state) => {
                    // Check for new achievements
                    const existingIds = new Set(state.achievements.map(a => a.achievement_id));
                    const newAchievements = achievementsData.filter(a => !existingIds.has(a.achievement_id));

                    newAchievements.forEach(a => {
                        // Avoid notification on first load (if achievements state was empty)
                        if (state.achievements.length > 0) {
                            import('antd').then(({ notification }) => {
                                notification.success({
                                    message: '🎉 Achievement Unlocked!',
                                    description: `You've unlocked: ${a.achievement_id}`,
                                    placement: 'topRight',
                                });
                            });
                        }
                    });

                    return { achievements: achievementsData };
                });
            }

        } catch (error) {
            console.error('Failed to fetch gamification status:', error);
        } finally {
            set({ isLoading: false });
        }
    },

    addXp: (amount: number) => set((state) => {
        // Optimistic update
        let newXp = state.xp + amount;
        let newLevel = state.level;
        let nextLevelXp = state.nextLevelXp;

        while (newXp >= nextLevelXp) {
            newXp -= nextLevelXp;
            newLevel++;
            nextLevelXp = Math.floor(nextLevelXp * 1.2);

            import('antd').then(({ notification }) => {
                notification.info({
                    message: 'Level Up!',
                    description: `You are now Level ${newLevel}!`,
                    placement: 'topRight',
                });
            });
        }

        return { xp: newXp, level: newLevel, nextLevelXp };
    })
}));
