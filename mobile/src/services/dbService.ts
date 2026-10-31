import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Color, ProductionEntry, Rate, IncomePeriod } from '../types';
import { matchColor } from '../utils/transliterate';

// Helper to generate IDs locally (failsafe for offline usage)
const generateUUID = (): string => {
  return 'mobile-' + Math.random().toString(36).substring(2, 15) + '-' + Date.now().toString(36);
};

let isMigrated = false;
const migrateLegacyLocalKeysMobile = async () => {
  if (isMigrated) return;
  const legacyKeys = [
    'colors',
    'rates',
    'entries',
    'income_periods',
  ];
  for (const key of legacyKeys) {
    try {
      const oldValue = await AsyncStorage.getItem(`falltrack_${key}`);
      if (oldValue !== null) {
        const newKey = `falltrack_${key}_local-default`;
        const exists = await AsyncStorage.getItem(newKey);
        if (exists === null) {
          await AsyncStorage.setItem(newKey, oldValue);
        }
        await AsyncStorage.removeItem(`falltrack_${key}`);
      }
    } catch (e) {
      // Ignore
    }
  }
  isMigrated = true;
};

export const migrateLocalDefaultToUserMobile = async (newUserId: string) => {
  const keys = [
    'colors',
    'rates',
    'entries',
    'income_periods',
  ];
  for (const key of keys) {
    try {
      const defaultVal = await AsyncStorage.getItem(`falltrack_${key}_local-default`);
      if (defaultVal !== null) {
        const userKey = `falltrack_${key}_${newUserId}`;
        const exists = await AsyncStorage.getItem(userKey);
        if (exists === null) {
          await AsyncStorage.setItem(userKey, defaultVal);
        } else {
          // Merge local-default values into userKey list to prevent losing them!
          const defaultList = JSON.parse(defaultVal);
          const userList = JSON.parse(exists);
          const merged = [...userList, ...defaultList.filter((d: any) => !userList.some((u: any) => u.id === d.id))];
          await AsyncStorage.setItem(userKey, JSON.stringify(merged));
        }
        // Clean up to prevent duplicate migrations
        await AsyncStorage.removeItem(`falltrack_${key}_local-default`);
      }
    } catch (e) {
      // Ignore
    }
  }
};

const getDeletedEntriesQueue = async (): Promise<string[]> => {
  const userId = await getActiveUserId();
  const data = await AsyncStorage.getItem(`falltrack_deleted_entries_${userId}`);
  return data ? JSON.parse(data) : [];
};

const queueEntryDeletion = async (id: string): Promise<void> => {
  const userId = await getActiveUserId();
  const queue = await getDeletedEntriesQueue();
  if (!queue.includes(id)) {
    queue.push(id);
    await AsyncStorage.setItem(`falltrack_deleted_entries_${userId}`, JSON.stringify(queue));
  }
};

const clearDeletedEntryFromQueue = async (id: string): Promise<void> => {
  const userId = await getActiveUserId();
  const queue = await getDeletedEntriesQueue();
  const filtered = queue.filter(qid => qid !== id);
  await AsyncStorage.setItem(`falltrack_deleted_entries_${userId}`, JSON.stringify(filtered));
};

