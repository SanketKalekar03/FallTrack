import { create } from 'zustand';
import type { Rate } from '../types';
import { dbService } from '../services/dbService';

interface RateState {
  rates: Rate[];
  loading: boolean;
  error: string | null;
  fetchRates: () => Promise<void>;
  addRate: (rate: Omit<Rate, 'id'>) => Promise<Rate>;
  deleteRate: (id: string) => Promise<void>;
  getActiveRateForDate: (dateStr: string) => number;
}

export const useRateStore = create<RateState>((set, get) => ({
  rates: [],
  loading: false,
  error: null,

  fetchRates: async () => {
    set({ loading: true, error: null });
    try {
      const rates = await dbService.getRates();
      set({ rates, loading: false });
    } catch (err: any) {
      set({ error: err.message || 'Failed to fetch rates', loading: false });
    }
  },

  addRate: async (rateData: Omit<Rate, 'id'>) => {
    set({ loading: true, error: null });
    try {
      const newRate = await dbService.createRate(rateData);
      await get().fetchRates();
      set({ loading: false });
      return newRate;
    } catch (err: any) {
      set({ error: err.message || 'Failed to add rate', loading: false });
      throw err;
    }
  },

  deleteRate: async (id: string) => {
    set({ loading: true, error: null });
    try {
      await dbService.deleteRate(id);
      await get().fetchRates();
      set({ loading: false });
    } catch (err: any) {
      set({ error: err.message || 'Failed to delete rate', loading: false });
      throw err;
    }
  },

  // Calculates the active rate for any target date
  // Sorted descending by effective_from (latest first)
  getActiveRateForDate: (dateStr: string) => {
    const { rates } = get();
    if (rates.length === 0) return 5.0; // fallback if empty
    
    // Find first rate where effective_from is <= target date
    const active = rates.find(r => r.effective_from <= dateStr);
    if (active) return active.rate_per_dozen;
    
    // If target date is before all effective rates, return the oldest rate (last in sorted array)
    return rates[rates.length - 1].rate_per_dozen;
  }
}));
