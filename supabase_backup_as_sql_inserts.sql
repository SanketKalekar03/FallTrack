-- ============================================================================
-- FallTrack: Export Database as Pure SQL INSERT Statements
-- ============================================================================
-- Run this in Supabase SQL Editor if you prefer a raw SQL dump containing
-- INSERT statements that can be re-run on any PostgreSQL database.
-- ============================================================================

-- 1. Profiles Table DUMP
SELECT FORMAT(
    'INSERT INTO public.profile (user_id, app_name, manager_name, manager_phone, updated_at) VALUES (%L, %L, %L, %L, %L) ON CONFLICT (user_id) DO NOTHING;',
    user_id, app_name, manager_name, manager_phone, updated_at
) AS sql_insert
FROM public.profile

UNION ALL

-- 2. Colors Table DUMP
SELECT FORMAT(
    'INSERT INTO public.colors (id, name, user_id, created_at) VALUES (%L, %L, %L, %L) ON CONFLICT DO NOTHING;',
    id, name, user_id, created_at
)
FROM public.colors

UNION ALL

-- 3. Rates Table DUMP
SELECT FORMAT(
    'INSERT INTO public.rates (id, rate_per_dozen, effective_from, user_id, created_at) VALUES (%L, %s, %L, %L, %L) ON CONFLICT DO NOTHING;',
    id, rate_per_dozen, effective_from, user_id, created_at
)
FROM public.rates

UNION ALL

-- 4. Production Entries Table DUMP (Historical Logs)
SELECT FORMAT(
    'INSERT INTO public.production_entries (id, entry_date, color_id, quantity, user_id, created_at) VALUES (%L, %L, %L, %s, %L, %L) ON CONFLICT DO NOTHING;',
    id, entry_date, color_id, quantity, user_id, created_at
)
FROM public.production_entries

UNION ALL

-- 5. Income Periods Table DUMP (Billing Cycles)
SELECT FORMAT(
    'INSERT INTO public.income_periods (id, period_name, start_date, end_date, total_falls, total_income, user_id, created_at) VALUES (%L, %L, %L, %L, %s, %s, %L, %L) ON CONFLICT DO NOTHING;',
    id, period_name, start_date, end_date, total_falls, total_income, user_id, created_at
)
FROM public.income_periods;