export const syncLocalDataToCloudMobile = async (userId: string) => {
  if (!isSupabaseConfigured || !supabase) return;

  try {
    // 1. Sync Deletions
    const deleteQueue = await getDeletedEntriesQueue();
    if (deleteQueue.length > 0) {
      console.log(`Syncing ${deleteQueue.length} offline deletions to Supabase...`);
      for (const id of deleteQueue) {
        const { error } = await supabase.from('production_entries').delete().eq('id', id);
        if (!error) {
          await clearDeletedEntryFromQueue(id);
        }
      }
    }

    const localColorsStr = await AsyncStorage.getItem(`falltrack_colors_${userId}`);
    const localRatesStr = await AsyncStorage.getItem(`falltrack_rates_${userId}`);
    const localEntriesStr = await AsyncStorage.getItem(`falltrack_entries_${userId}`);
    const localPeriodsStr = await AsyncStorage.getItem(`falltrack_income_periods_${userId}`);

    const colors: Color[] = localColorsStr ? JSON.parse(localColorsStr) : [];
    const rates: Rate[] = localRatesStr ? JSON.parse(localRatesStr) : [];
    const entries: (ProductionEntry & { synced?: boolean })[] = localEntriesStr ? JSON.parse(localEntriesStr) : [];
    const periods: IncomePeriod[] = localPeriodsStr ? JSON.parse(localPeriodsStr) : [];

    // 2. Sync Colors
    const unsyncedColors = colors.filter((c: any) => c.synced === false);
    if (unsyncedColors.length > 0) {
      const formattedColors = unsyncedColors.map(c => ({
        id: c.id,
        name: c.name,
        user_id: userId,
        created_at: c.created_at
      }));
      const { error: colorErr } = await supabase.from('colors').upsert(formattedColors);
      if (!colorErr) {
        colors.forEach((c: any) => { if (c.synced === false) c.synced = true; });
        await AsyncStorage.setItem(`falltrack_colors_${userId}`, JSON.stringify(colors));
      } else {
        console.warn('Color sync warning:', colorErr);
      }
    }

    // 3. Sync Rates
    const unsyncedRates = rates.filter((r: any) => r.synced === false);
    if (unsyncedRates.length > 0) {
      const formattedRates = unsyncedRates.map(r => ({
        id: r.id,
        rate_per_dozen: r.rate_per_dozen,
        effective_from: r.effective_from,
        user_id: userId,
        created_at: r.created_at
      }));
      const { error: rateErr } = await supabase.from('rates').upsert(formattedRates);
      if (!rateErr) {
        rates.forEach((r: any) => { if (r.synced === false) r.synced = true; });
        await AsyncStorage.setItem(`falltrack_rates_${userId}`, JSON.stringify(rates));
      } else {
        console.warn('Rate sync warning:', rateErr);
      }
    }

    // 4. Sync Production Entries
    const unsyncedEntries = entries.filter(e => e.synced === false);
    if (unsyncedEntries.length > 0) {
      const formattedEntries = unsyncedEntries.map(e => ({
        id: e.id,
        entry_date: e.entry_date,
        color_id: e.color_id,
        quantity: e.quantity,
        user_id: userId,
        created_at: e.created_at
      }));
      const { error: entryErr } = await supabase.from('production_entries').upsert(formattedEntries);
      if (!entryErr) {
        entries.forEach(e => { if (e.synced === false) e.synced = true; });
        await AsyncStorage.setItem(`falltrack_entries_${userId}`, JSON.stringify(entries));
      } else {
        console.warn('Entry sync warning:', entryErr);
      }
    }

    // 5. Sync Income Periods
    const unsyncedPeriods = periods.filter((p: any) => p.synced === false);
    if (unsyncedPeriods.length > 0) {
      const formattedPeriods = unsyncedPeriods.map(p => ({
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
      if (!periodErr) {
        periods.forEach((p: any) => { if (p.synced === false) p.synced = true; });
        await AsyncStorage.setItem(`falltrack_income_periods_${userId}`, JSON.stringify(periods));
      } else {
        console.warn('Period sync warning:', periodErr);
      }
    }

    console.log('Successfully completed offline background sync checks!');
  } catch (err) {
    console.error('Error syncing local data to Supabase:', err);
  }
};

// Helper to get active user ID
export const getActiveUserId = async (): Promise<string> => {
  await migrateLegacyLocalKeysMobile();
  // Read from AsyncStorage locally for instantaneous, offline-ready retrieval
  const cachedUserId = await AsyncStorage.getItem('falltrack_active_user_id');
  if (cachedUserId) return cachedUserId;

  if (isSupabaseConfigured && supabase) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const uid = session.user.id;
        await AsyncStorage.setItem('falltrack_active_user_id', uid);
        return uid;
      }
    } catch (e) {
      // Ignore auth error
    }
  }
  return 'local-default';
};

