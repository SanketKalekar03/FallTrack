-- FallTrack Supabase SQL Database Schema - Migration for Multi-User Auth
-- Run this in your Supabase SQL Editor to upgrade your database tables and set up Row Level Security.

-- 1. Disable existing public policies
DROP POLICY IF EXISTS "Allow public read colors" ON colors;
DROP POLICY IF EXISTS "Allow public insert colors" ON colors;
DROP POLICY IF EXISTS "Allow public update colors" ON colors;
DROP POLICY IF EXISTS "Allow public delete colors" ON colors;

DROP POLICY IF EXISTS "Allow public read rates" ON rates;
DROP POLICY IF EXISTS "Allow public insert rates" ON rates;
DROP POLICY IF EXISTS "Allow public update rates" ON rates;
DROP POLICY IF EXISTS "Allow public delete rates" ON rates;

DROP POLICY IF EXISTS "Allow public read entries" ON production_entries;
DROP POLICY IF EXISTS "Allow public insert entries" ON production_entries;
DROP POLICY IF EXISTS "Allow public update entries" ON production_entries;
DROP POLICY IF EXISTS "Allow public delete entries" ON production_entries;

DROP POLICY IF EXISTS "Allow public read profile" ON profile;
DROP POLICY IF EXISTS "Allow public insert profile" ON profile;
DROP POLICY IF EXISTS "Allow public update profile" ON profile;
DROP POLICY IF EXISTS "Allow public delete profile" ON profile;

DROP POLICY IF EXISTS "Allow public read income_periods" ON income_periods;
DROP POLICY IF EXISTS "Allow public insert income_periods" ON income_periods;
DROP POLICY IF EXISTS "Allow public update income_periods" ON income_periods;
DROP POLICY IF EXISTS "Allow public delete income_periods" ON income_periods;

-- 2. Add user_id column to tables representing user data
-- Standard saree colors can have NULL user_id so they are globally visible. Custom colors will have user_id = auth.uid()
ALTER TABLE colors ADD COLUMN IF NOT EXISTS user_id UUID DEFAULT auth.uid() REFERENCES auth.users(id);

-- User-specific tables
ALTER TABLE rates ADD COLUMN IF NOT EXISTS user_id UUID DEFAULT auth.uid() REFERENCES auth.users(id);
ALTER TABLE production_entries ADD COLUMN IF NOT EXISTS user_id UUID DEFAULT auth.uid() REFERENCES auth.users(id);
ALTER TABLE income_periods ADD COLUMN IF NOT EXISTS user_id UUID DEFAULT auth.uid() REFERENCES auth.users(id);

-- Recreate profile table to be user-scoped (primary key is user_id)
DROP TABLE IF EXISTS profile CASCADE;
CREATE TABLE profile (
    user_id UUID PRIMARY KEY DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    app_name TEXT NOT NULL DEFAULT 'FallTrack',
    manager_name TEXT NOT NULL DEFAULT 'Rajesh Kumar',
    manager_phone TEXT NOT NULL DEFAULT '9876543210',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- 3. Enable Row Level Security (RLS) for all tables
ALTER TABLE colors ENABLE ROW LEVEL SECURITY;
ALTER TABLE rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE income_periods ENABLE ROW LEVEL SECURITY;

-- 4. Create user-specific policies
-- Colors: Users can read standard global colors (user_id IS NULL) OR their own custom colors
CREATE POLICY "Allow read global or own colors" ON colors FOR SELECT USING (user_id IS NULL OR user_id = auth.uid());
CREATE POLICY "Allow insert own colors" ON colors FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Allow update own colors" ON colors FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Allow delete own colors" ON colors FOR DELETE USING (user_id = auth.uid());

-- Rates: Users can only access their own rate cards
CREATE POLICY "Allow read own rates" ON rates FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Allow insert own rates" ON rates FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Allow update own rates" ON rates FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Allow delete own rates" ON rates FOR DELETE USING (user_id = auth.uid());

-- Production Entries: Users can only access their own logs
CREATE POLICY "Allow read own entries" ON production_entries FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Allow insert own entries" ON production_entries FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Allow update own entries" ON production_entries FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Allow delete own entries" ON production_entries FOR DELETE USING (user_id = auth.uid());

-- Profile: Users can only access their own manager profile
CREATE POLICY "Allow read own profile" ON profile FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Allow insert own profile" ON profile FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Allow update own profile" ON profile FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Allow delete own profile" ON profile FOR DELETE USING (user_id = auth.uid());

-- Income Periods: Users can only access their own custom income periods
CREATE POLICY "Allow read own income_periods" ON income_periods FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Allow insert own income_periods" ON income_periods FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Allow update own income_periods" ON income_periods FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Allow delete own income_periods" ON income_periods FOR DELETE USING (user_id = auth.uid());
