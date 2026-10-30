import React, { useEffect, useState } from 'react';
import { 
  TrendingUp, 
  Calendar, 
  IndianRupee, 
  ChevronRight, 
  PenSquare,
  Sparkles
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useProductionStore } from '../store/useProductionStore';
import { useRateStore } from '../store/useRateStore';
import { DashboardChart } from '../components/DashboardChart';
import { dbService } from '../services/dbService';
import type { IncomePeriod } from '../types';

interface DashboardProps {
  onNavigate: (tabId: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { entries, fetchEntries } = useProductionStore();
  const { fetchRates, getActiveRateForDate } = useRateStore();
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [periods, setPeriods] = useState<IncomePeriod[]>([]);

  useEffect(() => {
    fetchEntries();
    fetchRates();
    dbService.getIncomePeriods().then(setPeriods).catch(console.warn);
  }, [fetchEntries, fetchRates]);

  const getLocalDateString = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const todayStr = getLocalDateString();

  const todayEntries = entries.filter(e => e.entry_date === todayStr);
  const todayFalls = todayEntries.reduce((sum, e) => sum + e.quantity, 0);

  // Calculate the active cycle start date
  const getActiveCycleStartDate = () => {
    if (periods.length > 0) {
      const sorted = [...periods].sort((a, b) => b.end_date.localeCompare(a.end_date));
      const latest = sorted[0];
      const [year, month, day] = latest.end_date.split('-').map(Number);
      const d = new Date(year, month - 1, day);
      d.setDate(d.getDate() + 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    } else if (entries.length > 0) {
      const sorted = [...entries].sort((a, b) => a.entry_date.localeCompare(b.entry_date));
      return sorted[0].entry_date;
    } else {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
  };

  const cycleStartDate = getActiveCycleStartDate();

  // Filter entries in active cycle (from cycleStartDate to today)
  const cycleEntries = entries.filter(e => e.entry_date >= cycleStartDate);
  const cycleFalls = cycleEntries.reduce((sum, e) => sum + e.quantity, 0);

  const currentRate = getActiveRateForDate(todayStr);

  const estimatedIncome = (cycleFalls / 12) * currentRate;

  const sortedByDate = [...entries].sort((a, b) => b.entry_date.localeCompare(a.entry_date));
  const lastEntryDate = sortedByDate.length > 0 ? sortedByDate[0].entry_date : null;
  const lastEntryFalls = lastEntryDate 
    ? entries.filter(e => e.entry_date === lastEntryDate).reduce((sum, e) => sum + e.quantity, 0)
    : 0;

  const formatLastEntryDate = (dateStr: string | null) => {
    if (!dateStr) return 'No entries yet';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const chartData = Array.from({ length: 12 }, (_, i) => {
    const monthIndex = i + 1;
    const monthPrefix = `${selectedYear}-${String(monthIndex).padStart(2, '0')}`;
    const monthFalls = entries
      .filter(e => e.entry_date.startsWith(monthPrefix))
      .reduce((sum, e) => sum + e.quantity, 0);

    const monthAbbrs = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    return {
      month: monthAbbrs[i],
      monthName: monthNames[i],
      Falls: monthFalls
    };
  });

  const yearsList = Array.from(
    new Set([
      new Date().getFullYear(),
      ...entries.map(e => new Date(e.entry_date).getFullYear())
    ])
  ).sort((a, b) => b - a);

  const stats = [
    {
      title: "Today's Falls",
      value: todayFalls.toLocaleString(),
      label: "Falls",
      icon: Sparkles,
      iconBg: "bg-sky-50 border border-sky-100/80 text-sky-600",
      accentGlow: "from-sky-500/10 to-transparent",
      badge: todayFalls > 0 
        ? { text: "Active Today", type: "success" } 
        : { text: "No logs today", type: "neutral" }
    },
    {
      title: "Cycle Production",
      value: cycleFalls.toLocaleString(),
      label: "Falls",
      icon: Calendar,
      iconBg: "bg-amber-50 border border-amber-100/80 text-amber-600",
      accentGlow: "from-amber-500/10 to-transparent",
      badge: { text: "Active Cycle", type: "amber" }
    },
    {
      title: "Current Rate",
      value: `Rs. ${currentRate.toFixed(2)}`,
      label: "/ Dozen",
      icon: IndianRupee,
      iconBg: "bg-emerald-50 border border-emerald-100/80 text-emerald-600",
      accentGlow: "from-emerald-500/10 to-transparent",
      badge: { text: "Standard", type: "emerald" }
    },
    {
      title: "Est. Cycle Income",
      value: `Rs. ${Math.round(estimatedIncome).toLocaleString()}`,
      label: "",
      icon: TrendingUp,
      iconBg: "bg-sky-50 border border-sky-100/80 text-brand-primary",
      accentGlow: "from-sky-500/10 to-transparent",
      badge: { text: "Current Cycle", type: "sky" }
    }
  ];

  // Framer Motion Variants
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.06
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    show: { 
      opacity: 1, 
      y: 0, 
      transition: { 
        type: 'spring' as const, 
        stiffness: 110, 
        damping: 15 
      } 
    }
  };

  const gridVariants = {
    hidden: { opacity: 0, y: 25 },
    show: { 
      opacity: 1, 
      y: 0, 
      transition: { 
        delay: 0.15,
        type: 'spring' as const,
        stiffness: 90,
        damping: 14
      } 
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-between gap-2.5 sm:gap-3.5 h-full min-h-0">
      {/* Stats Cards Section */}
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 shrink-0"
      >
        {stats.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <motion.div 
              key={idx}
              variants={itemVariants}
              whileHover={{ 
                y: -3, 
                boxShadow: "0 10px 25px -4px rgba(2, 132, 199, 0.1), 0 4px 12px -2px rgba(2, 132, 199, 0.05)"
              }}
              whileTap={{ scale: 0.985 }}
              className="bg-white px-3.5 py-2.5 sm:px-4 sm:py-3 rounded-xl border border-slate-200/80 shadow-[0_2px_10px_-2px_rgba(2,132,199,0.05)] transition-all duration-300 relative overflow-hidden group flex flex-col justify-between"
            >
              {/* Subtle ambient corner gradient on hover */}
              <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl ${stat.accentGlow} rounded-bl-full pointer-events-none transition-opacity duration-300 opacity-60 group-hover:opacity-100`} />

              {/* Top Row: Title + Icon Badge */}
              <div className="flex items-center justify-between z-1 relative">
                <span className="text-[10px] sm:text-[10.5px] font-bold text-slate-500 uppercase tracking-wider">
                  {stat.title}
                </span>
                <div className={`w-7.5 h-7.5 rounded-lg ${stat.iconBg} flex items-center justify-center shrink-0 shadow-2xs transition-transform duration-300 group-hover:scale-105`}>
                  <Icon size={14} />
                </div>
              </div>

              {/* Middle Row: Hero Number */}
              <div className="my-1 z-1 relative">
                <div className="flex items-baseline">
                  <span className="text-xl sm:text-2xl font-extrabold text-slate-800 tracking-tight leading-none">
                    {stat.value}
                  </span>
                  {stat.label && (
                    <span className="text-[11px] font-semibold text-slate-400 ml-1.5">
                      {stat.label}
                    </span>
                  )}
                </div>
              </div>

              {/* Bottom Row: Context Badge */}
              <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between z-1 relative">
                {stat.badge.type === 'success' && (
                  <span className="inline-flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>{stat.badge.text}</span>
                  </span>
                )}
                {stat.badge.type === 'neutral' && (
                  <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-slate-500 bg-slate-50 border border-slate-200/60 px-2 py-0.5 rounded-full">
                    <span>{stat.badge.text}</span>
                  </span>
                )}
                {stat.badge.type === 'amber' && (
                  <span className="inline-flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200/60 px-2 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    <span>{stat.badge.text}</span>
                  </span>
                )}
                {stat.badge.type === 'emerald' && (
                  <span className="inline-flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span>{stat.badge.text}</span>
                  </span>
                )}
                {stat.badge.type === 'sky' && (
                  <span className="inline-flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-sky-700 bg-sky-50 border border-sky-200/60 px-2 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                    <span>{stat.badge.text}</span>
                  </span>
                )}
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Main Charts & Actions Grid */}
      <motion.div 
        variants={gridVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 lg:grid-cols-3 lg:grid-rows-1 gap-2.5 sm:gap-3 flex-1 min-h-0 h-full items-stretch"
      >
        {/* Trend Bar Chart Card */}
        <div className="lg:col-span-2 bg-white p-3.5 sm:p-4 rounded-xl border border-slate-100 shadow-soft flex flex-col justify-between h-full min-h-0">
          <div className="flex justify-between items-center mb-2 shrink-0">
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-slate-800">Production Trend</h3>
              <p className="text-[9.5px] text-brand-text-muted mt-0.5">Annual performance analytics</p>
            </div>
            
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="px-2 py-0.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none text-slate-700 font-semibold focus:border-brand-primary cursor-pointer hover:bg-slate-100 transition-colors"
            >
              {yearsList.map(y => (
                <option key={y} value={y}>Year {y}</option>
              ))}
            </select>
          </div>
          
          <div className="flex-1 w-full min-h-[170px] relative">
            <DashboardChart data={chartData} className="w-full h-full" />
          </div>
        </div>

        {/* Last Entry & Quick Actions Column */}
        <div className="flex flex-col gap-2.5 sm:gap-3 justify-between h-full min-h-0">
          {/* Last Entry */}
          <div className="bg-white p-3 sm:p-3.5 rounded-xl border border-slate-100 shadow-soft flex-1 flex flex-col justify-between group min-h-0">
            <div>
              <h4 className="text-[9.5px] font-bold text-slate-450 uppercase tracking-wider mb-2">Last Entry</h4>
              
              <div className="flex items-center gap-2.5 p-2.5 bg-slate-50/60 border border-slate-100 rounded-xl transition-all duration-300 group-hover:border-brand-primary/10 group-hover:bg-brand-light-purple/5">
                <div className="w-8 h-8 rounded-lg bg-brand-light-purple flex items-center justify-center shrink-0 text-brand-primary shadow-xs">
                  <Calendar size={15} />
                </div>
                
                <div className="flex-1 min-w-0">
                  <h5 className="text-xs font-extrabold text-slate-800 truncate">
                    {formatLastEntryDate(lastEntryDate)}
                  </h5>
                  <p className="text-[9px] text-brand-text-muted mt-0.5 truncate">
                    Last recorded log
                  </p>
                </div>

                <div className="shrink-0 text-right">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[9.5px] font-extrabold bg-brand-light-purple/60 border border-brand-primary/10 text-brand-primary">
                    {lastEntryFalls.toLocaleString()} Falls
                  </span>
                </div>
              </div>
            </div>

            <motion.button 
              onClick={() => onNavigate('history')}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.985 }}
              className="w-full mt-2.5 py-1.5 border border-slate-200 hover:border-slate-350 hover:bg-slate-50 text-[10px] font-extrabold text-slate-700 bg-white rounded-lg flex items-center justify-center gap-1 shadow-xs transition-all cursor-pointer"
            >
              View History <ChevronRight size={12} />
            </motion.button>
          </div>

          {/* Quick Actions */}
          <div className="bg-white p-3 sm:p-3.5 rounded-xl border border-slate-100 shadow-soft flex-1 flex flex-col justify-between min-h-0">
            <h4 className="text-[9.5px] font-bold text-slate-455 uppercase tracking-wider mb-1.5 shrink-0">Quick Shortcuts</h4>
            
            <div className="space-y-1.5 flex-1 flex flex-col justify-center">
              <motion.button
                onClick={() => onNavigate('daily-entry')}
                whileHover={{ scale: 1.01, x: 2 }}
                whileTap={{ scale: 0.985 }}
                className="w-full flex items-center gap-2.5 p-2.5 bg-slate-50/60 border border-slate-100 hover:border-brand-primary/20 hover:bg-brand-light-purple/10 text-left rounded-xl transition-all duration-200 group cursor-pointer"
              >
                <div className="w-7.5 h-7.5 rounded-lg bg-brand-light-purple flex items-center justify-center shrink-0 text-brand-primary shadow-inner">
                  <PenSquare size={14} />
                </div>
                
                <div className="flex-1 min-w-0">
                  <h5 className="text-xs font-bold text-slate-800 group-hover:text-brand-primary transition-colors">Record New Falls</h5>
                  <p className="text-[9px] text-brand-text-muted">Enter completed saree bundles</p>
                </div>
                
                <ChevronRight size={13} className="text-slate-400 group-hover:text-brand-primary group-hover:translate-x-0.5 transition-all" />
              </motion.button>

              <motion.button
                onClick={() => onNavigate('rates')}
                whileHover={{ scale: 1.01, x: 2 }}
                whileTap={{ scale: 0.985 }}
                className="w-full flex items-center gap-2.5 p-2.5 bg-slate-50/60 border border-slate-100 hover:border-brand-primary/20 hover:bg-brand-light-purple/10 text-left rounded-xl transition-all duration-200 group cursor-pointer"
              >
                <div className="w-7.5 h-7.5 rounded-lg bg-amber-50 flex items-center justify-center shrink-0 text-amber-600 shadow-inner">
                  <IndianRupee size={14} />
                </div>
                
                <div className="flex-1 min-w-0">
                  <h5 className="text-xs font-bold text-slate-800 group-hover:text-brand-primary transition-colors">Update Rate Card</h5>
                  <p className="text-[9px] text-brand-text-muted">Adjust active rate per dozen</p>
                </div>
                
                <ChevronRight size={13} className="text-slate-400 group-hover:text-brand-primary group-hover:translate-x-0.5 transition-all" />
              </motion.button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
export default Dashboard;