// Initial local seeds
const SEED_COLORS = [
  'राणी', 'लाल', 'पांढरा', 'केशरी', 'निळा', 'हिरवा',
  'पिवळा', 'गुलाबी', 'काळा', 'राजवाडी', 'मोरपंखी', 'जांभळा'
];

export function deduplicateColors(colorList: Color[]): Color[] {
  if (!colorList || colorList.length === 0) return [];
  const map = new Map<string, Color>();

  // Prioritize global seed colors (user_id is null) or default IDs as canonical row
  const sorted = [...colorList].sort((a, b) => {
    const aGlobal = !a.user_id || a.id.startsWith('default-') || a.id.startsWith('mobile-default');
    const bGlobal = !b.user_id || b.id.startsWith('default-') || b.id.startsWith('mobile-default');
    if (aGlobal && !bGlobal) return -1;
    if (!aGlobal && bGlobal) return 1;
    return (a.created_at || '').localeCompare(b.created_at || '');
  });

  for (const c of sorted) {
    if (!c || !c.name) continue;
    const norm = c.name.trim().toLowerCase();
    if (!map.has(norm)) {
      map.set(norm, c);
    }
  }

  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}

// Offline fallbacks using AsyncStorage
const getLocalColors = async (): Promise<Color[]> => {
  const userId = await getActiveUserId();
  const data = await AsyncStorage.getItem(`falltrack_colors_${userId}`);
  if (!data) {
    const initial: Color[] = SEED_COLORS.map(name => ({
      id: `default-${name}`,
      name,
      created_at: new Date().toISOString()
    }));
    await AsyncStorage.setItem(`falltrack_colors_${userId}`, JSON.stringify(initial));
    return initial;
  }
  return deduplicateColors(JSON.parse(data));
};

const getLocalRates = async (): Promise<Rate[]> => {
  const userId = await getActiveUserId();
  const data = await AsyncStorage.getItem(`falltrack_rates_${userId}`);
  if (!data) {
    const initial: Rate[] = [
      {
        id: 'default-rate-uuid',
        rate_per_dozen: 5.0,
        effective_from: new Date().toISOString().split('T')[0],
        created_at: new Date().toISOString()
      }
    ];
    await AsyncStorage.setItem(`falltrack_rates_${userId}`, JSON.stringify(initial));
    return initial;
  }
  return JSON.parse(data);
};

const getLocalEntries = async (): Promise<ProductionEntry[]> => {
  const userId = await getActiveUserId();
  const data = await AsyncStorage.getItem(`falltrack_entries_${userId}`);
  return data ? JSON.parse(data) : [];
};

const getLocalIncomePeriods = async (): Promise<IncomePeriod[]> => {
  const userId = await getActiveUserId();
  const data = await AsyncStorage.getItem(`falltrack_income_periods_${userId}`);
  return data ? JSON.parse(data) : [];
};

const saveLocalColors = async (colors: Color[]): Promise<void> => {
  const userId = await getActiveUserId();
  await AsyncStorage.setItem(`falltrack_colors_${userId}`, JSON.stringify(colors));
};

const saveLocalRates = async (rates: Rate[]): Promise<void> => {
  const userId = await getActiveUserId();
  await AsyncStorage.setItem(`falltrack_rates_${userId}`, JSON.stringify(rates));
};

const saveLocalEntries = async (entries: ProductionEntry[]): Promise<void> => {
  const userId = await getActiveUserId();
  await AsyncStorage.setItem(`falltrack_entries_${userId}`, JSON.stringify(entries));
};

const saveLocalIncomePeriods = async (periods: IncomePeriod[]): Promise<void> => {
  const userId = await getActiveUserId();
  await AsyncStorage.setItem(`falltrack_income_periods_${userId}`, JSON.stringify(periods));
};

export const withTimeout = (promise: any, ms: number = 8000): Promise<any> => {
  return Promise.race([
    promise,
    new Promise<any>((_, reject) =>
      setTimeout(() => reject(new Error('Network request timed out')), ms)
    )
  ]);
};

