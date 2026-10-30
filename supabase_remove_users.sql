-- ============================================================================
-- FallTrack: Remove Specific Users & Associated Data Safely
-- ============================================================================
-- Targeted Users:
-- 1. b552fa09-7711-46fa-a09f-ea4c9af15326
-- 2. 4680d436-3c9e-46a4-affd-7eeef5c96f00
--
-- This script safely removes:
-- - All daily production entries logged by these users
-- - All finalized income / billing periods created by these users
-- - All custom rates assigned to these users
-- - All custom colors created by these users (keeps global standard colors)
-- - All profile / manager settings for these users
-- - The user accounts themselves from Supabase Auth (auth.users)
-- ============================================================================

DO $$
DECLARE
    target_users UUID[] := ARRAY[
        'b552fa09-7711-46fa-a09f-ea4c9af15326'::UUID,
        '4680d436-3c9e-46a4-affd-7eeef5c96f00'::UUID
    ];
    del_entries INT := 0;
    del_periods INT := 0;
    del_rates INT := 0;
    del_colors INT := 0;
    del_profiles INT := 0;
    del_users INT := 0;
BEGIN
    -- 1. Delete production entries belonging to these users
    DELETE FROM public.production_entries 
    WHERE user_id = ANY(target_users);
    GET DIAGNOSTICS del_entries = ROW_COUNT;

    -- 2. Delete income periods belonging to these users
    DELETE FROM public.income_periods 
    WHERE user_id = ANY(target_users);
    GET DIAGNOSTICS del_periods = ROW_COUNT;

    -- 3. Delete rates belonging to these users
    DELETE FROM public.rates 
    WHERE user_id = ANY(target_users);
    GET DIAGNOSTICS del_rates = ROW_COUNT;

    -- 4. Delete custom colors created by these users (global standard colors with user_id IS NULL remain untouched)
    DELETE FROM public.colors 
    WHERE user_id = ANY(target_users);
    GET DIAGNOSTICS del_colors = ROW_COUNT;

    -- 5. Delete profile records for these users
    DELETE FROM public.profile 
    WHERE user_id = ANY(target_users);
    GET DIAGNOSTICS del_profiles = ROW_COUNT;

    -- 6. Delete the users from Supabase Auth
    DELETE FROM auth.users 
    WHERE id = ANY(target_users);
    GET DIAGNOSTICS del_users = ROW_COUNT;

    -- Summary log
    RAISE NOTICE '---------------------------------------------------------';
    RAISE NOTICE 'User removal completed successfully:';
    RAISE NOTICE ' - Auth Users removed: %', del_users;
    RAISE NOTICE ' - Profiles removed: %', del_profiles;
    RAISE NOTICE ' - Production Entries removed: %', del_entries;
    RAISE NOTICE ' - Finalized Income Periods removed: %', del_periods;
    RAISE NOTICE ' - Rates removed: %', del_rates;
    RAISE NOTICE ' - Custom Colors removed: %', del_colors;
    RAISE NOTICE '---------------------------------------------------------';
END $$;

-- Verify that the users are no longer present
SELECT id, email, created_at 
FROM auth.users 
WHERE id IN (
    'b552fa09-7711-46fa-a09f-ea4c9af15326', 
    '4680d436-3c9e-46a4-affd-7eeef5c96f00'
);
