import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { UserProfile, InitialSetupData } from '../types';
import { withTimeout } from './dbService';

const SEED_COLORS = [
  'राणी', 'लाल', 'पांढरा', 'केशरी', 'निळा', 'हिरवा',
  'पिवळा', 'गुलाबी', 'काळा', 'राजवाडी', 'मोरपंखी', 'जांभळा'
];

/**
 * Normalizes Indian mobile number input:
 * Strips whitespace, dashes, parens, and leading '+91' or '0'
 * Returns clean 10-digit string.
 */
export const normalizeIndianMobile = (raw: string): string => {
  if (!raw) return '';
  return raw
    .trim()
    .replace(/[\s\-()]/g, '')
    .replace(/^(\+91|0)/, '');
};

/**
 * Validates Indian mobile number:
 * Must be exactly 10 digits starting with 6, 7, 8, or 9.
 */
export const isValidIndianMobile = (raw: string): boolean => {
  const normalized = normalizeIndianMobile(raw);
  return /^[6-9]\d{9}$/.test(normalized);
};

export const settingsService = {
  /**
   * Fetches the authenticated user's settings and verifies setup completion.
   * Database-backed source of truth.
   */
  async getUserSettings(userId: string): Promise<{ profile: UserProfile | null; isSetupCompleted: boolean }> {
    if (!userId) {
      return { profile: null, isSetupCompleted: false };
    }

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await withTimeout(
          supabase
            .from('profile')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle(),
          4000
        );

        if (error) {
          console.warn('Error fetching profile from Supabase:', error.message);
          throw error;
        }

        if (!data) {
          return { profile: null, isSetupCompleted: false };
        }

        // Explicit database flag check
        if (typeof data.is_setup_completed === 'boolean') {
          const profile: UserProfile = {
            user_id: data.user_id,
            app_name: data.app_name || 'FallTrack',
            manager_name: data.manager_name || '',
            manager_phone: data.manager_phone || '',
            is_setup_completed: data.is_setup_completed,
            updated_at: data.updated_at
          };
          return { profile, isSetupCompleted: data.is_setup_completed };
        }

        // Backward compatibility fallback:
        // Check if this account already has production entries, custom rates, or custom manager name.
        const hasCustomName = data.manager_name && data.manager_name !== 'Manager' && data.manager_name.trim() !== '';
        let hasExistingData = false;
        try {
          const { count: entriesCount } = await supabase
            .from('production_entries')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId);

          const { count: ratesCount } = await supabase
            .from('rates')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId);

          if ((entriesCount && entriesCount > 0) || (ratesCount && ratesCount > 0)) {
            hasExistingData = true;
          }
        } catch (checkErr) {
          console.warn('Fallback check failed:', checkErr);
        }

        const isCompleted = Boolean(hasCustomName || hasExistingData);
        const profile: UserProfile = {
          user_id: data.user_id,
          app_name: data.app_name || 'FallTrack',
          manager_name: data.manager_name || '',
          manager_phone: data.manager_phone || '',
          is_setup_completed: isCompleted,
          updated_at: data.updated_at
        };

        return { profile, isSetupCompleted: isCompleted };
      } catch (err) {
        console.warn('Supabase profile check failed, checking local cache:', err);
      }
    }

    // Offline / Local storage fallback
    const savedCompleted = await AsyncStorage.getItem(`falltrack_setup_completed_${userId}`);
    const appName = (await AsyncStorage.getItem(`falltrack_app_name_${userId}`)) || 'FallTrack';
    const managerName = (await AsyncStorage.getItem(`falltrack_profile_name_${userId}`)) || '';
    const managerPhone = (await AsyncStorage.getItem(`falltrack_profile_phone_${userId}`)) || '';

    const isCompleted = savedCompleted === 'true';
    const profile: UserProfile = {
      user_id: userId,
      app_name: appName,
      manager_name: managerName,
      manager_phone: managerPhone,
      is_setup_completed: isCompleted
    };

    return { profile, isSetupCompleted: isCompleted };
  },

  /**
   * Persists the mandatory initial system setup:
   * 1. Saves profile with manager name, mobile number, and is_setup_completed = true.
   * 2. Sets the initial rate per dozen in the rates table.
   * 3. Seeds Marathi colors if needed.
   * 4. Updates local AsyncStorage caches.
   */
  async completeInitialSetup(userId: string, data: InitialSetupData): Promise<UserProfile> {
    if (!userId) {
      throw new Error('User authentication session required to complete setup.');
    }

    // Validation & sanitization
    const cleanName = data.managerName.trim();
    if (!cleanName) {
      throw new Error('Manager name cannot be empty.');
    }
    if (cleanName.length < 2) {
      throw new Error('Manager name must be at least 2 characters.');
    }

    const cleanPhone = normalizeIndianMobile(data.mobileNumber);
    if (!cleanPhone) {
      throw new Error('Mobile number is required.');
    }
    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      throw new Error('Please enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.');
    }

    const rawRate = Number(data.ratePerDozen);
    if (isNaN(rawRate) || rawRate <= 0) {
      throw new Error('Rate per dozen must be a valid positive amount greater than 0.');
    }
    if (rawRate > 10000) {
      throw new Error('Rate per dozen exceeds allowable limit of ₹10,000.00.');
    }
    const cleanRate = Number(rawRate.toFixed(2));

    const todayStr = new Date().toISOString().split('T')[0];
    const nowIso = new Date().toISOString();

    if (isSupabaseConfigured && supabase) {
      // 1. Persist Profile
      try {
        const { error: profileErr } = await supabase
          .from('profile')
          .upsert({
            user_id: userId,
            app_name: 'FallTrack',
            manager_name: cleanName,
            manager_phone: cleanPhone,
            is_setup_completed: true,
            updated_at: nowIso
          });

        if (profileErr) throw profileErr;
      } catch (err: any) {
        if (err.message && err.message.includes('is_setup_completed')) {
          const { error: fallbackErr } = await supabase
            .from('profile')
            .upsert({
              user_id: userId,
              app_name: 'FallTrack',
              manager_name: cleanName,
              manager_phone: cleanPhone,
              updated_at: nowIso
            });
          if (fallbackErr) throw fallbackErr;
        } else {
          throw err;
        }
      }

      // 2. Configure Initial Rate
      const { data: existingRates } = await supabase
        .from('rates')
        .select('id, effective_from')
        .eq('user_id', userId)
        .order('effective_from', { ascending: false });

      if (existingRates && existingRates.length > 0) {
        const primaryRate = existingRates[0];
        await supabase
          .from('rates')
          .update({
            rate_per_dozen: cleanRate,
            effective_from: primaryRate.effective_from || todayStr
          })
          .eq('id', primaryRate.id)
          .eq('user_id', userId);
      } else {
        await supabase
          .from('rates')
          .insert([{
            rate_per_dozen: cleanRate,
            effective_from: todayStr,
            user_id: userId
          }]);
      }

      // 3. Seed Colors if user has none
      try {
        const { count: colorCount } = await supabase
          .from('colors')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId);

        if (!colorCount || colorCount === 0) {
          const initialColors = SEED_COLORS.map(name => ({
            name,
            user_id: userId
          }));
          await supabase.from('colors').insert(initialColors);
        }
      } catch (colorErr) {
        console.warn('Color seed note in mobile:', colorErr);
      }
    }

    // 4. Update AsyncStorage local caches
    await AsyncStorage.setItem(`falltrack_app_name_${userId}`, 'FallTrack');
    await AsyncStorage.setItem(`falltrack_profile_name_${userId}`, cleanName);
    await AsyncStorage.setItem(`falltrack_profile_phone_${userId}`, cleanPhone);
    await AsyncStorage.setItem(`falltrack_setup_completed_${userId}`, 'true');

    // Local rate cache
    const initialRates = [
      {
        id: 'initial-rate-' + Date.now(),
        rate_per_dozen: cleanRate,
        effective_from: todayStr,
        created_at: nowIso
      }
    ];
    await AsyncStorage.setItem(`falltrack_rates_${userId}`, JSON.stringify(initialRates));

    return {
      user_id: userId,
      app_name: 'FallTrack',
      manager_name: cleanName,
      manager_phone: cleanPhone,
      is_setup_completed: true,
      updated_at: nowIso
    };
  }
};
