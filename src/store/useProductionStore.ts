import { create } from 'zustand';
import type { ProductionEntry } from '../types';
import { dbService } from '../services/dbService';

interface Filters {
  startDate: string;
  endDate: string;
  month: string;
  year: string;
  search: string;
}

interface ProductionState {
  entries: ProductionEntry[];
  loading: boolean;
  error: string | null;
  filters: Filters;
  setFilters: (newFilters: Partial<Filters>) => void;
  resetFilters: () => void;
  fetchEntries: () => Promise<void>;
  saveEntries: (newEntries: Omit<ProductionEntry, 'id'>[]) => Promise<ProductionEntry[]>;
  updateEntry: (id: string, updatedData: Partial<ProductionEntry>) => Promise<ProductionEntry>;
  deleteEntry: (id: string) => Promise<void>;
}

const initialFilters: Filters = {
  startDate: '',
  endDate: '',
  month: '',
  year: new Date().getFullYear().toString(), // Default to current year
  search: ''
};

export const useProductionStore = create<ProductionState>((set, get) => ({
  entries: [],
  loading: false,
  error: null,
  filters: initialFilters,

  setFilters: (newFilters) => {
    set((state) => ({
      filters: { ...state.filters, ...newFilters }
    }));
  },

  resetFilters: () => {
    set({ filters: initialFilters });
  },

  fetchEntries: async () => {
    set({ loading: true, error: null });
    try {
      const { filters } = get();
      
      // Build clean parameters for the DB call
      const dbFilters: any = {};
      if (filters.startDate) dbFilters.startDate = filters.startDate;
      if (filters.endDate) dbFilters.endDate = filters.endDate;
      if (filters.month) dbFilters.month = filters.month;
      if (filters.year && !filters.month && !filters.startDate && !filters.endDate) {
        dbFilters.year = filters.year;
      }
      if (filters.search) dbFilters.search = filters.search;

      const entries = await dbService.getProductionEntries(dbFilters);
      set({ entries, loading: false });
    } catch (err: any) {
      set({ error: err.message || 'Failed to fetch entries', loading: false });
    }
  },

  saveEntries: async (newEntries) => {
    set({ loading: true, error: null });
    try {
      const saved = await dbService.saveProductionEntries(newEntries);
      await get().fetchEntries();
      set({ loading: false });
      return saved;
    } catch (err: any) {
      set({ error: err.message || 'Failed to save entries', loading: false });
      throw err;
    }
  },

  updateEntry: async (id, updatedData) => {
    set({ loading: true, error: null });
    try {
      const updated = await dbService.updateProductionEntry(id, updatedData);
      await get().fetchEntries();
      set({ loading: false });
      return updated;
    } catch (err: any) {
      set({ error: err.message || 'Failed to update entry', loading: false });
      throw err;
    }
  },

  deleteEntry: async (id) => {
    set({ loading: true, error: null });
    try {
      await dbService.deleteProductionEntry(id);
      await get().fetchEntries();
      set({ loading: false });
    } catch (err: any) {
      set({ error: err.message || 'Failed to delete entry', loading: false });
      throw err;
    }
  }
}));
