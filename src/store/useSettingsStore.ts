import { create } from 'zustand';
import type { UserProfile, InitialSetupData } from '../types';
import { settingsService } from '../services/settingsService';
import { useRateStore } from './useRateStore';
import { useProductionStore } from './useProductionStore';
import { useColorStore } from './useColorStore';

interface SettingsState {
  profile: UserProfile | null;
  isSetupCompleted: boolean | null; // null: initializing, false: requires setup, true: ready
  loading: boolean;
  error: string | null;

  checkSetupStatus: (userId: string) => Promise<boolean>;
  saveInitialSetup: (userId: string, data: InitialSetupData) => Promise<UserProfile>;
  updateProfileSettings: (userId: string, name: string, phone: string, appName: string) => Promise<UserProfile>;
  resetSettings: () => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  profile: null,
  isSetupCompleted: null,
  loading: true,
  error: null,

  checkSetupStatus: async (userId: string) => {
    if (!userId) {
      set({ profile: null, isSetupCompleted: false, loading: false, error: null });
      return false;
    }

    set({ loading: true, error: null });
    try {
      const { profile, isSetupCompleted } = await settingsService.getUserSettings(userId);
      set({
        profile,
        isSetupCompleted,
        loading: false,
        error: null
      });
      return isSetupCompleted;
    } catch (err: any) {
      set({
        error: err.message || 'Failed to verify system setup status',
        loading: false,
        // In case of error, if we cannot verify, don't silently bypass
        isSetupCompleted: false
      });
      return false;
    }
  },

  saveInitialSetup: async (userId: string, data: InitialSetupData) => {
    set({ loading: true, error: null });
    try {
      const updatedProfile = await settingsService.completeInitialSetup(userId, data);
      set({
        profile: updatedProfile,
        isSetupCompleted: true,
        loading: false,
        error: null
      });

      // Synchronize associated stores with the new configuration
      try {
        await Promise.allSettled([
          useRateStore.getState().fetchRates(),
          useProductionStore.getState().fetchEntries(),
          useColorStore.getState().fetchColors()
        ]);
      } catch (syncErr) {
        console.warn('Post-setup store sync note:', syncErr);
      }

      return updatedProfile;
    } catch (err: any) {
      set({
        error: err.message || 'Failed to save workspace configuration',
        loading: false
      });
      throw err;
    }
  },

  updateProfileSettings: async (userId: string, name: string, phone: string, appName: string) => {
    set({ loading: true, error: null });
    try {
      const updatedProfile = await settingsService.updateProfile(userId, name, phone, appName);
      set({
        profile: updatedProfile,
        isSetupCompleted: true,
        loading: false,
        error: null
      });
      return updatedProfile;
    } catch (err: any) {
      set({
        error: err.message || 'Failed to update profile settings',
        loading: false
      });
      throw err;
    }
  },

  resetSettings: () => {
    set({
      profile: null,
      isSetupCompleted: null,
      loading: false,
      error: null
    });
  }
}));
