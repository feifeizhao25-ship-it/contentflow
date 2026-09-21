import { create } from 'zustand';
import { fetchCurrentUser, type Profile, type Tenant } from '@/lib/session';

interface AppState {
    // User & Tenant
    user: Profile | null;
    tenant: Tenant | null;
    setUser: (user: Profile | null) => void;
    setTenant: (tenant: Tenant | null) => void;

    // UI State
    sidebarCollapsed: boolean;
    toggleSidebar: () => void;
    setSidebarCollapsed: (collapsed: boolean) => void;

    // Loading states
    isLoading: boolean;
    setLoading: (loading: boolean) => void;

    // Auth Actions
    initializeAuth: () => Promise<void>;
}

export const useAppStore = create<AppState>((set) => ({
    // User & Tenant
    user: null,
    tenant: null,
    setUser: (user) => set({ user }),
    setTenant: (tenant) => set({ tenant }),

    // UI State
    sidebarCollapsed: false,
    toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
    setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

    // Loading states
    isLoading: false,
    setLoading: (isLoading) => set({ isLoading }),

    // Auth Actions
    initializeAuth: async () => {
        // 身份以后端为准（ff_token → /auth/profile），不再读 Supabase 会话。
        const current = await fetchCurrentUser();
        set({ user: current?.profile ?? null, tenant: current?.tenant ?? null });
    }
}));

export const useUserStore = useAppStore;

interface AchievementState {
    unlocked: string[];
    unlockAchievement: (id: string) => void;
    isUnlocked: (id: string) => boolean;
}

export const useAchievementStore = create<AchievementState>((set, get) => ({
    unlocked: [],
    unlockAchievement: (id) =>
        set((state) =>
            state.unlocked.includes(id)
                ? state
                : { unlocked: [...state.unlocked, id] },
        ),
    isUnlocked: (id) => get().unlocked.includes(id),
}));