export const dbService = {
  // ==========================================
  // Colors API
  // ==========================================
  async getColors(forceLocal?: boolean): Promise<Color[]> {
    if (!forceLocal && isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await withTimeout(
          supabase
            .from('colors')
            .select('*')
            .order('name', { ascending: true })
        );
        if (error) throw error;

        // Self-healing: if color list is empty, seed default colors for the user
        if (!data || data.length === 0) {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const initialColors = SEED_COLORS.map(name => ({
              id: `default-${name}`,
              name,
              user_id: user.id
            }));
            const { data: seeded, error: seedErr } = await supabase
              .from('colors')
              .insert(initialColors)
              .select()
              .order('name', { ascending: true });
            if (!seedErr && seeded) {
              await saveLocalColors(seeded);
              return seeded;
            }
          }
        }

        // Automatic background deduplication in Supabase
        if (data && data.length > 0) {
          const uniqueNames = new Set<string>();
          const duplicatesToDelete: Color[] = [];
          const keptColorsMap = new Map<string, string>(); // name -> keptId

          // Prioritize global seed colors (user_id IS NULL) or default IDs as canonical row,
          // so user-owned duplicate (user_id = auth.uid()) can be safely deleted under RLS!
          const sorted = [...data].sort((a, b) => {
            const aGlobal = !a.user_id || a.id.startsWith('default-') || a.id.startsWith('mobile-default');
            const bGlobal = !b.user_id || b.id.startsWith('default-') || b.id.startsWith('mobile-default');
            if (aGlobal && !bGlobal) return -1;
            if (!aGlobal && bGlobal) return 1;
            return (a.created_at || '').localeCompare(b.created_at || '');
          });

          for (const col of sorted) {
            const normName = col.name.trim().toLowerCase();
            if (uniqueNames.has(normName)) {
              if (col.user_id) {
                duplicatesToDelete.push(col);
              }
            } else {
              uniqueNames.add(normName);
              keptColorsMap.set(normName, col.id);
            }
          }

          if (duplicatesToDelete.length > 0) {
            (async () => {
              try {
                for (const dup of duplicatesToDelete) {
                  const norm = dup.name.trim().toLowerCase();
                  const keptId = keptColorsMap.get(norm);
                  if (keptId) {
                    await supabase
                      .from('production_entries')
                      .update({ color_id: keptId })
                      .eq('color_id', dup.id);
                    await supabase
                      .from('colors')
                      .delete()
                      .eq('id', dup.id);
                  }
                }
              } catch (e) {
                console.warn('Background color deduplication warning:', e);
              }
            })();
          }
        }

        const cleanColors = deduplicateColors(data || []);
        await saveLocalColors(cleanColors);
        return cleanColors;
      } catch (err) {
        console.warn('Supabase getColors failed, falling back to local storage:', err);
      }
    }
    
    // Fallback block if offline or not configured
    const localColors = await getLocalColors();
    const cleanColors = deduplicateColors(localColors);
    await saveLocalColors(cleanColors);
    return cleanColors;
  },

  async createColor(name: string): Promise<Color> {
    const trimmedName = name.trim();
    if (isSupabaseConfigured && supabase) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        // Check if it already exists to avoid conflict
        const { data: existing } = await supabase
          .from('colors')
          .select('*')
          .eq('name', trimmedName)
          .maybeSingle();

        if (existing) {
          throw new Error('Color is already present in the list.');
        }

        const { data, error } = await supabase
          .from('colors')
          .insert([{ name: trimmedName, user_id: user?.id }])
          .select()
          .single();
        if (error) throw error;

        // Cache locally as synced
        const localColors = await getLocalColors();
        const newColor = { ...data, synced: true };
        await saveLocalColors([...localColors.filter(c => c.id !== data.id), newColor]);

        return data;
      } catch (err: any) {
        if (err.message === 'Color is already present in the list.') throw err;
        console.warn('Supabase createColor failed, saving locally:', err);
      }
    }

    const colors = await getLocalColors();
    const existing = colors.find(c => c.name.toLowerCase() === trimmedName.toLowerCase());
    if (existing) {
      throw new Error('Color is already present in the list.');
    }
    const newColor: Color = {
      id: generateUUID(),
      name: trimmedName,
      created_at: new Date().toISOString(),
      synced: false
    } as any;
    colors.push(newColor);
    await saveLocalColors(colors);
    return newColor;
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
      const colors = await getLocalColors();
      const idx = colors.findIndex(c => c.id === id);
      if (idx === -1) throw new Error('Color not found');
      
      colors[idx].name = trimmedName;
      await saveLocalColors(colors);

      // Update cached color details in production entries
      const entries = await getLocalEntries();
      let changed = false;
      entries.forEach(e => {
        if (e.color_id === id) {
          e.color = colors[idx];
          changed = true;
        }
      });
      if (changed) {
        await saveLocalEntries(entries);
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
      const entries = await getLocalEntries();
      const isReferenced = entries.some(e => e.color_id === id);
      if (isReferenced) {
        throw new Error('Color is referenced by production entries');
      }

      const colors = await getLocalColors();
      const filtered = colors.filter(c => c.id !== id);
      await saveLocalColors(filtered);
    }
  },

  // ==========================================
  // Rates API
  // ==========================================
  async getRates(forceLocal?: boolean): Promise<Rate[]> {
    if (!forceLocal && isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await withTimeout(
          supabase
            .from('rates')
            .select('*')
            .order('effective_from', { ascending: false })
        );
        if (error) throw error;
        const formatted = (data || []).map((r: any) => ({
          ...r,
          rate_per_dozen: Number(r.rate_per_dozen)
        }));
        await saveLocalRates(formatted);
        return formatted;
      } catch (err) {
        console.warn('Supabase getRates failed, falling back to local storage:', err);
      }
    }
    
    // Fallback block if offline or not configured
    {
      const local = await getLocalRates();
      return local.sort(
        (a, b) => b.effective_from.localeCompare(a.effective_from)
      );
    }
  },

  async createRate(rate: Omit<Rate, 'id'>): Promise<Rate> {
    if (isSupabaseConfigured && supabase) {
      try {
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
        
        const returned = {
          ...data,
          rate_per_dozen: Number(data.rate_per_dozen)
        };

        // Cache locally as synced
        const rates = await getLocalRates();
        await saveLocalRates([...rates.filter(r => r.id !== returned.id), { ...returned, synced: true }]);

        return returned;
      } catch (err) {
        console.warn('Supabase createRate failed, saving locally:', err);
      }
    }

    const rates = await getLocalRates();
    const newRate: Rate = {
      id: generateUUID(),
      rate_per_dozen: rate.rate_per_dozen,
      effective_from: rate.effective_from,
      created_at: new Date().toISOString(),
      synced: false
    } as any;
    rates.push(newRate);
    await saveLocalRates(rates);
    return newRate;
  },

  async deleteRate(id: string): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from('rates')
        .delete()
        .eq('id', id);
      if (error) throw error;
    } else {
      const rates = await getLocalRates();
      const updated = rates.filter(r => r.id !== id);
      await saveLocalRates(updated);
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
  }, forceLocal?: boolean): Promise<ProductionEntry[]> {
    let result: ProductionEntry[] = [];
    let fetchedFromCloud = false;

    if (!forceLocal && isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await withTimeout(
          supabase
            .from('production_entries')
            .select('*, color:colors(*)')
        );

        if (error) throw error;

        result = (data || []).map((item: any) => ({
          id: item.id,
          entry_date: item.entry_date,
          color_id: item.color_id,
          quantity: item.quantity,
          created_at: item.created_at,
          color: item.color ? { id: item.color.id, name: item.color.name } : undefined
        }));

        // Merge cache: Keep local unsynced, filter out offline deleted
        const local = await getLocalEntries();
        const unsynced = local.filter((e: any) => e.synced === false);
        const deleteQueue = await getDeletedEntriesQueue();

        result = result.filter(e => !deleteQueue.includes(e.id));

        const cleanEntries = (data || []).map((item: any) => ({
          id: item.id,
          entry_date: item.entry_date,
          color_id: item.color_id,
          quantity: item.quantity,
          created_at: item.created_at,
          synced: true
        })).filter((e: any) => !deleteQueue.includes(e.id));

        const merged = [...unsynced, ...cleanEntries];
        await saveLocalEntries(merged);
        fetchedFromCloud = true;
      } catch (err) {
        console.warn('Supabase getProductionEntries failed, falling back to local storage:', err);
      }
    }

    if (!fetchedFromCloud) {
      const colors = await getLocalColors();
      const localEntries = await getLocalEntries();
      const deleteQueue = await getDeletedEntriesQueue();
      
      result = localEntries
        .filter(e => !deleteQueue.includes(e.id))
        .map(e => ({
          ...e,
          color: colors.find(c => c.id === e.color_id)
        }));
    } else {
      // Populate colors for unsynced local entries in final list
      const colors = await getLocalColors();
      result = result.map(e => {
        if (!e.color && e.color_id) {
          return {
            ...e,
            color: colors.find(c => c.id === e.color_id)
          };
        }
        return e;
      });
    }

    // Deduplicate list by entry ID
    const seenIds = new Set<string>();
    result = result.filter(e => {
      if (seenIds.has(e.id)) return false;
      seenIds.add(e.id);
      return true;
    });

    // Apply filters
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

    return result.sort((a, b) => {
      const dateCompare = b.entry_date.localeCompare(a.entry_date);
      if (dateCompare !== 0) return dateCompare;
      return (b.created_at || '').localeCompare(a.created_at || '');
    });
  },

  async saveProductionEntries(entries: Omit<ProductionEntry, 'id'>[]): Promise<ProductionEntry[]> {
    if (isSupabaseConfigured && supabase) {
      try {
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

        const returned = (data || []).map(item => ({
          id: item.id,
          entry_date: item.entry_date,
          color_id: item.color_id,
          quantity: item.quantity,
          created_at: item.created_at,
          color: item.color ? { id: item.color.id, name: item.color.name } : undefined,
          synced: true
        }));

        // Merge cache: Keep all existing entries and append the new ones safely (with deduplication)
        const local = await getLocalEntries();
        const cleanReturned = returned.map(e => ({
          id: e.id,
          entry_date: e.entry_date,
          color_id: e.color_id,
          quantity: e.quantity,
          created_at: e.created_at,
          synced: true
        }));
        
        const seenIds = new Set<string>();
        const merged: any[] = [];
        for (const item of [...local, ...cleanReturned]) {
          if (!seenIds.has(item.id)) {
            seenIds.add(item.id);
            merged.push(item);
          }
        }
        await saveLocalEntries(merged);

        return returned;
      } catch (err) {
        console.warn('Supabase saveProductionEntries failed, saving locally:', err);
      }
    }

    const localEntries = await getLocalEntries();
    const colors = await getLocalColors();
    const saved: ProductionEntry[] = [];

    entries.forEach(e => {
      const newEntry: ProductionEntry = {
        id: generateUUID(),
        entry_date: e.entry_date,
        color_id: e.color_id,
        quantity: e.quantity,
        created_at: new Date().toISOString(),
        color: colors.find(c => c.id === e.color_id),
        synced: false
      } as any;
      localEntries.push(newEntry);
      saved.push(newEntry);
    });

    await saveLocalEntries(localEntries);
    return saved;
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
      // Update the local cache immediately with edited values to keep totals perfectly aligned
      const local = await getLocalEntries();
      const idx = local.findIndex(e => e.id === id);
      if (idx !== -1) {
        local[idx] = {
          ...local[idx],
          entry_date: data.entry_date,
          color_id: data.color_id,
          quantity: data.quantity,
          synced: true
        } as any;
        await saveLocalEntries(local);
      }

      return {
        id: data.id,
        entry_date: data.entry_date,
        color_id: data.color_id,
        quantity: data.quantity,
        created_at: data.created_at,
        color: data.color ? { id: data.color.id, name: data.color.name } : undefined
      };
    } else {
      const localEntries = await getLocalEntries();
      const idx = localEntries.findIndex(e => e.id === id);
      if (idx === -1) throw new Error('Record not found');

      const colors = await getLocalColors();
      const updated = {
        ...localEntries[idx],
        ...entry,
        color: entry.color_id ? colors.find(c => c.id === entry.color_id) : localEntries[idx].color
      };

      localEntries[idx] = updated;
      await saveLocalEntries(localEntries);
      return updated;
    }
  },

  async deleteProductionEntry(id: string): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase
          .from('production_entries')
          .delete()
          .eq('id', id);
        if (error) throw error;
      } catch (err) {
        console.warn('Supabase deleteProductionEntry failed, queueing deletion:', err);
        await queueEntryDeletion(id);
      }
    } else {
      await queueEntryDeletion(id);
    }

    const localEntries = await getLocalEntries();
    const filtered = localEntries.filter(e => e.id !== id);
    await saveLocalEntries(filtered);
  },

  // Profile Settings API
  async getProfile(forceLocal?: boolean): Promise<{ app_name: string; manager_name: string; manager_phone: string }> {
    if (!forceLocal && isSupabaseConfigured && supabase) {
      try {
        const { data: { user } } = await withTimeout(supabase.auth.getUser());
        if (user) {
          let { data, error } = await withTimeout(
            supabase
              .from('profile')
              .select('app_name, manager_name, manager_phone')
              .maybeSingle()
          );
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
            await AsyncStorage.setItem(`falltrack_app_name_${userId}`, data.app_name);
            await AsyncStorage.setItem(`falltrack_profile_name_${userId}`, data.manager_name);
            await AsyncStorage.setItem(`falltrack_profile_phone_${userId}`, data.manager_phone);
            return data;
          }
        }
      } catch (err) {
        console.warn('Supabase getProfile failed, falling back to local storage:', err);
      }
    }
    const userId = await getActiveUserId();
    return {
      app_name: (await AsyncStorage.getItem(`falltrack_app_name_${userId}`)) || 'FallTrack',
      manager_name: (await AsyncStorage.getItem(`falltrack_profile_name_${userId}`)) || 'Manager',
      manager_phone: (await AsyncStorage.getItem(`falltrack_profile_phone_${userId}`)) || '9876543210'
    };
  },

  async updateProfile(name: string, phone: string, appName: string): Promise<void> {
    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    const trimmedAppName = appName.trim();

    const userId = await getActiveUserId();
    await AsyncStorage.setItem(`falltrack_app_name_${userId}`, trimmedAppName);
    await AsyncStorage.setItem(`falltrack_profile_name_${userId}`, trimmedName);
    await AsyncStorage.setItem(`falltrack_profile_phone_${userId}`, trimmedPhone);

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

  // Custom Income Periods API
  async getIncomePeriods(forceLocal?: boolean): Promise<IncomePeriod[]> {
    if (!forceLocal && isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await withTimeout(
          supabase
            .from('income_periods')
            .select('*')
            .order('start_date', { ascending: true })
        );
        if (error) throw error;
        const formatted = (data || []).map((p: any) => ({
          ...p,
          total_income: Number(p.total_income)
        }));
        await saveLocalIncomePeriods(formatted);
        return formatted;
      } catch (err) {
        console.warn('Supabase getIncomePeriods failed, falling back to local storage:', err);
      }
    }
    
    // Fallback block if offline or not configured
    {
      const local = await getLocalIncomePeriods();
      return local.sort(
        (a, b) => a.start_date.localeCompare(b.start_date)
      );
    }
  },

  async createIncomePeriod(period: Omit<IncomePeriod, 'id'>): Promise<IncomePeriod> {
    if (isSupabaseConfigured && supabase) {
      try {
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

        const returned = {
          ...data,
          total_income: Number(data.total_income)
        };

        // Cache locally as synced
        const periods = await getLocalIncomePeriods();
        await saveLocalIncomePeriods([...periods.filter(p => p.id !== returned.id), { ...returned, synced: true }]);

        return returned;
      } catch (err) {
        console.warn('Supabase createIncomePeriod failed, saving locally:', err);
      }
    }

    const periods = await getLocalIncomePeriods();
    const newPeriod: IncomePeriod = {
      id: generateUUID(),
      ...period,
      created_at: new Date().toISOString(),
      synced: false
    } as any;
    periods.push(newPeriod);
    await saveLocalIncomePeriods(periods);
    return newPeriod;
  },

  async deleteIncomePeriod(id: string): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase
          .from('income_periods')
          .delete()
          .eq('id', id);
        if (error) throw error;
      } catch (err) {
        console.warn('Supabase deleteIncomePeriod failed, deleting locally:', err);
      }
    }
    const periods = await getLocalIncomePeriods();
    const updated = periods.filter(p => p.id !== id);
    await saveLocalIncomePeriods(updated);
  },

  // Draft API
  async getDraft(): Promise<{ rows: any; date: string | null }> {
    const userId = await getActiveUserId();
    const rows = await AsyncStorage.getItem(`falltrack_mobile_draft_rows_${userId}`);
    const date = await AsyncStorage.getItem(`falltrack_mobile_draft_date_${userId}`);
    return {
      rows: rows ? JSON.parse(rows) : null,
      date
    };
  },
  async saveDraft(rows: any, date: string): Promise<void> {
    const userId = await getActiveUserId();
    await AsyncStorage.setItem(`falltrack_mobile_draft_rows_${userId}`, JSON.stringify(rows));
    await AsyncStorage.setItem(`falltrack_mobile_draft_date_${userId}`, date);
  },
  async clearDraft(): Promise<void> {
    const userId = await getActiveUserId();
    await AsyncStorage.removeItem(`falltrack_mobile_draft_rows_${userId}`);
    await AsyncStorage.removeItem(`falltrack_mobile_draft_date_${userId}`);
  }
};

