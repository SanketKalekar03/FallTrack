import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Color, ProductionEntry, Rate, IncomePeriod } from '../types';
import { matchColor } from '../utils/transliterate';

// Helper to generate UUIDs locally
const generateUUID = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'local-' + Math.random().toString(36).substring(2, 15) + '-' + Date.now().toString(36);
};

// Initial local seeds
const SEED_COLORS = [
  'राणी', 'लाल', 'पांढरा', 'केशरी', 'निळा', 'हिरवा',
  'पिवळा', 'गुलाबी', 'काळा', 'राजवाडी', 'मोरपंखी', 'जांभळा'
];

const getLocalColors = (): Color[] => {
  const data = localStorage.getItem('falltrack_colors');
  if (!data) {
    const initial: Color[] = SEED_COLORS.map(name => ({
      id: generateUUID(),
      name,
      created_at: new Date().toISOString()
    }));
    localStorage.setItem('falltrack_colors', JSON.stringify(initial));
    return initial;
  }
  return JSON.parse(data);
};

const getLocalRates = (): Rate[] => {
  const data = localStorage.getItem('falltrack_rates');
  if (!data) {
    const initial: Rate[] = [
      {
        id: 'default-rate-uuid',
        rate_per_dozen: 5.0,
        effective_from: '2026-01-01',
        created_at: new Date().toISOString()
      }
    ];
    localStorage.setItem('falltrack_rates', JSON.stringify(initial));
    return initial;
  }
  return JSON.parse(data);
};

const getLocalEntries = (): ProductionEntry[] => {
  const data = localStorage.getItem('falltrack_entries');
  return data ? JSON.parse(data) : [];
};

const getLocalIncomePeriods = (): IncomePeriod[] => {
  const data = localStorage.getItem('falltrack_income_periods');
  return data ? JSON.parse(data) : [];
};

