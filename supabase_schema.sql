-- FallTrack Supabase SQL Database Schema
-- Run this in your Supabase SQL Editor to set up the tables and initial seed data.

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Colors Table (Normalized saree fall colors)
CREATE TABLE IF NOT EXISTS colors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Index for fast searches
CREATE INDEX IF NOT EXISTS idx_colors_name ON colors (name);

-- 2. Rates Table (Historical rate cards)
CREATE TABLE IF NOT EXISTS rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rate_per_dozen NUMERIC(10,2) NOT NULL CHECK (rate_per_dozen > 0),
    effective_from DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Index for checking latest active rate by date
CREATE INDEX IF NOT EXISTS idx_rates_effective ON rates (effective_from DESC);

-- 3. Production Entries Table (Daily bundle logs)
CREATE TABLE IF NOT EXISTS production_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_date DATE NOT NULL,
    color_id UUID NOT NULL REFERENCES colors(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Indexes for statistics and reports
CREATE INDEX IF NOT EXISTS idx_production_entries_date ON production_entries (entry_date);
CREATE INDEX IF NOT EXISTS idx_production_entries_color ON production_entries (color_id);

-- 4. Manager Profile & Settings Table (Single-row configuration)
CREATE TABLE IF NOT EXISTS profile (
    id BOOLEAN PRIMARY KEY DEFAULT TRUE, -- Enforces single row constraint
    app_name TEXT NOT NULL DEFAULT 'FallTrack',
    manager_name TEXT NOT NULL DEFAULT 'Rajesh Kumar',
    manager_phone TEXT NOT NULL DEFAULT '9876543210',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    CONSTRAINT single_profile CHECK (id = TRUE) -- Restricts to exactly one row
);

-- Enable Row Level Security (RLS) for all tables
ALTER TABLE colors ENABLE ROW LEVEL SECURITY;
ALTER TABLE rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile ENABLE ROW LEVEL SECURITY;

-- Public read/write policies for easy single-user operation
CREATE POLICY "Allow public read colors" ON colors FOR SELECT USING (true);
CREATE POLICY "Allow public insert colors" ON colors FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update colors" ON colors FOR UPDATE USING (true);
CREATE POLICY "Allow public delete colors" ON colors FOR DELETE USING (true);

CREATE POLICY "Allow public read rates" ON rates FOR SELECT USING (true);
CREATE POLICY "Allow public insert rates" ON rates FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update rates" ON rates FOR UPDATE USING (true);
CREATE POLICY "Allow public delete rates" ON rates FOR DELETE USING (true);

CREATE POLICY "Allow public read entries" ON production_entries FOR SELECT USING (true);
CREATE POLICY "Allow public insert entries" ON production_entries FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update entries" ON production_entries FOR UPDATE USING (true);
CREATE POLICY "Allow public delete entries" ON production_entries FOR DELETE USING (true);

CREATE POLICY "Allow public read profile" ON profile FOR SELECT USING (true);
CREATE POLICY "Allow public insert profile" ON profile FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update profile" ON profile FOR UPDATE USING (true);
CREATE POLICY "Allow public delete profile" ON profile FOR DELETE USING (true);

-- Seed Initial Marathi Colors
INSERT INTO colors (name) VALUES
('राणी'),       -- Rani (Deep Pink)
('लाल'),        -- Lal (Red)
('पांढरा'),      -- Pandhra (White)
('केशरी'),      -- Keshari (Orange)
('निळा'),       -- Nila (Blue)
('हिरवा'),      -- Hirva (Green)
('पिवळा'),      -- Pivla (Yellow)
('गुलाबी'),      -- Gulabi (Pink)
('काळा'),       -- Kala (Black)
('राजवाडी'),    -- Rajwadi
('मोरपंखी'),    -- Morpankhi
('जांभळा')      -- Jambhla (Purple)
ON CONFLICT (name) DO NOTHING;

-- Seed Default Rate Card (₹5.00 per dozen effective from Jan 1, 2026)
INSERT INTO rates (rate_per_dozen, effective_from) 
VALUES (5.00, '2026-01-01')
ON CONFLICT DO NOTHING;

-- Seed Default Manager Profile
INSERT INTO profile (app_name, manager_name, manager_phone)
VALUES ('FallTrack', 'Rajesh Kumar', '9876543210')
ON CONFLICT (id) DO NOTHING;

-- 5. Custom Income Periods Table (Billed/Finalized Cycles)
CREATE TABLE IF NOT EXISTS income_periods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period_name TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    total_falls INTEGER NOT NULL CHECK (total_falls >= 0),
    total_income NUMERIC(10,2) NOT NULL CHECK (total_income >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    CONSTRAINT date_range_check CHECK (end_date >= start_date)
);

-- Index for dates
CREATE INDEX IF NOT EXISTS idx_income_periods_dates ON income_periods (start_date, end_date);

-- Enable RLS
ALTER TABLE income_periods ENABLE ROW LEVEL SECURITY;

-- Public RLS Policies
CREATE POLICY "Allow public read income_periods" ON income_periods FOR SELECT USING (true);
CREATE POLICY "Allow public insert income_periods" ON income_periods FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update income_periods" ON income_periods FOR UPDATE USING (true);
CREATE POLICY "Allow public delete income_periods" ON income_periods FOR DELETE USING (true);
