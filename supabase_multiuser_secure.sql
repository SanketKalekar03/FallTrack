-- ============================================================================
-- FallTrack Multi-Tenant Database Security & Historical Data Migration
-- ============================================================================
-- PURPOSE:
-- 1. Strictly protects and preserves all past historical records from the last 2 months.
-- 2. Makes the system 100% multi-user safe so new fall owners can register and
--    use FallTrack without ANY data conflicts, data leaks, or shared ledgers.
-- 3. Enforces PostgreSQL Row Level Security (RLS) across all tables.
-- 4. Automatically heals and merges duplicate colors while preserving all entries.
-- ============================================================================

-- 1. Ensure UUID extension is enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Add user_id column to tables if not already present
ALTER TABLE colors ADD COLUMN IF NOT EXISTS user_id UUID DEFAULT auth.uid() REFERENCES auth.users(id);
ALTER TABLE rates ADD COLUMN IF NOT EXISTS user_id UUID DEFAULT auth.uid() REFERENCES auth.users(id);
ALTER TABLE production_entries ADD COLUMN IF NOT EXISTS user_id UUID DEFAULT auth.uid() REFERENCES auth.users(id);
ALTER TABLE income_periods ADD COLUMN IF NOT EXISTS user_id UUID DEFAULT auth.uid() REFERENCES auth.users(id);

-- Create index on user_id for high performance filtering
CREATE INDEX IF NOT EXISTS idx_production_entries_user ON production_entries (user_id);
CREATE INDEX IF NOT EXISTS idx_rates_user ON rates (user_id);
CREATE INDEX IF NOT EXISTS idx_income_periods_user ON income_periods (user_id);
CREATE INDEX IF NOT EXISTS idx_colors_user ON colors (user_id);

-- 3. HISTORICAL DATA PROTECTION:
-- Safely bind any unassigned historical records (user_id IS NULL) to the primary existing owner account.
-- This guarantees NOT A SINGLE historical entry from the past 2 months is lost or unlinked.
DO $$
DECLARE
    primary_user_id UUID;
    entries_count INT;
    rates_count INT;
    periods_count INT;
BEGIN
    -- Find the earliest registered user account (the current owner)
    SELECT id INTO primary_user_id FROM auth.users ORDER BY created_at ASC LIMIT 1;
    
    IF primary_user_id IS NOT NULL THEN
        -- Link unassigned production entries
        SELECT COUNT(*) INTO entries_count FROM production_entries WHERE user_id IS NULL;
        UPDATE production_entries 
        SET user_id = primary_user_id 
        WHERE user_id IS NULL;

        -- Link unassigned rates
        SELECT COUNT(*) INTO rates_count FROM rates WHERE user_id IS NULL;
        UPDATE rates 
        SET user_id = primary_user_id 
        WHERE user_id IS NULL;

        -- Link unassigned finalized income periods
        SELECT COUNT(*) INTO periods_count FROM income_periods WHERE user_id IS NULL;
        UPDATE income_periods 
        SET user_id = primary_user_id 
        WHERE user_id IS NULL;

        RAISE NOTICE 'Historical Data Preserved: Bound % entries, % rates, and % periods to primary owner %', 
            entries_count, rates_count, periods_count, primary_user_id;
    ELSE
        RAISE NOTICE 'No auth user found in auth.users yet. Future users will be isolated automatically.';
    END IF;
END $$;

-- 4. Profile Table Multi-Tenant Migration
-- Re-architect profile to be keyed by user_id so every owner has their own independent profile.
DO $$
DECLARE
    primary_user_id UUID;
    old_app_name TEXT := 'FallTrack';
    old_mgr_name TEXT := 'Manager';
    old_mgr_phone TEXT := '9876543210';
