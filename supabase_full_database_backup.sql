-- ============================================================================
-- FallTrack: Complete Supabase Database Backup Script
-- ============================================================================
-- PURPOSE:
-- Takes a complete, unified snapshot of your entire FallTrack Supabase database,
-- including:
-- 1. All Users (from auth.users with emails, metadata, sign-in history)
-- 2. All Manager Profiles (from public.profile)
-- 3. All Historical Daily Production Logs (from public.production_entries)
-- 4. All Finalized Income & Billing Periods (from public.income_periods)
-- 5. All Historical Rate Cards (from public.rates)
-- 6. All Colors (standard global + custom colors from public.colors)
--
-- HOW TO USE IN SUPABASE:
-- 1. Go to your Supabase Dashboard: https://supabase.com/dashboard/project/mbawwfjfqzhkrptrgoar
-- 2. Open "SQL Editor" in the left sidebar.
-- 3. Paste this script and click "Run".
-- 4. In the Results panel, click the cell to copy the full JSON, or click
--    "Download as CSV / JSON".
-- ============================================================================

-- ============================================================================
-- OPTION 1: COMPLETE ALL-IN-ONE PRETTY JSON BACKUP (Recommended)
-- ============================================================================
SELECT jsonb_pretty(
    jsonb_build_object(
        'backup_metadata', jsonb_build_object(
            'application', 'FallTrack',
            'exported_at', NOW(),
            'database_host', 'mbawwfjfqzhkrptrgoar.supabase.co',
            'summary', jsonb_build_object(
                'total_users', (SELECT COUNT(*) FROM auth.users),
                'total_profiles', (SELECT COUNT(*) FROM public.profile),
                'total_production_entries', (SELECT COUNT(*) FROM public.production_entries),
                'total_income_periods', (SELECT COUNT(*) FROM public.income_periods),
                'total_rates', (SELECT COUNT(*) FROM public.rates),
                'total_colors', (SELECT COUNT(*) FROM public.colors)
            )
        ),
        'auth_users', COALESCE(
            (
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'id', u.id,
                        'email', u.email,
                        'phone', u.phone,
                        'role', u.role,
                        'created_at', u.created_at,
                        'updated_at', u.updated_at,
                        'last_sign_in_at', u.last_sign_in_at,
                        'email_confirmed_at', u.email_confirmed_at,
                        'raw_user_meta_data', u.raw_user_meta_data
                    )
                    ORDER BY u.created_at ASC
                )
                FROM auth.users u
            ),
            '[]'::jsonb
        ),
        'profiles', COALESCE(
            (
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'user_id', p.user_id,
                        'app_name', p.app_name,
                        'manager_name', p.manager_name,
                        'manager_phone', p.manager_phone,
                        'updated_at', p.updated_at
                    )
                    ORDER BY p.updated_at DESC
                )
                FROM public.profile p
            ),
            '[]'::jsonb
        ),
        'colors', COALESCE(
            (
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'id', c.id,
                        'name', c.name,
                        'user_id', c.user_id,
                        'created_at', c.created_at
                    )
                    ORDER BY c.created_at ASC
                )
                FROM public.colors c
            ),
            '[]'::jsonb
        ),
        'rates', COALESCE(
            (
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'id', r.id,
                        'rate_per_dozen', r.rate_per_dozen,
                        'effective_from', r.effective_from,
                        'user_id', r.user_id,
                        'created_at', r.created_at
                    )
                    ORDER BY r.effective_from ASC
                )
                FROM public.rates r
            ),
            '[]'::jsonb
        ),
        'production_entries', COALESCE(
            (
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'id', pe.id,
                        'entry_date', pe.entry_date,
                        'color_id', pe.color_id,
                        'color_name', (SELECT name FROM public.colors WHERE id = pe.color_id),
                        'quantity', pe.quantity,
                        'user_id', pe.user_id,
                        'created_at', pe.created_at
                    )
                    ORDER BY pe.entry_date ASC, pe.created_at ASC
                )
                FROM public.production_entries pe
            ),
            '[]'::jsonb
        ),
        'income_periods', COALESCE(
            (
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'id', ip.id,
                        'period_name', ip.period_name,
                        'start_date', ip.start_date,
                        'end_date', ip.end_date,
                        'total_falls', ip.total_falls,
                        'total_income', ip.total_income,
                        'user_id', ip.user_id,
                        'created_at', ip.created_at
                    )
                    ORDER BY ip.start_date ASC
                )
                FROM public.income_periods ip
            ),
            '[]'::jsonb
        )
    )
) AS complete_database_backup;
