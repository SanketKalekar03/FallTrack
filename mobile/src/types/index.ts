export interface Color {
  id: string;
  name: string;
  created_at?: string;
}

export interface ProductionEntry {
  id: string;
  entry_date: string;
  color_id: string;
  quantity: number;
  created_at?: string;
  // UI helper fields
  color?: Color;
}

export interface Rate {
  id: string;
  rate_per_dozen: number;
  effective_from: string;
  created_at?: string;
}

export interface DashboardStats {
  todayFalls: number;
  monthlyFalls: number;
  currentRate: number;
  estimatedMonthlyIncome: number;
  lastEntryDate: string | null;
  lastEntryFalls: number;
}

export interface ColorSummary {
  colorName: string;
  quantity: number;
}

export interface DailyReportData {
  date: string;
  totalFalls: number;
  colorSummary: ColorSummary[];
}

export interface MonthlyReportData {
  month: string; // YYYY-MM
  totalFalls: number;
  activeRate: number;
  estimatedIncome: number;
  colorSummary: ColorSummary[];
}

export interface YearlyReportData {
  year: number;
  totalFalls: number;
  totalIncome: number;
  averageMonthlyProduction: number;
  bestProductionMonth: string; // Month Name e.g. "October"
  bestProductionVolume: number;
  monthlyBreakdown: { month: string; falls: number; income: number }[];
}

export interface IncomePeriod {
  id: string;
  period_name: string;
  start_date: string;
  end_date: string;
  total_falls: number;
  total_income: number;
  created_at?: string;
}
