import { create } from 'zustand';
import type { Color } from '../types';
import { dbService } from '../services/dbService';

interface ColorState {
  colors: Color[];
  loading: boolean;
  error: string | null;
  fetchColors: () => Promise<void>;
  addColor: (name: string) => Promise<Color>;
  updateColor: (id: string, name: string) => Promise<void>;
  deleteColor: (id: string) => Promise<void>;
}

export const useColorStore = create<ColorState>((set, get) => ({
  colors: [],
  loading: false,
  error: null,

  fetchColors: async () => {
    set({ loading: true, error: null });
    try {
      const colors = await dbService.getColors();
      set({ colors, loading: false });
    } catch (err: any) {
      set({ error: err.message || 'Failed to fetch colors', loading: false });
    }
  },

  addColor: async (name: string) => {
    set({ loading: true, error: null });
    try {
      const newColor = await dbService.createColor(name);
      await get().fetchColors();
      set({ loading: false });
      return newColor;
    } catch (err: any) {
      set({ error: err.message || 'Failed to add color', loading: false });
      throw err;
    }
  },

  updateColor: async (id: string, name: string) => {
    set({ loading: true, error: null });
    try {
      await dbService.updateColor(id, name);
      await get().fetchColors();
      set({ loading: false });
    } catch (err: any) {
      set({ error: err.message || 'Failed to update color', loading: false });
      throw err;
    }
  },

  deleteColor: async (id: string) => {
    set({ loading: true, error: null });
    try {
      await dbService.deleteColor(id);
      await get().fetchColors();
      set({ loading: false });
    } catch (err: any) {
      set({ error: err.message || 'Failed to delete color', loading: false });
      throw err;
    }
  }
}));
