import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { UserProfile, InitialSetupData } from '../types';

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
      // 1. Fetch user profile row from Supabase
      const { data, error } = await supabase
        .from('profile')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.warn('Error fetching profile from database:', error.message);
        throw error;
      }

      // If no profile row exists, the user has not completed initial setup
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

      // Backward compatibility fallback (in case SQL column is not yet migrated):
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
    } else {
      // Offline mode check
      const savedCompleted = localStorage.getItem(`falltrack_setup_completed_${userId}`);
      const appName = localStorage.getItem(`falltrack_app_name_${userId}`) || 'FallTrack';
      const managerName = localStorage.getItem(`falltrack_profile_name_${userId}`) || '';
      const managerPhone = localStorage.getItem(`falltrack_profile_phone_${userId}`) || '';

      const isCompleted = savedCompleted === 'true';
      const profile: UserProfile = {
        user_id: userId,
        app_name: appName,
        manager_name: managerName,
        manager_phone: managerPhone,
        is_setup_completed: isCompleted
      };

      return { profile, isSetupCompleted: isCompleted };
    }
  },

  /**
   * Persists the mandatory initial system setup:
   * 1. Saves profile with manager name, mobile number, and is_setup_completed = true.
   * 2. Sets the initial rate per dozen in the rates table.
   * 3. Seeds Marathi colors if needed.
   * 4. Updates local caches.
   */
  async completeInitialSetup(userId: string, data: InitialSetupData): Promise<UserProfile> {
    if (!userId) {
      throw new Error('User authentication session required to complete setup.');
    }

    // 1. Validation & sanitization
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
      throw new Error('Rate per dozen exceeds the maximum allowable limit of ₹10,000.00.');
    }
    const cleanRate = Number(rawRate.toFixed(2));

    const todayStr = new Date().toISOString().split('T')[0];
    const nowIso = new Date().toISOString();

    if (isSupabaseConfigured && supabase) {
      // 2. Persist Profile to Supabase
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
        // Fallback: If is_setup_completed column does not exist yet on remote table
        if (err.message && err.message.includes('is_setup_completed')) {
          console.warn('is_setup_completed column not found in database schema, inserting standard fields.');
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

      // 3. Configure Initial Rate in rates table
      const { data: existingRates, error: ratesFetchErr } = await supabase
        .from('rates')
        .select('id, effective_from')
        .eq('user_id', userId)
        .order('effective_from', { ascending: false });

      if (ratesFetchErr) {
        console.warn('Could not inspect existing rates:', ratesFetchErr.message);
      }

      if (existingRates && existingRates.length > 0) {
        // Update the primary/latest rate with the user's custom rate
        const primaryRate = existingRates[0];
        const { error: updateRateErr } = await supabase
          .from('rates')
          .update({
            rate_per_dozen: cleanRate,
            effective_from: primaryRate.effective_from || todayStr
          })
          .eq('id', primaryRate.id)
          .eq('user_id', userId);

        if (updateRateErr) console.warn('Rate update warning:', updateRateErr.message);
      } else {
        // Insert new initial rate card
        const { error: insertRateErr } = await supabase
          .from('rates')
          .insert([{
            rate_per_dozen: cleanRate,
            effective_from: todayStr,
            user_id: userId
          }]);

        if (insertRateErr) throw insertRateErr;
      }

      // 4. Seed Standard Colors if user has none
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
        console.warn('Color seed note:', colorErr);
      }

      // 5. Update local storage caches
      localStorage.setItem(`falltrack_app_name_${userId}`, 'FallTrack');
      localStorage.setItem(`falltrack_profile_name_${userId}`, cleanName);
      localStorage.setItem(`falltrack_profile_phone_${userId}`, cleanPhone);
      localStorage.setItem(`falltrack_setup_completed_${userId}`, 'true');

      return {
        user_id: userId,
        app_name: 'FallTrack',
        manager_name: cleanName,
        manager_phone: cleanPhone,
        is_setup_completed: true,
        updated_at: nowIso
      };
    } else {
      // Offline/Local Mode
      localStorage.setItem(`falltrack_app_name_${userId}`, 'FallTrack');
      localStorage.setItem(`falltrack_profile_name_${userId}`, cleanName);
      localStorage.setItem(`falltrack_profile_phone_${userId}`, cleanPhone);
      localStorage.setItem(`falltrack_setup_completed_${userId}`, 'true');

      // Save initial rate
      const initialRates = [
        {
          id: 'initial-rate-' + Date.now(),
          rate_per_dozen: cleanRate,
          effective_from: todayStr,
          created_at: nowIso
        }
      ];
      localStorage.setItem(`falltrack_rates_${userId}`, JSON.stringify(initialRates));

      return {
        user_id: userId,
        app_name: 'FallTrack',
        manager_name: cleanName,
        manager_phone: cleanPhone,
        is_setup_completed: true,
        updated_at: nowIso
      };
    }
  },

  /**
   * Updates existing profile settings from the Settings page.
   * Preserves is_setup_completed = true.
   */
  async updateProfile(userId: string, name: string, phone: string, appName: string): Promise<UserProfile> {
    const cleanName = name.trim();
    const cleanPhone = normalizeIndianMobile(phone);
    const cleanApp = appName.trim() || 'FallTrack';

    if (!cleanName) throw new Error('Manager name cannot be empty.');
    if (!cleanPhone || !/^[6-9]\d{9}$/.test(cleanPhone)) {
      throw new Error('Please enter a valid 10-digit Indian mobile number.');
    }

    const nowIso = new Date().toISOString();

    localStorage.setItem(`falltrack_app_name_${userId}`, cleanApp);
    localStorage.setItem(`falltrack_profile_name_${userId}`, cleanName);
    localStorage.setItem(`falltrack_profile_phone_${userId}`, cleanPhone);

    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase
          .from('profile')
          .upsert({
            user_id: userId,
            app_name: cleanApp,
            manager_name: cleanName,
            manager_phone: cleanPhone,
            is_setup_completed: true,
            updated_at: nowIso
          });

        if (error) throw error;
        return {
          user_id: userId,
          app_name: cleanApp,
          manager_name: cleanName,
          manager_phone: cleanPhone,
          is_setup_completed: true,
          updated_at: nowIso
        };
      } catch (err: any) {
        if (err.message && err.message.includes('is_setup_completed')) {
          const { error: fallbackErr } = await supabase
            .from('profile')
            .upsert({
              user_id: userId,
              app_name: cleanApp,
              manager_name: cleanName,
              manager_phone: cleanPhone,
              updated_at: nowIso
            });
          if (fallbackErr) throw fallbackErr;
        } else {
          throw err;
        }
      }
    }

    return {
      user_id: userId,
      app_name: cleanApp,
      manager_name: cleanName,
      manager_phone: cleanPhone,
      is_setup_completed: true,
      updated_at: nowIso
    };
  }
};