export const dbService = {
  // ==========================================
  // Colors API
  // ==========================================
  async getColors(): Promise<Color[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('colors')
        .select('*')
        .order('name', { ascending: true });
      if (error) throw error;
      return data || [];
    } else {
      return getLocalColors().sort((a, b) => a.name.localeCompare(b.name));
    }
  },

  async createColor(name: string): Promise<Color> {
    const trimmedName = name.trim();
    if (isSupabaseConfigured && supabase) {
      // Check if it already exists to avoid conflict
      const { data: existing } = await supabase
        .from('colors')
        .select('*')
        .eq('name', trimmedName)
        .maybeSingle();

      if (existing) return existing;

      const { data, error } = await supabase
        .from('colors')
        .insert([{ name: trimmedName }])
        .select()
        .single();
      if (error) throw error;
      return data;
    } else {
      const colors = getLocalColors();
      const existing = colors.find(c => c.name.toLowerCase() === trimmedName.toLowerCase());
      if (existing) return existing;

      const newColor: Color = {
        id: generateUUID(),
        name: trimmedName,
        created_at: new Date().toISOString()
      };
      colors.push(newColor);
      localStorage.setItem('falltrack_colors', JSON.stringify(colors));
      return newColor;
    }
  },

  async updateColor(id: string, name: string): Promise<Color> {
    const trimmedName = name.trim();
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('colors')
        .update({ name: trimmedName })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    } else {
      const colors = getLocalColors();
      const idx = colors.findIndex(c => c.id === id);
      if (idx === -1) throw new Error('Color not found');
      
      colors[idx].name = trimmedName;
      localStorage.setItem('falltrack_colors', JSON.stringify(colors));

      // Update cached color details in production entries
      const entries = getLocalEntries();
      let changed = false;
      entries.forEach(e => {
        if (e.color_id === id) {
          e.color = colors[idx];
          changed = true;
        }
      });
      if (changed) {
        localStorage.setItem('falltrack_entries', JSON.stringify(entries));
      }
      return colors[idx];
    }
  },

  async deleteColor(id: string): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      // Check if referenced in production entries
      const { count, error: countErr } = await supabase
        .from('production_entries')
        .select('id', { count: 'exact', head: true })
        .eq('color_id', id);
      if (countErr) throw countErr;
      if (count && count > 0) {
        throw new Error('Color is referenced by production entries');
      }

      const { error } = await supabase
        .from('colors')
        .delete()
        .eq('id', id);
      if (error) throw error;
    } else {
      const entries = getLocalEntries();
      const isReferenced = entries.some(e => e.color_id === id);
      if (isReferenced) {
        throw new Error('Color is referenced by production entries');
      }

      const colors = getLocalColors();
      const filtered = colors.filter(c => c.id !== id);
      localStorage.setItem('falltrack_colors', JSON.stringify(filtered));
    }
  },

  // ==========================================
  // Rates API
  // ==========================================
  async getRates(): Promise<Rate[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('rates')
        .select('*')
        .order('effective_from', { ascending: false });
      if (error) throw error;
      return (data || []).map(r => ({
        ...r,
        rate_per_dozen: Number(r.rate_per_dozen)
      }));
    } else {
      return getLocalRates().sort(
        (a, b) => new Date(b.effective_from).getTime() - new Date(a.effective_from).getTime()
      );
    }
  },

  async createRate(rate: Omit<Rate, 'id'>): Promise<Rate> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('rates')
        .insert([{
          rate_per_dozen: rate.rate_per_dozen,
          effective_from: rate.effective_from
        }])
        .select()
        .single();
      if (error) throw error;
      return {
        ...data,
        rate_per_dozen: Number(data.rate_per_dozen)
      };
    } else {
      const rates = getLocalRates();
      const newRate: Rate = {
        id: generateUUID(),
        rate_per_dozen: rate.rate_per_dozen,
        effective_from: rate.effective_from,
        created_at: new Date().toISOString()
      };
      rates.push(newRate);
      localStorage.setItem('falltrack_rates', JSON.stringify(rates));
      return newRate;
    }
  },

  async deleteRate(id: string): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from('rates')
        .delete()
        .eq('id', id);
      if (error) throw error;
    } else {
      const rates = getLocalRates();
      const updated = rates.filter(r => r.id !== id);
      localStorage.setItem('falltrack_rates', JSON.stringify(updated));
    }
  },

  // ==========================================
  // Production Entries API
  // ==========================================
  async getProductionEntries(filters?: {
    startDate?: string;
    endDate?: string;
    month?: string; // YYYY-MM
    year?: string;  // YYYY
    search?: string; // color name
  }): Promise<ProductionEntry[]> {
    if (isSupabaseConfigured && supabase) {
      let query = supabase
        .from('production_entries')
        .select('*, colors(*)');

      if (filters?.startDate) {
        query = query.gte('entry_date', filters.startDate);
      }
      if (filters?.endDate) {
        query = query.lte('entry_date', filters.endDate);
      }
      if (filters?.month) {
        // Month format: 'YYYY-MM'
        const [year, month] = filters.month.split('-');
        const start = `${year}-${month}-01`;
        const end = new Date(Number(year), Number(month), 0).toISOString().split('T')[0];
        query = query.gte('entry_date', start).lte('entry_date', end);
      } else if (filters?.year) {
        // Year format: 'YYYY'
        const start = `${filters.year}-01-01`;
        const end = `${filters.year}-12-31`;
        query = query.gte('entry_date', start).lte('entry_date', end);
      }

      const { data, error } = await supabase
        .from('production_entries')
        .select('*, color:colors(*)'); // Fetch nested color

      if (error) throw error;

      let result: ProductionEntry[] = (data || []).map(item => ({
        id: item.id,
        entry_date: item.entry_date,
        color_id: item.color_id,
        quantity: item.quantity,
        created_at: item.created_at,
        color: item.color ? { id: item.color.id, name: item.color.name } : undefined
      }));

      // Apply search and date filtering in JS if complex, or refine query
      if (filters?.startDate) {
        result = result.filter(e => e.entry_date >= filters.startDate!);
      }
      if (filters?.endDate) {
        result = result.filter(e => e.entry_date <= filters.endDate!);
      }
      if (filters?.month) {
        result = result.filter(e => e.entry_date.startsWith(filters.month!));
      } else if (filters?.year) {
        result = result.filter(e => e.entry_date.startsWith(filters.year!));
      }

      if (filters?.search) {
        result = result.filter(e => e.color ? matchColor(e.color.name, filters.search!) : false);
      }

      // Sort by entry_date desc, then created_at desc
      return result.sort((a, b) => {
        const dateCompare = new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime();
        if (dateCompare !== 0) return dateCompare;
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      });
    } else {
      const colors = getLocalColors();
      let entries = getLocalEntries().map(e => ({
        ...e,
        color: colors.find(c => c.id === e.color_id)
      }));

      if (filters?.startDate) {
        entries = entries.filter(e => e.entry_date >= filters.startDate!);
      }
      if (filters?.endDate) {
        entries = entries.filter(e => e.entry_date <= filters.endDate!);
      }
      if (filters?.month) {
        entries = entries.filter(e => e.entry_date.startsWith(filters.month!));
      } else if (filters?.year) {
        entries = entries.filter(e => e.entry_date.startsWith(filters.year!));
      }

      if (filters?.search) {
        entries = entries.filter(e => e.color ? matchColor(e.color.name, filters.search!) : false);
      }

      return entries.sort((a, b) => {
        const dateCompare = new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime();
        if (dateCompare !== 0) return dateCompare;
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      });
    }
  },

  async saveProductionEntries(entries: Omit<ProductionEntry, 'id'>[]): Promise<ProductionEntry[]> {
    if (isSupabaseConfigured && supabase) {
      const formatted = entries.map(e => ({
        entry_date: e.entry_date,
        color_id: e.color_id,
        quantity: e.quantity
      }));
      const { data, error } = await supabase
        .from('production_entries')
        .insert(formatted)
        .select('*, color:colors(*)');
      if (error) throw error;
      return (data || []).map(item => ({
        id: item.id,
        entry_date: item.entry_date,
        color_id: item.color_id,
        quantity: item.quantity,
        created_at: item.created_at,
        color: item.color ? { id: item.color.id, name: item.color.name } : undefined
      }));
    } else {
      const localEntries = getLocalEntries();
      const colors = getLocalColors();
      const saved: ProductionEntry[] = [];

      entries.forEach(e => {
        const newEntry: ProductionEntry = {
          id: generateUUID(),
          entry_date: e.entry_date,
          color_id: e.color_id,
          quantity: e.quantity,
          created_at: new Date().toISOString(),
          color: colors.find(c => c.id === e.color_id)
        };
        localEntries.push(newEntry);
        saved.push(newEntry);
      });

      localStorage.setItem('falltrack_entries', JSON.stringify(localEntries));
      return saved;
    }
  },

  async updateProductionEntry(id: string, entry: Partial<ProductionEntry>): Promise<ProductionEntry> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('production_entries')
        .update({
          entry_date: entry.entry_date,
          color_id: entry.color_id,
          quantity: entry.quantity
        })
        .eq('id', id)
        .select('*, color:colors(*)')
        .single();
      if (error) throw error;
      return {
        id: data.id,
        entry_date: data.entry_date,
        color_id: data.color_id,
        quantity: data.quantity,
        created_at: data.created_at,
        color: data.color ? { id: data.color.id, name: data.color.name } : undefined
      };
    } else {
      const localEntries = getLocalEntries();
      const idx = localEntries.findIndex(e => e.id === id);
      if (idx === -1) throw new Error('Record not found');

      const colors = getLocalColors();
      const updated = {
        ...localEntries[idx],
        ...entry,
        color: entry.color_id ? colors.find(c => c.id === entry.color_id) : localEntries[idx].color
      };

      localEntries[idx] = updated;
      localStorage.setItem('falltrack_entries', JSON.stringify(localEntries));
      return updated;
    }
  },

  async deleteProductionEntry(id: string): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from('production_entries')
        .delete()
        .eq('id', id);
      if (error) throw error;
    } else {
      const localEntries = getLocalEntries();
      const filtered = localEntries.filter(e => e.id !== id);
      localStorage.setItem('falltrack_entries', JSON.stringify(filtered));
    }
  },

  // Settings / Backup Support
  async importBackupData(backup: { colors: Color[]; rates: Rate[]; entries: ProductionEntry[] }): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      // Supabase bulk sync - to keep it simple we can bulk insert or let it write local and alert
      // In Supabase mode, backup restore can be done via SQL, but we will support local override
      // and print warning. For safety in single-user app:
      // Let's truncate and insert.
      throw new Error('Backup restore on cloud Supabase is disabled for safety. Use SQL interface.');
    } else {
      localStorage.setItem('falltrack_colors', JSON.stringify(backup.colors));
      localStorage.setItem('falltrack_rates', JSON.stringify(backup.rates));
      localStorage.setItem('falltrack_entries', JSON.stringify(backup.entries));
    }
  },

  exportBackupData(): { colors: Color[]; rates: Rate[]; entries: ProductionEntry[] } {
    return {
      colors: getLocalColors(),
      rates: getLocalRates(),
      entries: getLocalEntries()
    };
  },

  // Profile Settings API
  async getProfile(): Promise<{ app_name: string; manager_name: string; manager_phone: string }> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('profile')
        .select('app_name, manager_name, manager_phone')
        .eq('id', true)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        // Sync to local cache
        localStorage.setItem('falltrack_app_name', data.app_name);
        localStorage.setItem('falltrack_profile_name', data.manager_name);
        localStorage.setItem('falltrack_profile_phone', data.manager_phone);
        return data;
      }
    }
    // Local fallback
    return {
      app_name: localStorage.getItem('falltrack_app_name') || 'FallTrack',
      manager_name: localStorage.getItem('falltrack_profile_name') || 'Rajesh Kumar',
      manager_phone: localStorage.getItem('falltrack_profile_phone') || '9876543210'
    };
  },

  async updateProfile(name: string, phone: string, appName: string): Promise<void> {
    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    const trimmedAppName = appName.trim();

    // Local update first
    localStorage.setItem('falltrack_app_name', trimmedAppName);
    localStorage.setItem('falltrack_profile_name', trimmedName);
    localStorage.setItem('falltrack_profile_phone', trimmedPhone);

    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from('profile')
        .upsert({
          id: true,
          app_name: trimmedAppName,
          manager_name: trimmedName,
          manager_phone: trimmedPhone,
          updated_at: new Date().toISOString()
        });
      if (error) throw error;
    }
  },

  // ==========================================
  // Income Periods API
  // ==========================================
  async getIncomePeriods(): Promise<IncomePeriod[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('income_periods')
        .select('*')
        .order('start_date', { ascending: true });
      if (error) throw error;
      return (data || []).map(p => ({
        ...p,
        total_income: Number(p.total_income)
      }));
    } else {
      return getLocalIncomePeriods().sort(
        (a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
      );
    }
  },

  async createIncomePeriod(period: Omit<IncomePeriod, 'id'>): Promise<IncomePeriod> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('income_periods')
        .insert([{
          period_name: period.period_name,
          start_date: period.start_date,
          end_date: period.end_date,
          total_falls: period.total_falls,
          total_income: period.total_income
        }])
        .select()
        .single();
      if (error) throw error;
      return {
        ...data,
        total_income: Number(data.total_income)
      };
    } else {
      const periods = getLocalIncomePeriods();
      const newPeriod: IncomePeriod = {
        id: generateUUID(),
        ...period,
        created_at: new Date().toISOString()
      };
      periods.push(newPeriod);
      localStorage.setItem('falltrack_income_periods', JSON.stringify(periods));
      return newPeriod;
    }
  },

  async deleteIncomePeriod(id: string): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from('income_periods')
        .delete()
        .eq('id', id);
      if (error) throw error;
    } else {
      const periods = getLocalIncomePeriods();
      const updated = periods.filter(p => p.id !== id);
      localStorage.setItem('falltrack_income_periods', JSON.stringify(updated));
    }
  }
};
