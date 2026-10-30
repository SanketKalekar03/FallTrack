-- ============================================================================
-- FallTrack Mandatory First-Time System Setup Migration
-- ============================================================================
-- PURPOSE:
-- 1. Adds `is_setup_completed` column to the `profile` table to track initial setup completion.
-- 2. Preserves all existing users: Automatically marks existing accounts that have
--    historical entries, rates, or configured manager profiles as completed (TRUE).
-- 3. Ensures fresh accounts start with `is_setup_completed = FALSE` so they are prompted
--    with the mandatory setup modal on first login.
-- 4. Verifies Row Level Security (RLS) policies on `profile`.
-- ============================================================================

-- 1. Add is_setup_completed column to profile table if not present
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profile' AND column_name = 'is_setup_completed'
    ) THEN
        ALTER TABLE profile ADD COLUMN is_setup_completed BOOLEAN NOT NULL DEFAULT FALSE;
        RAISE NOTICE 'Added is_setup_completed column to profile table.';
    ELSE
        RAISE NOTICE 'is_setup_completed column already exists on profile table.';
    END IF;
END $$;

-- 2. Performance index for checking setup status
CREATE INDEX IF NOT EXISTS idx_profile_setup ON profile (user_id, is_setup_completed);

-- 3. BACKWARD COMPATIBILITY FOR EXISTING USERS:
-- Mark existing active accounts as setup completed so they are not forced to re-setup.
-- A user is considered already configured if:
--   a) They have at least one production entry, OR
--   b) They have at least one rate entry, OR
--   c) Their manager name is already configured (not 'Manager' or empty).
DO $$
DECLARE
    migrated_count INT := 0;
BEGIN
    UPDATE profile
    SET is_setup_completed = TRUE
    WHERE is_setup_completed = FALSE
      AND (
          user_id IN (SELECT DISTINCT user_id FROM production_entries WHERE user_id IS NOT NULL)
          OR user_id IN (SELECT DISTINCT user_id FROM rates WHERE user_id IS NOT NULL)
          OR (manager_name IS NOT NULL AND manager_name NOT IN ('Manager', ''))
      );

    GET DIAGNOSTICS migrated_count = ROW_COUNT;
    RAISE NOTICE 'Backward Compatibility: Marked % existing account(s) as setup completed.', migrated_count;
END $$;

-- 4. Verify RLS is active on profile
ALTER TABLE profile ENABLE ROW LEVEL SECURITY;

-- Ensure RLS policies exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profile' AND policyname = 'Allow read own profile') THEN
        CREATE POLICY "Allow read own profile" ON profile FOR SELECT USING (user_id = auth.uid());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profile' AND policyname = 'Allow insert own profile') THEN
        CREATE POLICY "Allow insert own profile" ON profile FOR INSERT WITH CHECK (user_id = auth.uid());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profile' AND policyname = 'Allow update own profile') THEN
        CREATE POLICY "Allow update own profile" ON profile FOR UPDATE USING (user_id = auth.uid());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profile' AND policyname = 'Allow delete own profile') THEN
        CREATE POLICY "Allow delete own profile" ON profile FOR DELETE USING (user_id = auth.uid());
    END IF;
END $$;

-- 5. Verification status
SELECT 'Mandatory First-Time Setup SQL migration successfully applied!' AS status;
