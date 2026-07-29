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

    fetchStatus: async (userId?: string) => {
        if (!userId) return;
        set({ isLoading: true });
        try {
            // Parallel fetch
            const [statusRes, achievementsRes] = await Promise.all([
                fetch(`/api/v1/gamification/status?userId=${userId}`),
                fetch(`/api/v1/gamification/achievements?userId=${userId}`),
            ]);

            const statusData = await statusRes.json();
            const achievementsData = await achievementsRes.json();

            if (statusData && !statusData.error) {
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