BEGIN
    SELECT id INTO primary_user_id FROM auth.users ORDER BY created_at ASC LIMIT 1;
    
    -- If legacy single-row profile table exists (boolean id), migrate data safely
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profile' AND column_name = 'id' AND data_type = 'boolean'
    ) THEN
        SELECT app_name, manager_name, manager_phone 
        INTO old_app_name, old_mgr_name, old_mgr_phone 
        FROM profile LIMIT 1;

        DROP TABLE IF EXISTS profile CASCADE;

        CREATE TABLE profile (
            user_id UUID PRIMARY KEY DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
            app_name TEXT NOT NULL DEFAULT 'FallTrack',
            manager_name TEXT NOT NULL DEFAULT 'Manager',
            manager_phone TEXT NOT NULL DEFAULT '9876543210',
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
        );

        IF primary_user_id IS NOT NULL THEN
            INSERT INTO profile (user_id, app_name, manager_name, manager_phone)
            VALUES (primary_user_id, COALESCE(old_app_name, 'FallTrack'), COALESCE(old_mgr_name, 'Manager'), COALESCE(old_mgr_phone, '9876543210'))
            ON CONFLICT (user_id) DO NOTHING;
        END IF;
    ELSIF NOT EXISTS (
        SELECT 1 FROM information_schema.tables WHERE table_name = 'profile'
    ) THEN
        CREATE TABLE profile (
            user_id UUID PRIMARY KEY DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
            app_name TEXT NOT NULL DEFAULT 'FallTrack',
            manager_name TEXT NOT NULL DEFAULT 'Manager',
            manager_phone TEXT NOT NULL DEFAULT '9876543210',
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
        );
    END IF;
END $$;

-- 5. Safe Color Deduplication & Uniqueness Adjustment
-- Drop legacy table-wide constraint first if it exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'colors_name_key' AND table_name = 'colors'
    ) THEN
        ALTER TABLE colors DROP CONSTRAINT colors_name_key;
    END IF;
END $$;

-- Merge duplicate color rows safely by re-pointing production_entries to the kept row
DO $$
DECLARE
    r RECORD;
    kept_id UUID;
    dup RECORD;
    merged_count INT := 0;
BEGIN
    -- Find any duplicate (name, user_id) pairs
    FOR r IN 
        SELECT name, 
               COALESCE(user_id, '00000000-0000-0000-0000-000000000000'::UUID) AS effective_user_id,
               COUNT(*) 
        FROM colors 
        GROUP BY name, COALESCE(user_id, '00000000-0000-0000-0000-000000000000'::UUID)
        HAVING COUNT(*) > 1
    LOOP
        -- Pick the oldest/first color as the kept row
        SELECT id INTO kept_id 
        FROM colors 
        WHERE name = r.name 
          AND COALESCE(user_id, '00000000-0000-0000-0000-000000000000'::UUID) = r.effective_user_id
        ORDER BY created_at ASC 
        LIMIT 1;

        -- Process all redundant duplicate rows
        FOR dup IN 
            SELECT id 
            FROM colors 
            WHERE name = r.name 
              AND COALESCE(user_id, '00000000-0000-0000-0000-000000000000'::UUID) = r.effective_user_id
              AND id != kept_id
        LOOP
            -- Safely re-point any production entries using this duplicate to the kept color
            UPDATE production_entries 
            SET color_id = kept_id 
            WHERE color_id = dup.id;

            -- Delete the redundant duplicate color row
            DELETE FROM colors 
            WHERE id = dup.id;

            merged_count := merged_count + 1;
        END LOOP;
    END LOOP;

    IF merged_count > 0 THEN
        RAISE NOTICE 'Color Deduplication: Successfully merged % duplicate color rows without data loss.', merged_count;
    ELSE
        RAISE NOTICE 'No duplicate color rows found.';
    END IF;
END $$;

-- Create unique index scoped by user (or global if user_id is null)
CREATE UNIQUE INDEX IF NOT EXISTS idx_colors_name_per_user 
ON colors (name, COALESCE(user_id, '00000000-0000-0000-0000-000000000000'::UUID));

-- 6. Clean and Recreate Strict Row Level Security (RLS) Policies
-- Ensure RLS is active on every table
ALTER TABLE colors ENABLE ROW LEVEL SECURITY;
ALTER TABLE rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE income_periods ENABLE ROW LEVEL SECURITY;

-- Production Entries Policies
DROP POLICY IF EXISTS "Allow public read entries" ON production_entries;
DROP POLICY IF EXISTS "Allow public insert entries" ON production_entries;
DROP POLICY IF EXISTS "Allow public update entries" ON production_entries;
DROP POLICY IF EXISTS "Allow public delete entries" ON production_entries;
DROP POLICY IF EXISTS "Allow read own entries" ON production_entries;
DROP POLICY IF EXISTS "Allow insert own entries" ON production_entries;
DROP POLICY IF EXISTS "Allow update own entries" ON production_entries;
DROP POLICY IF EXISTS "Allow delete own entries" ON production_entries;

