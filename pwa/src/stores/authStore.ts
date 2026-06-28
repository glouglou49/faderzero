import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/services/supabase/client';
import { getSession, signOut as apiSignOut, signInWithOtp } from '@/services/supabase/auth';
import { getUserWorkspaces, createWorkspace as apiCreateWorkspace, type Workspace } from '@/services/supabase/workspace';

interface AuthState {
  session: Session | null;
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  loading: boolean;
  error: string | null;
  initialized: boolean;

  initialize: () => Promise<void>;
  signIn: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  setActiveWorkspace: (workspace: Workspace) => void;
  createWorkspace: (name: string) => Promise<void>;
}

const LOCAL_STORAGE_KEY = 'faderzero_active_workspace_id';

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  workspaces: [],
  activeWorkspace: null,
  loading: true,
  error: null,
  initialized: false,

  initialize: async () => {
    if (get().initialized) return;

    try {
      // 1. Get initial session
      const session = await getSession();
      set({ session });

      if (session) {
        // 2. Load workspaces
        const workspaces = await getUserWorkspaces();
        set({ workspaces });

        // 3. Set active workspace from localStorage or default to first
        const storedId = localStorage.getItem(LOCAL_STORAGE_KEY);
        const active = workspaces.find((w) => w.id === storedId) || workspaces[0] || null;
        if (active) {
          set({ activeWorkspace: active });
          localStorage.setItem(LOCAL_STORAGE_KEY, active.id);
        }
      }

      // 4. Listen to auth state changes
      supabase.auth.onAuthStateChange(async (_event, newSession) => {
        const currentSession = get().session;
        if (newSession?.user?.id !== currentSession?.user?.id) {
          set({ session: newSession, loading: true });
          if (newSession) {
            try {
              const workspaces = await getUserWorkspaces();
              const storedId = localStorage.getItem(LOCAL_STORAGE_KEY);
              const active = workspaces.find((w) => w.id === storedId) || workspaces[0] || null;
              set({ workspaces, activeWorkspace: active, loading: false });
              if (active) {
                localStorage.setItem(LOCAL_STORAGE_KEY, active.id);
              }
            } catch (err: any) {
              set({ error: err.message, loading: false });
            }
          } else {
            set({ workspaces: [], activeWorkspace: null, loading: false });
            localStorage.removeItem(LOCAL_STORAGE_KEY);
          }
        } else {
          set({ session: newSession });
        }
      });

      set({ initialized: true, loading: false });
    } catch (err: any) {
      set({ error: err.message, initialized: true, loading: false });
    }
  },

  signIn: async (email) => {
    set({ loading: true, error: null });
    try {
      await signInWithOtp(email);
      set({ loading: false });
    } catch (err: any) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  signOut: async () => {
    set({ loading: true, error: null });
    try {
      await apiSignOut();
      set({ session: null, workspaces: [], activeWorkspace: null, loading: false });
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    } catch (err: any) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  setActiveWorkspace: (workspace) => {
    set({ activeWorkspace: workspace });
    localStorage.setItem(LOCAL_STORAGE_KEY, workspace.id);
  },

  createWorkspace: async (name) => {
    set({ loading: true, error: null });
    try {
      const newWorkspace = await apiCreateWorkspace(name);
      const workspaces = await getUserWorkspaces();
      set({
        workspaces,
        activeWorkspace: newWorkspace,
        loading: false,
      });
      localStorage.setItem(LOCAL_STORAGE_KEY, newWorkspace.id);
    } catch (err: any) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },
}));
