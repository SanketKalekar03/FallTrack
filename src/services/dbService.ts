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

// Migrate legacy un-scoped offline keys to "local-default" namespace
const migrateLegacyLocalKeys = () => {
  const legacyKeys = [
    'colors',
    'rates',
    'entries',
    'income_periods',
  ];
  legacyKeys.forEach((key) => {
    const oldValue = localStorage.getItem(`falltrack_${key}`);
    if (oldValue !== null) {
      const newKey = `falltrack_${key}_local-default`;
      if (localStorage.getItem(newKey) === null) {
        localStorage.setItem(newKey, oldValue);
      }
      localStorage.removeItem(`falltrack_${key}`);
    }
  });
};
migrateLegacyLocalKeys();

export const migrateLocalDefaultToUser = (newUserId: string) => {
  const keys = [
    'colors',
    'rates',
    'entries',
    'income_periods',
  ];
  keys.forEach((key) => {
    const defaultVal = localStorage.getItem(`falltrack_${key}_local-default`);
    if (defaultVal !== null) {
      const userKey = `falltrack_${key}_${newUserId}`;
      if (localStorage.getItem(userKey) === null) {
        localStorage.setItem(userKey, defaultVal);
      }
    }
  });
};

export const syncLocalDataToCloud = async (userId: string) => {
  if (!isSupabaseConfigured || !supabase) return;

  try {
    // 1. Load local data to sync
    const localColorsStr = localStorage.getItem(`falltrack_colors_local-default`) || localStorage.getItem(`falltrack_colors_${userId}`);
    const localRatesStr = localStorage.getItem(`falltrack_rates_local-default`) || localStorage.getItem(`falltrack_rates_${userId}`);
    const localEntriesStr = localStorage.getItem(`falltrack_entries_local-default`) || localStorage.getItem(`falltrack_entries_${userId}`);
    const localPeriodsStr = localStorage.getItem(`falltrack_income_periods_local-default`) || localStorage.getItem(`falltrack_income_periods_${userId}`);

    const colors: Color[] = localColorsStr ? JSON.parse(localColorsStr) : [];
    const rates: Rate[] = localRatesStr ? JSON.parse(localRatesStr) : [];
    const entries: ProductionEntry[] = localEntriesStr ? JSON.parse(localEntriesStr) : [];
    const periods: IncomePeriod[] = localPeriodsStr ? JSON.parse(localPeriodsStr) : [];

    if (colors.length === 0 && rates.length === 0 && entries.length === 0 && periods.length === 0) {
      return;
    }

    const syncFlag = localStorage.getItem(`falltrack_synced_to_cloud_${userId}`);
    if (syncFlag === 'true') return;

    // 2. Sync Colors (Skip seeding standard ones, insert custom ones)
    if (colors.length > 0) {
      // Exclude predefined default colors which have null user_id and exist globally
      const customColors = colors.filter(c => !c.id.startsWith('default-'));
      if (customColors.length > 0) {
        const formattedColors = customColors.map(c => ({
          id: c.id,
          name: c.name,
          user_id: userId,
          created_at: c.created_at
        }));
        const { error: colorErr } = await supabase.from('colors').upsert(formattedColors);
        if (colorErr) console.warn('Color sync warning:', colorErr);
      }
    }

    // 3. Sync Rates
    if (rates.length > 0) {
      const formattedRates = rates.map(r => ({
        id: r.id,
        rate_per_dozen: r.rate_per_dozen,
        effective_from: r.effective_from,
        user_id: userId,
        created_at: r.created_at
      }));
      const { error: rateErr } = await supabase.from('rates').upsert(formattedRates);
      if (rateErr) console.warn('Rate sync warning:', rateErr);
    }

    // 4. Sync Production Entries
    if (entries.length > 0) {
      const formattedEntries = entries.map(e => ({
        id: e.id,
        entry_date: e.entry_date,
        color_id: e.color_id,
        quantity: e.quantity,
        user_id: userId,
        created_at: e.created_at
      }));
      const { error: entryErr } = await supabase.from('production_entries').upsert(formattedEntries);
      if (entryErr) console.warn('Entry sync warning:', entryErr);
    }

    // 5. Sync Income Periods
    if (periods.length > 0) {
      const formattedPeriods = periods.map(p => ({
        id: p.id,
        period_name: p.period_name,
        start_date: p.start_date,
        end_date: p.end_date,
        total_falls: p.total_falls,
        total_income: p.total_income,
        user_id: userId,
        created_at: p.created_at
      }));
      const { error: periodErr } = await supabase.from('income_periods').upsert(formattedPeriods);
      if (periodErr) console.warn('Period sync warning:', periodErr);
    }

    localStorage.setItem(`falltrack_synced_to_cloud_${userId}`, 'true');
    console.log('Successfully synced local offline data to Supabase!');
  } catch (err) {
    console.error('Error syncing local data to Supabase:', err);
  }
};

// Helper to get active user ID
export const getActiveUserId = (): string => {
  return localStorage.getItem('falltrack_active_user_id') || 'local-default';
};

