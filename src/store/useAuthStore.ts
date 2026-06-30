import { create } from 'zustand';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { migrateLocalDefaultToUser, syncLocalDataToCloud } from '../services/dbService';

interface User {
  id: string;
  email: string;
}

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
  mode: 'online' | 'offline';
  initAuth: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

// Helper to hash passwords locally (simple representation for offline/local storage safety)
const hashPassword = (password: string): string => {
  return btoa(password); // Simple encoding for local/offline safety representation
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  loading: true,
  error: null,
  mode: isSupabaseConfigured ? 'online' : 'offline',

  clearError: () => set({ error: null }),

  initAuth: async () => {
    set({ loading: true, error: null });
    
    if (isSupabaseConfigured && supabase) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session && session.user) {
          const u = session.user;
          localStorage.setItem('falltrack_active_user_id', u.id);
          migrateLocalDefaultToUser(u.id);
          await syncLocalDataToCloud(u.id);
          set({ user: { id: u.id, email: u.email || '' }, loading: false });
        } else {
          localStorage.removeItem('falltrack_active_user_id');
          set({ user: null, loading: false });
        }

        // Listen for auth changes
        supabase.auth.onAuthStateChange(async (_event, session) => {
          if (session && session.user) {
            const u = session.user;
            localStorage.setItem('falltrack_active_user_id', u.id);
            migrateLocalDefaultToUser(u.id);
            await syncLocalDataToCloud(u.id);
            set({ user: { id: u.id, email: u.email || '' } });
          } else {
            localStorage.removeItem('falltrack_active_user_id');
            set({ user: null });
          }
        });
      } catch (err: any) {
        set({ error: err.message, loading: false });
      }
    } else {
      // Offline mode session init
      const activeUser = localStorage.getItem('falltrack_active_user_id');
      const localUsersData = localStorage.getItem('falltrack_local_users');
      const localUsers: any[] = localUsersData ? JSON.parse(localUsersData) : [];
      
      if (activeUser) {
        const userObj = localUsers.find(u => u.id === activeUser);
        if (userObj) {
          set({ user: { id: userObj.id, email: userObj.email }, loading: false });
        } else {
          localStorage.removeItem('falltrack_active_user_id');
          set({ user: null, loading: false });
        }
      } else {
        set({ user: null, loading: false });
      }
    }
  },

  signIn: async (email, password) => {
    set({ loading: true, error: null });
    const cleanEmail = email.trim().toLowerCase();

    if (get().mode === 'online' && supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password
      });

      if (error) {
        set({ error: error.message, loading: false });
        throw error;
      }

      if (data.user) {
        localStorage.setItem('falltrack_active_user_id', data.user.id);
        migrateLocalDefaultToUser(data.user.id);
        await syncLocalDataToCloud(data.user.id);
        set({ user: { id: data.user.id, email: data.user.email || '' }, loading: false });
      }
    } else {
      // Local/Offline sign in
      const localUsersData = localStorage.getItem('falltrack_local_users');
      const localUsers: any[] = localUsersData ? JSON.parse(localUsersData) : [];
      
      const matchedUser = localUsers.find(
        u => u.email === cleanEmail && u.passwordHash === hashPassword(password)
      );

      if (!matchedUser) {
        const err = new Error('Invalid email or password');
        set({ error: err.message, loading: false });
        throw err;
      }

      localStorage.setItem('falltrack_active_user_id', matchedUser.id);
      migrateLocalDefaultToUser(matchedUser.id);
      set({ user: { id: matchedUser.id, email: matchedUser.email }, loading: false });
    }
  },

  signUp: async (email, password) => {
    set({ loading: true, error: null });
    const cleanEmail = email.trim().toLowerCase();

    if (get().mode === 'online' && supabase) {
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password
      });

      if (error) {
        set({ error: error.message, loading: false });
        throw error;
      }

      if (data.user) {
        // Log in immediately if session is started, otherwise alert user
        localStorage.setItem('falltrack_active_user_id', data.user.id);
        migrateLocalDefaultToUser(data.user.id);
        await syncLocalDataToCloud(data.user.id);
        set({ user: { id: data.user.id, email: data.user.email || '' }, loading: false });
      } else {
        set({ loading: false });
      }
    } else {
      // Local/Offline sign up
      const localUsersData = localStorage.getItem('falltrack_local_users');
      const localUsers: any[] = localUsersData ? JSON.parse(localUsersData) : [];

      const exists = localUsers.some(u => u.email === cleanEmail);
      if (exists) {
        const err = new Error('Email is already registered');
        set({ error: err.message, loading: false });
        throw err;
      }

      const newUserId = 'local-user-' + Math.random().toString(36).substring(2, 11) + '-' + Date.now().toString(36);
      const newUser = {
        id: newUserId,
        email: cleanEmail,
        passwordHash: hashPassword(password)
      };

      localUsers.push(newUser);
      localStorage.setItem('falltrack_local_users', JSON.stringify(localUsers));
      localStorage.setItem('falltrack_active_user_id', newUserId);
      migrateLocalDefaultToUser(newUserId);

      set({ user: { id: newUserId, email: cleanEmail }, loading: false });
    }
  },

  signOut: async () => {
    set({ loading: true });
    if (get().mode === 'online' && supabase) {
      await supabase.auth.signOut();
    }
    localStorage.removeItem('falltrack_active_user_id');
    set({ user: null, loading: false });
  }
}));