export const cleanDatabaseDuplicatesOneTime = async () => {
  if (!isSupabaseConfigured || !supabase) return;
  
  try {
    const cleanedFlag = await AsyncStorage.getItem('falltrack_duplicates_cleaned_v2');
    if (cleanedFlag === 'true') return;
    
    console.log('Running one-time database duplicate cleanup...');
    const { data: entries, error } = await supabase
      .from('production_entries')
      .select('*');
      
    if (error || !entries || entries.length === 0) return;
    
    const cleanPairs = [
      { source: '2026-07-11', target: '2026-07-05' },
      { source: '2026-07-12', target: '2026-07-07' }
    ];
    
    const idsToDelete: string[] = [];
    
    for (const pair of cleanPairs) {
      const sourceEntries = entries.filter(e => e.entry_date === pair.source);
      let targetEntries = entries.filter(e => e.entry_date === pair.target);
      
      if (sourceEntries.length > 0 && targetEntries.length > 0) {
        for (const source of sourceEntries) {
          const matchIdx = targetEntries.findIndex(
            t => t.color_id === source.color_id && t.quantity === source.quantity
          );
          if (matchIdx !== -1) {
            idsToDelete.push(targetEntries[matchIdx].id);
            targetEntries = targetEntries.filter((_, idx) => idx !== matchIdx);
          }
        }
      }
    }
    
    if (idsToDelete.length > 0) {
      console.log(`Deleting ${idsToDelete.length} duplicate entries from Supabase...`);
      const { error: delErr } = await supabase
        .from('production_entries')
        .delete()
        .in('id', idsToDelete);
        
      if (delErr) {
        console.warn('Cleanup delete error:', delErr);
        return;
      }
    }
    
    await AsyncStorage.setItem('falltrack_duplicates_cleaned_v2', 'true');
    console.log('Successfully cleaned up duplicate entries in Supabase!');
  } catch (err) {
    console.error('Error running duplicate cleanup:', err);
  }
};