CREATE POLICY "Allow read own entries" ON production_entries FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Allow insert own entries" ON production_entries FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Allow update own entries" ON production_entries FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Allow delete own entries" ON production_entries FOR DELETE USING (user_id = auth.uid());

-- Rates Policies
DROP POLICY IF EXISTS "Allow public read rates" ON rates;
DROP POLICY IF EXISTS "Allow public insert rates" ON rates;
DROP POLICY IF EXISTS "Allow public update rates" ON rates;
DROP POLICY IF EXISTS "Allow public delete rates" ON rates;
DROP POLICY IF EXISTS "Allow read own rates" ON rates;
DROP POLICY IF EXISTS "Allow insert own rates" ON rates;
DROP POLICY IF EXISTS "Allow update own rates" ON rates;
DROP POLICY IF EXISTS "Allow delete own rates" ON rates;

CREATE POLICY "Allow read own rates" ON rates FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Allow insert own rates" ON rates FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Allow update own rates" ON rates FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Allow delete own rates" ON rates FOR DELETE USING (user_id = auth.uid());

-- Income Periods Policies
DROP POLICY IF EXISTS "Allow public read income_periods" ON income_periods;
DROP POLICY IF EXISTS "Allow public insert income_periods" ON income_periods;
DROP POLICY IF EXISTS "Allow public update income_periods" ON income_periods;
DROP POLICY IF EXISTS "Allow public delete income_periods" ON income_periods;
DROP POLICY IF EXISTS "Allow read own income_periods" ON income_periods;
DROP POLICY IF EXISTS "Allow insert own income_periods" ON income_periods;
DROP POLICY IF EXISTS "Allow update own income_periods" ON income_periods;
DROP POLICY IF EXISTS "Allow delete own income_periods" ON income_periods;

CREATE POLICY "Allow read own income_periods" ON income_periods FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Allow insert own income_periods" ON income_periods FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Allow update own income_periods" ON income_periods FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Allow delete own income_periods" ON income_periods FOR DELETE USING (user_id = auth.uid());

-- Profile Policies
DROP POLICY IF EXISTS "Allow public read profile" ON profile;
DROP POLICY IF EXISTS "Allow public insert profile" ON profile;
DROP POLICY IF EXISTS "Allow public update profile" ON profile;
DROP POLICY IF EXISTS "Allow public delete profile" ON profile;
DROP POLICY IF EXISTS "Allow read own profile" ON profile;
DROP POLICY IF EXISTS "Allow insert own profile" ON profile;
DROP POLICY IF EXISTS "Allow update own profile" ON profile;
DROP POLICY IF EXISTS "Allow delete own profile" ON profile;

CREATE POLICY "Allow read own profile" ON profile FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Allow insert own profile" ON profile FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Allow update own profile" ON profile FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Allow delete own profile" ON profile FOR DELETE USING (user_id = auth.uid());

-- Colors Policies
DROP POLICY IF EXISTS "Allow public read colors" ON colors;
DROP POLICY IF EXISTS "Allow public insert colors" ON colors;
DROP POLICY IF EXISTS "Allow public update colors" ON colors;
DROP POLICY IF EXISTS "Allow public delete colors" ON colors;
DROP POLICY IF EXISTS "Allow read global or own colors" ON colors;
DROP POLICY IF EXISTS "Allow insert own colors" ON colors;
DROP POLICY IF EXISTS "Allow update own colors" ON colors;
DROP POLICY IF EXISTS "Allow delete own colors" ON colors;

CREATE POLICY "Allow read global or own colors" ON colors FOR SELECT USING (user_id IS NULL OR user_id = auth.uid());
CREATE POLICY "Allow insert own colors" ON colors FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Allow update own colors" ON colors FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Allow delete own colors" ON colors FOR DELETE USING (user_id = auth.uid());

-- 7. Ensure Standard Marathi Seed Colors Exist Globally (user_id IS NULL)
INSERT INTO colors (name, user_id)
SELECT c.name, NULL::UUID
FROM (VALUES
    ('राणी'), ('लाल'), ('पांढरा'), ('केशरी'), ('निळा'), ('हिरवा'),
    ('पिवळा'), ('गुलाबी'), ('काळा'), ('राजवाडी'), ('मोरपंखी'), ('जांभळा')
) AS c(name)
WHERE NOT EXISTS (
    SELECT 1 FROM colors WHERE colors.name = c.name AND colors.user_id IS NULL
);

-- Verification query
SELECT 'Multi-user security migration successfully completed!' AS status;
