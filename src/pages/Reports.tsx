import React, { useEffect, useState } from 'react';
import { Calendar, BarChart3, TrendingUp, IndianRupee, Download, Printer } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { motion } from 'framer-motion';
import { useReportStore } from '../store/useReportStore';
import { useRateStore } from '../store/useRateStore';
import { dbService } from '../services/dbService';
import { exportEntriesToCSV } from '../utils/csvExport';
import { exportEntriesToPDF } from '../utils/pdfExport';
import type { DailyReportData, MonthlyReportData, YearlyReportData } from '../types';

export const Reports: React.FC = () => {
  const { getDailyReport, getMonthlyReport, getYearlyReport, loading } = useReportStore();
  const { getActiveRateForDate, fetchRates } = useRateStore();

  const [activeTab, setActiveTab] = useState<'daily' | 'monthly' | 'yearly'>('daily');

  // Input states
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });

  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  // Report results states
  const [dailyData, setDailyData] = useState<DailyReportData | null>(null);
  const [monthlyData, setMonthlyData] = useState<MonthlyReportData | null>(null);
  const [yearlyData, setYearlyData] = useState<YearlyReportData | null>(null);

  useEffect(() => {
    fetchRates();
  }, [fetchRates]);

  // Load daily data
  const loadDailyReport = async (date: string) => {
    try {
      const data = await getDailyReport(date);
      setDailyData(data);
    } catch (e) {
      toast.error("Failed to load daily report.");
    }
  };

  // Load monthly data
  const loadMonthlyReport = async (month: string) => {
    try {
      const data = await getMonthlyReport(month);
      setMonthlyData(data);
    } catch (e) {
      toast.error("Failed to load monthly report.");
    }
  };

  // Load yearly data
  const loadYearlyReport = async (year: number) => {
    try {
      const data = await getYearlyReport(year);
      setYearlyData(data);
    } catch (e) {
      toast.error("Failed to load yearly report.");
    }
  };

  // Trigger loads on inputs change
  useEffect(() => {
    if (activeTab === 'daily') {
      loadDailyReport(selectedDate);
    } else if (activeTab === 'monthly') {
      loadMonthlyReport(selectedMonth);
    } else if (activeTab === 'yearly') {
      loadYearlyReport(selectedYear);
    }
  }, [activeTab, selectedDate, selectedMonth, selectedYear]);

  // Exports logic
  const handleExportCSV = async () => {
    try {
      let entries: any[] = [];
      if (activeTab === 'daily') {
        entries = await dbService.getProductionEntries({ startDate: selectedDate, endDate: selectedDate });
      } else if (activeTab === 'monthly') {
        entries = await dbService.getProductionEntries({ month: selectedMonth });
      } else if (activeTab === 'yearly') {
        entries = await dbService.getProductionEntries({ year: selectedYear.toString() });
      }

      if (entries.length === 0) {
        toast.error("No data to export.");
        return;
      }
      exportEntriesToCSV(entries, getActiveRateForDate);
      toast.success("CSV exported!");
    } catch (e) {
      toast.error("Failed to export data.");
    }
  };

  const handleExportPDF = async () => {
    try {
      let entries: any[] = [];
      let title = '';
      if (activeTab === 'daily') {
        entries = await dbService.getProductionEntries({ startDate: selectedDate, endDate: selectedDate });
        title = `Daily Report - ${new Date(selectedDate).toLocaleDateString('en-IN')}`;
      } else if (activeTab === 'monthly') {
        entries = await dbService.getProductionEntries({ month: selectedMonth });
        const [y, m] = selectedMonth.split('-');
        const monthName = new Date(Number(y), Number(m) - 1).toLocaleString('default', { month: 'long' });
        title = `Monthly Report - ${monthName} ${y}`;
      } else if (activeTab === 'yearly') {
        entries = await dbService.getProductionEntries({ year: selectedYear.toString() });
        title = `Yearly Report - Year ${selectedYear}`;
      }

      if (entries.length === 0) {
        toast.error("No data to export.");
        return;
      }
      exportEntriesToPDF(entries, getActiveRateForDate, title);
      toast.success("PDF exported!");
    } catch (e) {
      toast.error("Failed to export report.");
    }
  };

  const yearsList = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  return (
    <div className="space-y-4">
      {/* Reports Nav bar and controls */}
      <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-100 shadow-soft flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        {/* Navigation Tabs */}
        <div className="bg-slate-100/60 p-1 rounded-xl flex gap-1 border border-slate-150/40 shadow-inner relative z-0">
          {(['daily', 'monthly', 'yearly'] as const).map((tab) => {
            const isActive = activeTab === tab;
            const label = tab === 'daily' ? 'Daily Report' : tab === 'monthly' ? 'Monthly Report' : 'Yearly Report';
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg relative transition-colors duration-250 cursor-pointer ${
                  isActive ? 'text-white' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeReportTab"
                    className="absolute inset-0 bg-brand-primary shadow-md shadow-brand-primary/20 z-0"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    style={{ borderRadius: 8 }}
                  />
                )}
                <span className="relative z-10">{label}</span>
              </button>
            );
          })}
        </div>

        {/* Global Export Buttons */}
        <div className="flex gap-2 w-full md:w-auto">
          <button
            onClick={handleExportCSV}
            className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 text-xs font-bold rounded-lg shadow-sm transition-all duration-200 cursor-pointer"
          >
            <Download size={13} className="text-slate-450" /> Export CSV
          </button>
          
          <button
            onClick={handleExportPDF}
            className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 text-xs font-bold rounded-lg shadow-sm transition-all duration-200 cursor-pointer"
          >
            <Printer size={13} className="text-slate-450" /> Export PDF
          </button>
        </div>
      </div>

      {/* Date Selectors Card */}
      <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-100 shadow-soft">
        {activeTab === 'daily' && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex flex-col gap-1 w-full sm:w-64">
              <label className="text-[9px] font-extrabold text-slate-450 uppercase tracking-wider">Selected Date</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-1.5 bg-white border border-slate-200 focus:border-brand-primary focus:ring-3 focus:ring-brand-primary/10 rounded-lg text-xs font-semibold outline-none text-slate-755 shadow-sm transition-all"
              />
            </div>
            <p className="text-xs text-brand-text-muted mt-5 font-semibold">
              Displaying data for date: {new Date(selectedDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
            </p>
          </div>
        )}

        {activeTab === 'monthly' && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex flex-col gap-1 w-full sm:w-64">
              <label className="text-[9px] font-extrabold text-slate-455 uppercase tracking-wider">Selected Month</label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="px-3 py-1.5 bg-white border border-slate-200 focus:border-brand-primary focus:ring-3 focus:ring-brand-primary/10 rounded-lg text-xs font-semibold outline-none text-slate-755 shadow-sm transition-all"
              />
            </div>
            <p className="text-xs text-brand-text-muted mt-5 font-semibold">
              Displaying data for month: {new Date(Number(selectedMonth.split('-')[0]), Number(selectedMonth.split('-')[1]) - 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
            </p>
          </div>
        )}

        {activeTab === 'yearly' && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex flex-col gap-1 w-full sm:w-64">
              <label className="text-[9px] font-extrabold text-slate-455 uppercase tracking-wider">Selected Year</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="px-3 py-1.5 bg-white border border-slate-200 focus:border-brand-primary focus:ring-3 focus:ring-brand-primary/10 rounded-lg text-xs font-semibold outline-none text-slate-755 shadow-sm transition-all"
              >
                {yearsList.map(y => (
                  <option key={y} value={y}>Year {y}</option>
                ))}
              </select>
            </div>
            <p className="text-xs text-brand-text-muted mt-5 font-semibold">
              Displaying summary of year: {selectedYear}
            </p>
          </div>
        )}
      </div>

      {/* Report Dashboard Cards */}
      {loading ? (
        <div className="bg-white p-16 rounded-2xl border border-slate-100 shadow-soft text-center text-xs text-slate-400 font-medium">
          Compiling report metrics...
        </div>
      ) : (
        <>
          {activeTab === 'daily' && dailyData && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Stats card */}
              <motion.div 
                whileHover={{ y: -4 }}
                className="bg-gradient-to-br from-brand-primary to-brand-accent p-4 rounded-xl text-white shadow-lg shadow-brand-primary/15 flex flex-col justify-center relative overflow-hidden group border-0"
              >
                <div className="absolute -right-6 -bottom-6 w-20 h-20 rounded-full bg-white/10 group-hover:scale-110 transition-transform duration-300 pointer-events-none" />
                <div className="p-1.5 bg-white/15 rounded-lg w-fit text-white shadow-inner">
                  <TrendingUp size={16} />
                </div>
                <h4 className="text-[9px] font-bold text-white/80 uppercase tracking-wider mt-3.5">Total Falls Submitted</h4>
                <p className="text-2xl font-extrabold text-white tracking-tight mt-1">
                  {dailyData.totalFalls.toLocaleString()} <span className="text-xs font-semibold text-white/80">Falls</span>
                </p>
              </motion.div>

              {/* Color Summary breakdown */}
              <div className="lg:col-span-2 bg-white p-4 rounded-xl border border-slate-100 shadow-soft">
                <h4 className="text-xs font-extrabold text-slate-450 uppercase tracking-wider mb-3">Color Breakdown</h4>
                {dailyData.colorSummary.length === 0 ? (
                  <p className="text-xs text-slate-400 font-medium py-6 text-center">No fall entries recorded for this date.</p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {dailyData.colorSummary.map((c, i) => (
                      <div key={i} className="py-2.5 flex items-center justify-between hover:bg-slate-50/20 transition-colors duration-150">
                        <span className="text-xs font-bold text-slate-700">{c.colorName}</span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-extrabold bg-brand-light-purple/60 border border-brand-primary/10 text-brand-primary">
                          {c.quantity.toLocaleString()} Falls
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'monthly' && monthlyData && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              {/* Summary Stats Cards */}
              <div className="flex flex-col gap-3">
                {/* Monthly Falls */}
                <motion.div 
                  whileHover={{ y: -3 }}
                  className="bg-gradient-to-br from-brand-primary to-brand-accent p-4 rounded-xl text-white shadow-lg shadow-brand-primary/10 relative overflow-hidden group border-0"
                >
                  <div className="absolute -right-6 -bottom-6 w-20 h-20 bg-white/10 rounded-full" />
                  <div className="p-1.5 bg-white/15 rounded-lg w-fit text-white shadow-inner">
                    <Calendar size={15} />
                  </div>
                  <h4 className="text-[9px] font-bold text-white/80 uppercase tracking-wider mt-3">Total Falls</h4>
                  <p className="text-2xl font-extrabold text-white tracking-tight mt-0.5">
                    {monthlyData.totalFalls.toLocaleString()} <span className="text-xs font-semibold text-white/80">Falls</span>
                  </p>
                </motion.div>

                {/* Active Rate */}
                <motion.div 
                  whileHover={{ y: -3 }}
                  className="bg-gradient-to-br from-brand-light-purple to-[#EBE5FF] p-4 rounded-xl text-brand-primary shadow-soft border border-brand-primary/10 relative overflow-hidden group"
                >
                  <div className="absolute top-0 right-0 w-28 h-28 bg-brand-primary/5 rounded-bl-full pointer-events-none" />
                  <div className="p-1.5 bg-brand-primary/10 rounded-lg w-fit text-brand-primary shadow-inner">
                    <IndianRupee size={15} />
                  </div>
                  <h4 className="text-[9px] font-bold text-brand-primary/80 uppercase tracking-wider mt-3">Rate Per Dozen</h4>
                  <p className="text-2xl font-extrabold text-brand-primary tracking-tight mt-0.5">
                    Rs. {monthlyData.activeRate.toFixed(2)}
                  </p>
                </motion.div>

                {/* Income Card */}
                <motion.div 
                  whileHover={{ y: -3 }}
                  className="bg-gradient-to-br from-brand-primary to-brand-accent text-white p-4 rounded-xl shadow-lg shadow-brand-primary/15 relative overflow-hidden group border-0"
                >
                  <div className="absolute -right-6 -bottom-6 w-20 h-20 bg-white/10 rounded-full" />
                  <div className="p-1.5 bg-white/15 rounded-lg w-fit text-white shadow-inner">
                    <BarChart3 size={15} />
                  </div>
                  <h4 className="text-[9px] font-bold text-white/80 uppercase tracking-wider mt-3">Estimated Income</h4>
                  <p className="text-2xl font-extrabold text-white tracking-tight mt-0.5">
                    Rs. {Math.round(monthlyData.estimatedIncome).toLocaleString()}
                  </p>
                </motion.div>
              </div>

              {/* Color breakdown */}
              <div className="lg:col-span-2 bg-white p-4 rounded-xl border border-slate-100 shadow-soft">
                <h4 className="text-xs font-extrabold text-slate-455 uppercase tracking-wider mb-3">Color Breakdown</h4>
                {monthlyData.colorSummary.length === 0 ? (
                  <p className="text-xs text-slate-400 font-medium py-6 text-center">No fall entries recorded for this month.</p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {monthlyData.colorSummary.map((c, i) => (
                      <div key={i} className="py-3 flex items-center justify-between hover:bg-slate-50/20 transition-colors duration-150">
                        <div>
                          <span className="text-xs font-bold text-slate-700 block">{c.colorName}</span>
                          <span className="text-[9px] text-slate-400 font-semibold mt-0.5 block">Dozen equivalent: {(c.quantity / 12).toFixed(1)} dozen</span>
                        </div>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-[10px] font-extrabold bg-brand-light-purple/60 border border-brand-primary/10 text-brand-primary">
                          {c.quantity.toLocaleString()} Falls
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'yearly' && yearlyData && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              {/* Year stats grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
                {/* Total Year Production */}
                <motion.div 
                  whileHover={{ y: -3 }}
                  className="bg-gradient-to-br from-brand-primary to-brand-accent p-4 rounded-xl text-white shadow-lg shadow-brand-primary/10 border-0"
                >
                  <span className="text-[9px] font-bold text-white/80 uppercase tracking-wider block">Total Year Production</span>
                  <p className="text-2xl font-extrabold text-white mt-0.5">{yearlyData.totalFalls.toLocaleString()} <span className="text-xs font-semibold text-white/80">Falls</span></p>
                </motion.div>

                {/* Total Year Income */}
                <motion.div 
                  whileHover={{ y: -3 }}
                  className="bg-gradient-to-br from-brand-primary to-brand-accent p-4 rounded-xl text-white shadow-lg shadow-brand-primary/15 border-0"
                >
                  <span className="text-[9px] font-bold text-white/80 uppercase tracking-wider block">Total Year Income</span>
                  <p className="text-2xl font-extrabold text-white mt-0.5">Rs. {Math.round(yearlyData.totalIncome).toLocaleString()}</p>
                </motion.div>

                {/* Avg Monthly Production */}
                <motion.div 
                  whileHover={{ y: -3 }}
                  className="bg-white p-4 rounded-xl border border-slate-100 shadow-soft"
                >
                  <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block">Avg Monthly Production</span>
                  <p className="text-lg font-bold text-slate-800 mt-0.5">{yearlyData.averageMonthlyProduction.toLocaleString()} <span className="text-xs font-semibold text-slate-400">Falls / Month</span></p>
                </motion.div>

                {/* Best Month */}
                <motion.div 
                  whileHover={{ y: -3 }}
                  className="bg-emerald-50/30 p-4 rounded-xl border border-emerald-100 shadow-soft"
                >
                  <span className="text-[9px] font-extrabold text-emerald-600 uppercase tracking-wider block">Best Production Month</span>
                  <p className="text-lg font-bold text-slate-800 mt-0.5">{yearlyData.bestProductionMonth}</p>
                  <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Volume: {yearlyData.bestProductionVolume.toLocaleString()} Falls</p>
                </motion.div>
              </div>

              {/* Monthly breakdown */}
              <div className="lg:col-span-2 bg-white p-4 rounded-xl border border-slate-100 shadow-soft">
                <h4 className="text-xs font-extrabold text-slate-455 uppercase tracking-wider mb-3">Monthly Breakdown ({selectedYear})</h4>
                <div className="divide-y divide-slate-100">
                  {yearlyData.monthlyBreakdown.map((row, i) => {
                    const date = new Date(selectedYear, i, 1);
                    const monthName = date.toLocaleString('default', { month: 'long' });
                    return (
                      <div key={i} className="py-3 flex items-center justify-between hover:bg-slate-50/20 transition-colors duration-150">
                        <div>
                          <span className="text-xs font-bold text-slate-800 block">{monthName}</span>
                          <span className="text-[9px] text-slate-400 font-semibold mt-0.5 block">Quantity: {row.falls.toLocaleString()} Falls</span>
                        </div>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-[10px] font-extrabold bg-emerald-50 border border-emerald-100 text-emerald-600">
                          ₹{Math.round(row.income).toLocaleString()} Earned
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
export default Reports;
