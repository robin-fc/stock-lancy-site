import { create } from 'zustand';
import type { Profile } from '@/types';
import { getCurrentProfile, signIn as apiSignIn, signUp as apiSignUp, signOut as apiSignOut } from '@/lib/auth';

interface AuthState {
  profile: Profile | null;
  loading: boolean;
  initialized: boolean;
  init: () => Promise<void>;
  login: (email: string, password: string) => Promise<{ error: string | null }>;
  register: (email: string, password: string, name?: string, invitationCode?: string) => Promise<{ error: string | null }>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  profile: null,
  loading: false,
  initialized: false,

  init: async () => {
    set({ loading: true });
    const profile = await getCurrentProfile();
    set({ profile, loading: false, initialized: true });
  },

  login: async (email, password) => {
    set({ loading: true });
    const { error } = await apiSignIn(email, password);
    if (error) {
      set({ loading: false });
      return { error: error.message };
    }
    const profile = await getCurrentProfile();
    set({ profile, loading: false });
    return { error: null };
  },

  register: async (email, password, name, invitationCode) => {
    set({ loading: true });
    const { error } = await apiSignUp(email, password, name, invitationCode);
    if (error) {
      set({ loading: false });
      return { error: error.message };
    }
    set({ loading: false });
    return { error: null };
  },

  logout: async () => {
    await apiSignOut();
    set({ profile: null });
  },

  refreshProfile: async () => {
    const profile = await getCurrentProfile();
    set({ profile });
  },
}));
