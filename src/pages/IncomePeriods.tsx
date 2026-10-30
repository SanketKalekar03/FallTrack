import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  Coins, 
  Trash2, 
  Lock, 
  TrendingUp, 
  Sparkles, 
  CalendarDays,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { motion } from 'framer-motion';
import { dbService } from '../services/dbService';
import { useRateStore } from '../store/useRateStore';
import type { IncomePeriod, ProductionEntry } from '../types';
import { confirmDialog } from '../store/useConfirmStore';

// Helper to add 1 day to YYYY-MM-DD date string safely without timezone offsets
const addOneDay = (dateStr: string): string => {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const IncomePeriods: React.FC = () => {
  const { getActiveRateForDate, fetchRates } = useRateStore();

  const [periods, setPeriods] = useState<IncomePeriod[]>([]);
  const [entries, setEntries] = useState<ProductionEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [periodName, setPeriodName] = useState('');
  const [isStartDateLocked, setIsStartDateLocked] = useState(false);

  useEffect(() => {
    fetchRates();
    loadData();
  }, [fetchRates]);

  const loadData = async () => {
    setLoading(true);
    try {
      const fetchedPeriods = await dbService.getIncomePeriods();
      const sortedPeriods = fetchedPeriods.sort(
        (a, b) => b.end_date.localeCompare(a.end_date)
      );
      setPeriods(sortedPeriods);

      const allEntries = await dbService.getProductionEntries();
      setEntries(allEntries);

      // Determine next available start date
      if (sortedPeriods.length > 0) {
        const latestPeriod = sortedPeriods[0];
        const nextStart = addOneDay(latestPeriod.end_date);
        setStartDate(nextStart);
        setIsStartDateLocked(true);
        // Default end date to today or nextStart (whichever is later)
        const todayObj = new Date();
        const today = `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, '0')}-${String(todayObj.getDate()).padStart(2, '0')}`;
        setEndDate(nextStart > today ? nextStart : today);
      } else {
        // No periods finalized yet, let user pick start date
        setIsStartDateLocked(false);
        if (allEntries.length > 0) {
          // Default to the earliest production entry date
          const sortedEntries = [...allEntries].sort(
            (a, b) => a.entry_date.localeCompare(b.entry_date)
          );
          setStartDate(sortedEntries[0].entry_date);
          const todayObj = new Date();
          setEndDate(`${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, '0')}-${String(todayObj.getDate()).padStart(2, '0')}`);
        } else {
          const todayObj = new Date();
          const today = `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, '0')}-${String(todayObj.getDate()).padStart(2, '0')}`;
          setStartDate(today);
          setEndDate(today);
        }
      }
    } catch (err: any) {
      toast.error('Failed to load income cycle data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Generate default period name when dates change
  useEffect(() => {
    if (endDate) {
      const dateObj = new Date(endDate);
      const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      const monthName = monthNames[dateObj.getMonth()];
      const year = dateObj.getFullYear();
      setPeriodName(`${monthName} ${year}`);
    }
  }, [endDate]);

  // Live Calculations for selected range
  const filteredEntries = entries.filter(
    (e) => e.entry_date >= startDate && e.entry_date <= endDate
  );

  const totalFalls = filteredEntries.reduce((sum, e) => sum + e.quantity, 0);

  const totalIncome = filteredEntries.reduce((sum, e) => {
    const rate = getActiveRateForDate(e.entry_date);
    return sum + (e.quantity / 12) * rate;
  }, 0);

  const handleFinalize = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = periodName.trim();
    if (!name) {
      toast.error('Please enter a period name');
      return;
    }
    if (!startDate || !endDate) {
      toast.error('Please select both start and end dates');
      return;
    }
    if (endDate < startDate) {
      toast.error('End date cannot be earlier than start date');
      return;
    }

    // Verify there is no overlap with existing periods (double-safety client-side check)
    const isOverlap = periods.some(
      (p) =>
        (startDate >= p.start_date && startDate <= p.end_date) ||
        (endDate >= p.start_date && endDate <= p.end_date) ||
        (startDate <= p.start_date && endDate >= p.end_date)
    );

    if (isOverlap) {
      toast.error('Selected date range overlaps with an existing finalized period');
      return;
    }

    if (filteredEntries.length === 0) {
      const confirmed = await confirmDialog({
        title: "Finalize Empty Period",
        message: "There are no production logs in this date range. Do you still want to finalize this empty billing period?",
        confirmText: "Finalize Anyway",
        type: "warning"
      });
      if (!confirmed) return;
    }

    try {
      await dbService.createIncomePeriod({
        period_name: name,
        start_date: startDate,
        end_date: endDate,
        total_falls: totalFalls,
        total_income: Number(totalIncome.toFixed(2))
      });
      toast.success('Income period finalized successfully!');
      loadData();
    } catch (err: any) {
      toast.error('Failed to finalize period: ' + err.message);
    }
  };

  const handleDelete = async (id: string) => {
    const confirmed = await confirmDialog({
      title: "Rollback Income Period",
      message: "Are you sure you want to delete and rollback this billing period? The included dates and production logs will become editable again.",
      confirmText: "Rollback Period",
      type: "danger"
    });
    if (!confirmed) return;

    try {
      await dbService.deleteIncomePeriod(id);
      toast.success('Income period rolled back!');
      loadData();
    } catch (err: any) {
      toast.error('Failed to delete period: ' + err.message);
    }
  };

  // Check if a period is the latest (only the latest period can be deleted/rolled back)
  const isLatestPeriod = (index: number) => index === 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      {/* Left Panel: Finalize New Period (7 columns) */}
      <div className="lg:col-span-7 space-y-4">
        <div className="bg-white rounded-xl border border-slate-100 shadow-soft overflow-hidden">
          <div className="py-3 px-4 border-b border-slate-100 bg-slate-50/50">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Sparkles size={15} className="text-brand-primary animate-pulse" />
              Finalize Custom Billing Cycle
            </h3>
            <p className="text-[10px] text-brand-text-muted mt-0.5">Define a custom start and end date range to finalize piece-rate income payouts.</p>
          </div>

          {loading ? (
            <div className="p-8 text-center text-xs text-slate-400">Loading cycle details...</div>
          ) : (
            <form onSubmit={handleFinalize} className="p-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Start Date */}
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-extrabold text-slate-455 uppercase tracking-wider flex items-center gap-1">
                    Start Date 
                    {isStartDateLocked && <Lock size={10} className="text-slate-400" />}
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => !isStartDateLocked && setStartDate(e.target.value)}
                      disabled={isStartDateLocked}
                      className={`w-full px-3 py-1.5 pl-8 border rounded-lg text-xs font-semibold outline-none shadow-sm transition-all ${
                        isStartDateLocked
                          ? 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed'
                          : 'bg-white border-slate-200 focus:border-brand-primary focus:ring-3 focus:ring-brand-primary/10 text-slate-700'
                      }`}
                    />
                    <Calendar size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
                  </div>
                  {isStartDateLocked && (
                    <span className="text-[8px] text-brand-primary font-bold mt-0.5">
                      Locked to start the day after the previous cycle.
                    </span>
                  )}
                </div>

                {/* End Date */}
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-extrabold text-slate-455 uppercase tracking-wider">End Date</label>
                  <div className="relative">
                    <input
                      type="date"
                      value={endDate}
                      min={startDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full px-3 py-1.5 pl-8 bg-white border border-slate-200 focus:border-brand-primary focus:ring-3 focus:ring-brand-primary/10 rounded-lg text-xs font-semibold outline-none text-slate-700 shadow-sm transition-all"
                    />
                    <Calendar size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
                  </div>
                </div>
              </div>

              {/* Period Name */}
              <div className="flex flex-col gap-1">
                <label className="text-[9px] font-extrabold text-slate-455 uppercase tracking-wider">Period Name</label>
                <input
                  type="text"
                  placeholder="e.g. February 2026"
                  value={periodName}
                  onChange={(e) => setPeriodName(e.target.value)}
                  className="px-3 py-1.5 bg-white border border-slate-200 focus:border-brand-primary focus:ring-3 focus:ring-brand-primary/10 rounded-lg text-xs font-semibold outline-none text-slate-700 shadow-sm transition-all"
                />
              </div>

              {/* Live Preview / Calculations */}
              <div className="p-3.5 bg-brand-light-purple/20 border border-brand-primary/5 rounded-xl space-y-3.5">
                <h4 className="text-[10px] font-extrabold text-brand-primary uppercase tracking-wider flex items-center gap-1.5">
                  <TrendingUp size={12} /> Live Cycle Preview
                </h4>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-2.5 bg-white rounded-lg border border-slate-100 shadow-sm">
                    <span className="text-[8px] font-extrabold text-slate-400 uppercase tracking-wider block">Total Production</span>
                    <span className="text-sm font-extrabold text-slate-800 mt-0.5 block">{totalFalls.toLocaleString()} Falls</span>
                  </div>
                  <div className="p-2.5 bg-gradient-to-br from-brand-primary to-brand-accent rounded-lg text-white shadow-md shadow-brand-primary/15 border-0">
                    <span className="text-[8px] font-bold text-white/85 uppercase tracking-wider block">Income Payout</span>
                    <span className="text-sm font-extrabold text-white mt-0.5 block">Rs. {Math.round(totalIncome).toLocaleString()}</span>
                  </div>
                </div>

                {/* Entry Log Preview inside range */}
                <div className="border-t border-slate-100/50 pt-2.5">
                  <span className="text-[8px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1.5">Includes {filteredEntries.length} production logs:</span>
                  {filteredEntries.length === 0 ? (
                    <p className="text-[10px] text-slate-400 italic">No production entries logged in this date range.</p>
                  ) : (
                    <div className="max-h-[120px] overflow-y-auto space-y-1.5 pr-1">
                      {filteredEntries.map((e) => {
                        return (
                          <div key={e.id} className="flex justify-between items-center bg-white p-2 rounded-lg border border-slate-100/60 text-[10px]">
                            <span className="font-bold text-slate-650">{e.entry_date.split('-').reverse().join('-')} • {e.color?.name || 'Unspecified'}</span>
                            <span className="font-semibold text-slate-500">{e.quantity} Falls</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Submit Action */}
              <div className="flex justify-end pt-2">
                <motion.button
                  type="submit"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex items-center gap-1.5 px-5 py-2 bg-brand-primary hover:bg-brand-primary-hover text-white text-xs font-bold rounded-lg shadow-md shadow-brand-primary/15 transition-all cursor-pointer border-0"
                >
                  <CheckCircle2 size={12} /> Finalize & Lock Period
                </motion.button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Right Panel: Finalized Periods Ledger (5 columns) */}
      <div className="lg:col-span-5 space-y-4">
        <div className="bg-white rounded-xl border border-slate-100 shadow-soft overflow-hidden">
          <div className="py-3 px-4 border-b border-slate-100 bg-slate-50/50">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Coins size={15} className="text-brand-primary" />
              Finalized Cycles Ledger
            </h3>
            <p className="text-[10px] text-brand-text-muted mt-0.5">Chronological record of locked billing periods.</p>
          </div>

          <div className="p-4 space-y-3 max-h-[420px] overflow-y-auto">
            {periods.length === 0 ? (
              <div className="text-center py-12">
                <CalendarDays size={28} className="text-slate-300 mx-auto stroke-[1.5]" />
                <p className="text-xs text-slate-400 font-medium mt-3">No billing periods finalized yet.</p>
                <p className="text-[9px] text-slate-400 mt-0.5">Fill out the range editor to lock your first cycle.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {periods.map((period, index) => {
                  const isLatest = isLatestPeriod(index);

                  return (
                    <motion.div
                      key={period.id}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-3 bg-slate-50/30 border border-slate-100 rounded-xl space-y-2 relative group"
                    >
                      {/* Period Header */}
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <h4 className="text-xs font-extrabold text-slate-800">{period.period_name}</h4>
                          <span className="text-[9px] text-brand-primary font-semibold block mt-0.5">
                            {new Date(period.start_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} - {new Date(period.end_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                        </div>

                        {isLatest ? (
                          <button
                            onClick={() => handleDelete(period.id)}
                            className="p-1.5 text-slate-400 hover:text-red-650 hover:bg-red-50 hover:border-red-100 border border-transparent rounded-lg transition-all cursor-pointer shrink-0"
                            title="Rollback latest period"
                          >
                            <Trash2 size={13} />
                          </button>
                        ) : (
                          <div className="p-1 text-slate-300" title="Only the latest period can be rolled back to maintain date continuity.">
                            <Lock size={12} />
                          </div>
                        )}
                      </div>

                      {/* Period Stats Summary */}
                      <div className="grid grid-cols-2 gap-2 text-[10px] pt-1.5 border-t border-slate-100/60">
                        <div>
                          <span className="text-slate-400 block text-[8px] uppercase font-bold">Total Falls</span>
                          <span className="font-bold text-slate-700">{period.total_falls.toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[8px] uppercase font-bold">Total Payout</span>
                          <span className="font-extrabold text-brand-primary">Rs. {Math.round(period.total_income).toLocaleString()}</span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Informative Tip Card */}
        <div className="bg-white p-3 rounded-xl border border-slate-150 shadow-sm flex gap-3">
          <div className="p-1.5 bg-amber-50 rounded-lg text-amber-600 border border-amber-100 shrink-0 h-fit">
            <AlertCircle size={14} />
          </div>
          <div>
            <h5 className="text-[11px] font-bold text-slate-800">Date Lock System</h5>
            <p className="text-[9px] text-slate-455 mt-1 leading-relaxed">
              Once an income period is finalized, the calendar is locked so that the next period must start immediately after. 
              Only the **latest finalized period** can be deleted (rolled back) to ensure chronological database integrity.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
export default IncomePeriods;
