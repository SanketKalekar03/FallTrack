import { create } from 'zustand';
import type { DailyReportData, MonthlyReportData, YearlyReportData, ColorSummary } from '../types';
import { dbService } from '../services/dbService';
import { useRateStore } from './useRateStore';

interface ReportState {
  loading: boolean;
  error: string | null;
  getDailyReport: (dateStr: string) => Promise<DailyReportData>;
  getMonthlyReport: (monthStr: string) => Promise<MonthlyReportData>; // monthStr: YYYY-MM
  getYearlyReport: (yearVal: number) => Promise<YearlyReportData>;
}

export const useReportStore = create<ReportState>((set) => ({
  loading: false,
  error: null,

  getDailyReport: async (dateStr: string) => {
    set({ loading: true, error: null });
    try {
      // Fetch all entries for this specific date
      const entries = await dbService.getProductionEntries({
        startDate: dateStr,
        endDate: dateStr
      });

      const totalFalls = entries.reduce((acc, curr) => acc + curr.quantity, 0);

      // Group by color
      const colorMap: { [key: string]: number } = {};
      entries.forEach(entry => {
        const colorName = entry.color?.name || 'Unspecified';
        colorMap[colorName] = (colorMap[colorName] || 0) + entry.quantity;
      });

      const colorSummary: ColorSummary[] = Object.entries(colorMap).map(([colorName, quantity]) => ({
        colorName,
        quantity
      })).sort((a, b) => b.quantity - a.quantity);

      set({ loading: false });
      return {
        date: dateStr,
        totalFalls,
        colorSummary
      };
    } catch (err: any) {
      set({ error: err.message || 'Failed to generate daily report', loading: false });
      throw err;
    }
  },

  getMonthlyReport: async (monthStr: string) => {
    set({ loading: true, error: null });
    try {
      const entries = await dbService.getProductionEntries({ month: monthStr });
      const activeRateStore = useRateStore.getState();
      
      // Determine active rate for the end of that month (or latest entry)
      const [year, month] = monthStr.split('-');
      const lastDayDate = new Date(Number(year), Number(month), 0);
      const lastDayOfMonth = `${lastDayDate.getFullYear()}-${String(lastDayDate.getMonth() + 1).padStart(2, '0')}-${String(lastDayDate.getDate()).padStart(2, '0')}`;
      const activeRate = activeRateStore.getActiveRateForDate(lastDayOfMonth);

      const totalFalls = entries.reduce((acc, curr) => acc + curr.quantity, 0);

      // Group by color
      const colorMap: { [key: string]: number } = {};
      entries.forEach(entry => {
        const colorName = entry.color?.name || 'Unspecified';
        colorMap[colorName] = (colorMap[colorName] || 0) + entry.quantity;
      });

      const colorSummary: ColorSummary[] = Object.entries(colorMap).map(([colorName, quantity]) => ({
        colorName,
        quantity
      })).sort((a, b) => b.quantity - a.quantity);

      // Calculate income: (Total Falls / 12) * Rate
      // (Using dozen calculation, rounded to 2 decimal places)
      const estimatedIncome = Number(((totalFalls / 12) * activeRate).toFixed(2));

      set({ loading: false });
      return {
        month: monthStr,
        totalFalls,
        activeRate,
        estimatedIncome,
        colorSummary
      };
    } catch (err: any) {
      set({ error: err.message || 'Failed to generate monthly report', loading: false });
      throw err;
    }
  },

  getYearlyReport: async (yearVal: number) => {
    set({ loading: true, error: null });
    try {
      const yearStr = yearVal.toString();
      const entries = await dbService.getProductionEntries({ year: yearStr });
      const activeRateStore = useRateStore.getState();

      const totalFalls = entries.reduce((acc, curr) => acc + curr.quantity, 0);

      // Group entries by month (0-11)
      const monthlyDataMap: { [key: string]: { falls: number; income: number } } = {};
      
      // Initialize all 12 months
      for (let m = 1; m <= 12; m++) {
        const mStr = m.toString().padStart(2, '0');
        monthlyDataMap[`${yearStr}-${mStr}`] = { falls: 0, income: 0 };
      }

      // Populate monthly quantities and calculate income per entry's rate
      entries.forEach(entry => {
        const mStr = entry.entry_date.substring(0, 7); // YYYY-MM
        if (monthlyDataMap[mStr]) {
          monthlyDataMap[mStr].falls += entry.quantity;
          
          // Calculate income using active rate on that specific entry date
          const entryRate = activeRateStore.getActiveRateForDate(entry.entry_date);
          const entryIncome = (entry.quantity / 12) * entryRate;
          monthlyDataMap[mStr].income += entryIncome;
        }
      });

      let totalIncome = 0;
      const monthlyBreakdown = Object.entries(monthlyDataMap).map(([month, data]) => {
        const roundedIncome = Number(data.income.toFixed(2));
        totalIncome += roundedIncome;
        return {
          month, // YYYY-MM
          falls: data.falls,
          income: roundedIncome
        };
      });

      // Find average monthly production (exclude months with 0 production if desired, but standard is /12)
      const averageMonthlyProduction = Math.round(totalFalls / 12);

      // Find best production month
      let bestMonthKey = '';
      let bestVolume = 0;
      
      Object.entries(monthlyDataMap).forEach(([month, data]) => {
        if (data.falls > bestVolume) {
          bestVolume = data.falls;
          bestMonthKey = month;
        }
      });

      const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      
      let bestProductionMonth = 'None';
      if (bestMonthKey) {
        const mIdx = Number(bestMonthKey.split('-')[1]) - 1;
        bestProductionMonth = monthNames[mIdx];
      }

      set({ loading: false });
      return {
        year: yearVal,
        totalFalls,
        totalIncome: Number(totalIncome.toFixed(2)),
        averageMonthlyProduction,
        bestProductionMonth,
        bestProductionVolume: bestVolume,
        monthlyBreakdown
      };
    } catch (err: any) {
      set({ error: err.message || 'Failed to generate yearly report', loading: false });
      throw err;
    }
  }
}));
