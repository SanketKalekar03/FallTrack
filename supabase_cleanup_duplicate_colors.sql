-- ============================================================================
-- FallTrack Cloud Database Duplicate Colors Cleanup
-- ============================================================================
-- PURPOSE:
-- Cleans up any duplicate color rows in Supabase so every standard color 
-- exists exactly ONCE in the database.
-- 
-- SAFETY:
-- 1. All historical production entries pointing to duplicate colors are
--    re-pointed to the canonical global color first.
-- 2. No production entries, quantities, dates, or rates are touched.
-- 3. Zero data loss.
-- ============================================================================

DO $$
DECLARE
    r RECORD;
    global_id UUID;
    merged_count INT := 0;
BEGIN
    -- For each user-specific color that has an equivalent global color (user_id IS NULL)
    FOR r IN 
        SELECT c_user.id AS user_color_id, c_user.name, c_global.id AS global_color_id
        FROM colors c_user
        JOIN colors c_global ON LOWER(TRIM(c_user.name)) = LOWER(TRIM(c_global.name))
        WHERE c_user.user_id IS NOT NULL 
          AND c_global.user_id IS NULL
    LOOP
        -- 1. Re-link any production entries using the duplicate user color to the global color
        UPDATE production_entries 
        SET color_id = r.global_color_id 
        WHERE color_id = r.user_color_id;

        -- 2. Safely delete the redundant duplicate user color row
        DELETE FROM colors WHERE id = r.user_color_id;

        merged_count := merged_count + 1;
        RAISE NOTICE 'Merged duplicate color % into canonical global color %', r.name, r.global_color_id;
    END LOOP;

    RAISE NOTICE 'Duplicate colors cleanup completed! Merged % duplicate colors.', merged_count;
END $$;

SELECT 'Duplicate colors cleanup finished successfully!' AS status;
