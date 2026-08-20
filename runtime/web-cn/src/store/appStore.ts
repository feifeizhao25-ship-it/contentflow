import { create } from 'zustand';

export interface TenantProfile {
  id: string;
  name: string;
  plan: 'free' | 'starter' | 'pro' | 'team' | 'enterprise';
}

export interface UserProfile {
  id: string;
  email: string;
  name?: string;
  avatar_url?: string;
  role: 'owner' | 'admin' | 'editor' | 'viewer' | 'member';
  tenant?: TenantProfile;
}

interface AppState {
  user: UserProfile | null;
  tenant: TenantProfile | null;
  setUser: (user: UserProfile | null) => void;
  setTenant: (tenant: TenantProfile | null) => void;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  isLoading: boolean;
  setLoading: (loading: boolean) => void;
  initializeAuth: () => Promise<void>;
}

export const useAppStore = create<AppState>((set) => ({
  user: null,
  tenant: null,
  setUser: (user) => set({ user }),
  setTenant: (tenant) => set({ tenant }),
  sidebarCollapsed: false,
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
  isLoading: false,
  setLoading: (isLoading) => set({ isLoading }),
  initializeAuth: async () => {
    set({ isLoading: true });
    try {
      const response = await fetch('/api/v1/auth/profile', {
        credentials: 'include',
        cache: 'no-store',
      });
      if (!response.ok) {
        set({ user: null, tenant: null });
        return;
      }
      const payload = await response.json();
      const user = (payload?.data?.user ?? payload?.user) as UserProfile | undefined;
      set({ user: user ?? null, tenant: user?.tenant ?? null });
    } catch {
      set({ user: null, tenant: null });
    } finally {
      set({ isLoading: false });
    }
  },
}));

export const useUserStore = useAppStore;