// Initial local seeds
const SEED_COLORS = [
  'राणी', 'लाल', 'पांढरा', 'केशरी', 'निळा', 'हिरवा',
  'पिवळा', 'गुलाबी', 'काळा', 'राजवाडी', 'मोरपंखी', 'जांभळा'
];

const getLocalColors = (): Color[] => {
  const userId = getActiveUserId();
  const data = localStorage.getItem(`falltrack_colors_${userId}`);
  if (!data) {
    const initial: Color[] = SEED_COLORS.map(name => ({
      id: generateUUID(),
      name,
      created_at: new Date().toISOString()
    }));
    localStorage.setItem(`falltrack_colors_${userId}`, JSON.stringify(initial));
    return initial;
  }
  return JSON.parse(data);
};

const getLocalRates = (): Rate[] => {
  const userId = getActiveUserId();
  const data = localStorage.getItem(`falltrack_rates_${userId}`);
  if (!data) {
    const initial: Rate[] = [
      {
        id: 'default-rate-uuid',
        rate_per_dozen: 5.0,
        effective_from: new Date().toISOString().split('T')[0],
        created_at: new Date().toISOString()
      }
    ];
    localStorage.setItem(`falltrack_rates_${userId}`, JSON.stringify(initial));
    return initial;
  }
  return JSON.parse(data);
};

const getLocalEntries = (): ProductionEntry[] => {
  const userId = getActiveUserId();
  const data = localStorage.getItem(`falltrack_entries_${userId}`);
  return data ? JSON.parse(data) : [];
};

const getLocalIncomePeriods = (): IncomePeriod[] => {
  const userId = getActiveUserId();
  const data = localStorage.getItem(`falltrack_income_periods_${userId}`);
  return data ? JSON.parse(data) : [];
};

const saveLocalColors = (colors: Color[]): void => {
  const userId = getActiveUserId();
  localStorage.setItem(`falltrack_colors_${userId}`, JSON.stringify(colors));
};

const saveLocalRates = (rates: Rate[]): void => {
  const userId = getActiveUserId();
  localStorage.setItem(`falltrack_rates_${userId}`, JSON.stringify(rates));
};

const saveLocalEntries = (entries: ProductionEntry[]): void => {
  const userId = getActiveUserId();
  localStorage.setItem(`falltrack_entries_${userId}`, JSON.stringify(entries));
};

