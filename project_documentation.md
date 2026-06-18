# FallTrack Project Documentation & Development Summary

This document serves as the complete developer guide and overview for the **FallTrack** Saree Fall Production & Income Management System. It summarizes all features, architectural designs, database schemas, and visual layout implementations built to date.

---

## 📖 Project Overview

**FallTrack** is a lightweight, responsive manager portal built for Sanket Kalekar to track saree fall production metrics, manage color catalog inputs, calculate automated piece-rate payments, and print high-quality reports. It supports offline-first operations (with `localStorage` fallbacks) and can synchronize with a Supabase cloud database.

---

## 🛠️ Key Features Implemented

### 1. Phonetic Devanagari Search & Matching
- **Transliteration Engine ([transliterate.ts](file:///d:/FallTrack/src/utils/transliterate.ts)):** Real-time conversion of Marathi (Devanagari) characters into standard English phonetic spellings (e.g. `केशरी` matches `keshari`, `kesri`, `kesari`).
- **Phonetic Select Dropdown ([MarathiColorSelect.tsx](file:///d:/FallTrack/src/components/MarathiColorSelect.tsx)):** A custom input component supporting keyboard navigation (arrows, Enter), phonetic search, and inline color creation directly inside entry rows.
- **Duplicate Prevention:** Case-insensitive phonetic validation blocks matching duplicate names (e.g. prevents adding `keshari` if `केशरी` exists).

### 2. Spacing-Optimized Daily Entry
- **Quantity Focus:** Removed all arbitrary quantity presets (`+50`, `+100`, etc.) to declutter the workspace.
- **Vertical Spacing:** Compact layout allows many rows to be viewed simultaneously.
- **Draft Persistence:** Local draft auto-saves entries in real time to prevent loss on reload.
- **Speed entry:** Pressing `ENTER` in the quantity input automatically creates and focuses the next entry row.

### 3. Rate Management
- **Audit Trails ([RateManagement.tsx](file:///d:/FallTrack/src/pages/RateManagement.tsx)):** Log of rate updates with custom effective dates.
- **Active Rate Resolver:** Automatically calculates the rate per dozen active on any historical production date.

### 4. Color Catalog & Deletion Safety
- **Log Counters:** Displays active counts of saved production entries under each color.
- **Safety Blocks:** Deletion is blocked for colors in use, preventing database reference orphans.

### 5. Settings, Validation & Cleanups
- **Indian Mobile Validation:** The email field was completely removed. Profile changes now require a 10-digit mobile number starting with `6-9` (validated using `/^[6-9]\d{9}$/`).
- **Data Portability:** Local backups can be downloaded as JSON files and restored at any time.

### 6. High-Contrast PDF Reports
- **Deep Indigo Theme:** High-contrast header designs featuring white text on purple panels.
- **Consolidated Layout:** Dates are grouped and printed once, rates are isolated, and the `Income` column is replaced with a single consolidated `Total Income: Rs. X` summary at the bottom of the table.
- **Marathi Font Compatibility:** Canvas rendering technique draws Marathi words to high-DPI images before embedding them, resolving PDF character corruption bugs.

---

## 📂 File Directory Map

- **Root Configurations:**
  - [index.html](file:///d:/FallTrack/index.html) - Main entry document.
  - [package.json](file:///d:/FallTrack/package.json) - Application dependencies (Vite, TypeScript, TailwindCSS v4, Zustand, Framer Motion, jsPDF).
  - [supabase_schema.sql](file:///d:/FallTrack/supabase_schema.sql) - Database tables definitions.
- **Source Code (`src/`):**
  - [index.css](file:///d:/FallTrack/src/index.css) - Global theme typography, scrollbars, print rules, and Tailwind variables.
  - [App.tsx](file:///d:/FallTrack/src/App.tsx) - Core router switcher and global profile state mappings.
- **UI Components (`src/components/`):**
  - [Layout.tsx](file:///d:/FallTrack/src/components/Layout.tsx) - Mobile navigation drawer and desktop sidebar with active sliding indicators.
  - [MarathiColorSelect.tsx](file:///d:/FallTrack/src/components/MarathiColorSelect.tsx) - Dynamic search select dropdown.
- **Pages (`src/pages/`):**
  - [Dashboard.tsx](file:///d:/FallTrack/src/pages/Dashboard.tsx) - Stats overview, shortcut actions, and Recharts trend visualizations.
  - [DailyEntry.tsx](file:///d:/FallTrack/src/pages/DailyEntry.tsx) - Daily bundle logs creator.
  - [DailyRecords.tsx](file:///d:/FallTrack/src/pages/DailyRecords.tsx) - History search filters, edit modal, pagination, and data export.
  - [Reports.tsx](file:///d:/FallTrack/src/pages/Reports.tsx) - Daily/Monthly/Yearly earnings metrics.
  - [RateManagement.tsx](file:///d:/FallTrack/src/pages/RateManagement.tsx) - Piece-rate audit tables.
  - [ColorManagement.tsx](file:///d:/FallTrack/src/pages/ColorManagement.tsx) - Color grid and modification controls.
  - [Settings.tsx](file:///d:/FallTrack/src/pages/Settings.tsx) - App renaming, profile settings, and database backup uploads.
- **Services & Stores (`src/services/` & `src/store/`):**
  - [dbService.ts](file:///d:/FallTrack/src/services/dbService.ts) - Supabase API calls and LocalStorage backup fallbacks.
  - State Stores (`useProductionStore.ts`, `useColorStore.ts`, `useRateStore.ts`, `useReportStore.ts`).
- **Utilities (`src/utils/`):**
  - [transliterate.ts](file:///d:/FallTrack/src/utils/transliterate.ts) - Phonetic translator.
  - [pdfExport.ts](file:///d:/FallTrack/src/utils/pdfExport.ts) - jsPDF table builder.
  - [csvExport.ts](file:///d:/FallTrack/src/utils/csvExport.ts) - CSV text builder.

---

## 🗄️ Database Schema

Three main tables are defined:

```sql
-- Saree Fall Colors
CREATE TABLE colors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Piece-Rates
CREATE TABLE rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_per_dozen NUMERIC(10,2) NOT NULL,
  effective_from DATE NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Production Logs
CREATE TABLE production_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_date DATE NOT NULL,
  color_id UUID REFERENCES colors(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity >= 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
```

---

## 🎨 Visual & Motion Highlights

1. **Brand Colors:** Deep Purple (`#5C3EA3`), Bright Violet (`#8B5CF6`), and Light Lavender (`#F3EFFF`).
2. **Tab Sliding Indicators:** Sidebar selectors and report tab switchers use Framer Motion `layoutId` to slide background pills fluidly when tab selections change.
3. **Animated Modals:** Zoom-in popup animations and backdrop fade effects.
4. **Staggered Lists:** Staggered load delays for color catalogs and record grids.
