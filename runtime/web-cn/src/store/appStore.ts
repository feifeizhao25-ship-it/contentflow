import { create } from 'zustand';
import { Profile, Tenant } from '@/lib/supabase';

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
        const { supabase } = await import('@/lib/supabase');
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user) {
            // Fetch Profile
            const { data: profile } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', session.user.id)
                .single();

            if (profile) {
                set({ user: profile as Profile });

                // Fetch Tenant
                const { data: tenant } = await supabase
                    .from('tenants')
                    .select('*')
                    .eq('id', profile.tenant_id)
                    .single();

                if (tenant) {
                    set({ tenant: tenant as Tenant });
                }
            }
        } else {
            set({ user: null, tenant: null });
        }
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