const saveLocalIncomePeriods = (periods: IncomePeriod[]): void => {
  const userId = getActiveUserId();
  localStorage.setItem(`falltrack_income_periods_${userId}`, JSON.stringify(periods));
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

      // Self-healing: if color list is empty, seed default colors for the user
      if (!data || data.length === 0) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const initialColors = SEED_COLORS.map(name => ({
            name,
            user_id: user.id
          }));
          const { data: seeded, error: seedErr } = await supabase
            .from('colors')
            .insert(initialColors)
            .select()
            .order('name', { ascending: true });
          if (!seedErr && seeded) {
            return seeded;
          }
        }
      }
      return data || [];
    } else {
      return getLocalColors().sort((a, b) => a.name.localeCompare(b.name));
    }
  },

  async createColor(name: string): Promise<Color> {
    const trimmedName = name.trim();
    if (isSupabaseConfigured && supabase) {
      const { data: { user } } = await supabase.auth.getUser();
      // Check if it already exists to avoid conflict
      const { data: existing } = await supabase
        .from('colors')
        .select('*')
        .eq('name', trimmedName)
        .maybeSingle();

      if (existing) return existing;

      const { data, error } = await supabase
        .from('colors')
        .insert([{ name: trimmedName, user_id: user?.id }])
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
      saveLocalColors(colors);
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
      saveLocalColors(colors);

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
        saveLocalEntries(entries);
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
      saveLocalColors(filtered);
    }
  },

  // ==========================================
  // Rates API
  // ==========================================
  async getRates(): Promise<Rate[]> {
    if (isSupabaseConfigured && supabase) {
      let { data, error } = await supabase
        .from('rates')
        .select('*')
        .order('effective_from', { ascending: false });
      if (error) throw error;

      if (!data || data.length === 0) {
        // Seed default rate for new user
        const defaultRate = {
          rate_per_dozen: 5.0,
          effective_from: new Date().toISOString().split('T')[0]
        };
        const { data: inserted, error: insertErr } = await supabase
          .from('rates')
          .insert([defaultRate])
          .select();
        if (insertErr) throw insertErr;
        data = inserted || [];
      }

      return (data || []).map(r => ({
        ...r,
        rate_per_dozen: Number(r.rate_per_dozen)
      }));
    } else {
      return getLocalRates().sort(
        (a, b) => b.effective_from.localeCompare(a.effective_from)
      );
    }
  },

  async createRate(rate: Omit<Rate, 'id'>): Promise<Rate> {
    if (isSupabaseConfigured && supabase) {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('rates')
        .insert([{
          rate_per_dozen: rate.rate_per_dozen,
          effective_from: rate.effective_from,
          user_id: user?.id
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
      saveLocalRates(rates);
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
        const endObj = new Date(Number(year), Number(month), 0);
        const end = `${endObj.getFullYear()}-${String(endObj.getMonth() + 1).padStart(2, '0')}-${String(endObj.getDate()).padStart(2, '0')}`;
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
        const dateCompare = b.entry_date.localeCompare(a.entry_date);
        if (dateCompare !== 0) return dateCompare;
        return (b.created_at || '').localeCompare(a.created_at || '');
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
        const dateCompare = b.entry_date.localeCompare(a.entry_date);
        if (dateCompare !== 0) return dateCompare;
        return (b.created_at || '').localeCompare(a.created_at || '');
      });
    }
  },

  async saveProductionEntries(entries: Omit<ProductionEntry, 'id'>[]): Promise<ProductionEntry[]> {
    if (isSupabaseConfigured && supabase) {
      const { data: { user } } = await supabase.auth.getUser();
      const formatted = entries.map(e => ({
        entry_date: e.entry_date,
        color_id: e.color_id,
        quantity: e.quantity,
        user_id: user?.id
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
      saveLocalEntries(localEntries);
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
      saveLocalEntries(filtered);
    }
  },

  // Settings / Backup Support
  async importBackupData(backup: { colors: Color[]; rates: Rate[]; entries: ProductionEntry[] }): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      throw new Error('Backup restore on cloud Supabase is disabled for safety. Use SQL interface.');
    } else {
      const userId = getActiveUserId();
      localStorage.setItem(`falltrack_colors_${userId}`, JSON.stringify(backup.colors));
      localStorage.setItem(`falltrack_rates_${userId}`, JSON.stringify(backup.rates));
      localStorage.setItem(`falltrack_entries_${userId}`, JSON.stringify(backup.entries));
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      let { data, error } = await supabase
        .from('profile')
        .select('app_name, manager_name, manager_phone')
        .maybeSingle();
      if (error) throw error;

      if (!data) {
        // Seed default profile for new user
        const newProfile = {
          user_id: user.id,
          app_name: 'FallTrack',
          manager_name: user.email?.split('@')[0] || 'Manager',
          manager_phone: '9876543210'
        };
        const { data: inserted, error: insertErr } = await supabase
          .from('profile')
          .insert([newProfile])
          .select()
          .single();
        if (insertErr) throw insertErr;
        data = inserted;

        // Seed default colors for the user
        const initialColors = SEED_COLORS.map(name => ({
          name,
          user_id: user.id
        }));
        await supabase.from('colors').insert(initialColors);
      }

      if (data) {
        const userId = user.id;
        localStorage.setItem(`falltrack_app_name_${userId}`, data.app_name);
        localStorage.setItem(`falltrack_profile_name_${userId}`, data.manager_name);
        localStorage.setItem(`falltrack_profile_phone_${userId}`, data.manager_phone);
        return data;
      }
    }
    const userId = getActiveUserId();
    return {
      app_name: localStorage.getItem(`falltrack_app_name_${userId}`) || 'FallTrack',
      manager_name: localStorage.getItem(`falltrack_profile_name_${userId}`) || 'Manager',
      manager_phone: localStorage.getItem(`falltrack_profile_phone_${userId}`) || '9876543210'
    };
  },

  async updateProfile(name: string, phone: string, appName: string): Promise<void> {
    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    const trimmedAppName = appName.trim();

    const userId = getActiveUserId();
    localStorage.setItem(`falltrack_app_name_${userId}`, trimmedAppName);
    localStorage.setItem(`falltrack_profile_name_${userId}`, trimmedName);
    localStorage.setItem(`falltrack_profile_phone_${userId}`, trimmedPhone);

    if (isSupabaseConfigured && supabase) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { error } = await supabase
          .from('profile')
          .upsert({
            user_id: user.id,
            app_name: trimmedAppName,
            manager_name: trimmedName,
            manager_phone: trimmedPhone,
            updated_at: new Date().toISOString()
          });
        if (error) throw error;
      }
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
        (a, b) => a.start_date.localeCompare(b.start_date)
      );
    }
  },

  async createIncomePeriod(period: Omit<IncomePeriod, 'id'>): Promise<IncomePeriod> {
    if (isSupabaseConfigured && supabase) {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('income_periods')
        .insert([{
          period_name: period.period_name,
          start_date: period.start_date,
          end_date: period.end_date,
          total_falls: period.total_falls,
          total_income: period.total_income,
          user_id: user?.id
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
      saveLocalIncomePeriods(periods);
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
      saveLocalIncomePeriods(updated);
    }
  },

  // Draft API
  getDraft(): any {
    const userId = getActiveUserId();
    const draft = localStorage.getItem(`falltrack_entry_draft_${userId}`);
    return draft ? JSON.parse(draft) : null;
  },
  saveDraft(rows: any): void {
    const userId = getActiveUserId();
    localStorage.setItem(`falltrack_entry_draft_${userId}`, JSON.stringify(rows));
  },
  clearDraft(): void {
    const userId = getActiveUserId();
    localStorage.removeItem(`falltrack_entry_draft_${userId}`);
  }
};
