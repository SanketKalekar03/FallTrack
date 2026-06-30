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

interface DashboardProps {
  onNavigate: (tabId: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { entries, fetchEntries } = useProductionStore();
  const { fetchRates, getActiveRateForDate } = useRateStore();
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  useEffect(() => {
    fetchEntries();
    fetchRates();
  }, [fetchEntries, fetchRates]);

  const getLocalDateString = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const todayStr = getLocalDateString();
  const currentMonthStr = todayStr.substring(0, 7);

  const todayEntries = entries.filter(e => e.entry_date === todayStr);
  const todayFalls = todayEntries.reduce((sum, e) => sum + e.quantity, 0);

  const monthlyEntries = entries.filter(e => e.entry_date.startsWith(currentMonthStr));
  const monthlyFalls = monthlyEntries.reduce((sum, e) => sum + e.quantity, 0);

  const currentRate = getActiveRateForDate(todayStr);

  const estimatedIncome = (monthlyFalls / 12) * currentRate;

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
      bgColor: "bg-white",
      accentColor: "text-sky-600",
      iconBg: "bg-sky-50",
      badge: todayFalls > 0 ? { text: "Active", type: "sky" } : { text: "No logs today", type: "neutral" }
    },
    {
      title: "Monthly Falls",
      value: monthlyFalls.toLocaleString(),
      label: "Falls",
      icon: Calendar,
      bgColor: "bg-white",
      accentColor: "text-amber-600",
      iconBg: "bg-amber-50",
      badge: { text: "This Month", type: "amber" }
    },
    {
      title: "Current Rate",
      value: `Rs. ${currentRate.toFixed(2)}`,
      label: "/ Dozen",
      icon: IndianRupee,
      bgColor: "bg-white",
      accentColor: "text-emerald-600",
      iconBg: "bg-emerald-50",
      badge: { text: "Standard", type: "success" }
    },
    {
      title: "Est. Monthly Income",
      value: `Rs. ${Math.round(estimatedIncome).toLocaleString()}`,
      label: "",
      icon: TrendingUp,
      bgColor: "bg-white",
      accentColor: "text-brand-primary",
      iconBg: "bg-brand-light-purple/40",
      badge: { text: "Estimated", type: "neutral" }
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
    <div className="space-y-4">
      {/* Stats Cards Section */}
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
      >
        {stats.map((stat, idx) => {
          const Icon = stat.icon;
          const isBrand = stat.bgColor.includes('gradient');
          return (
            <motion.div 
              key={idx}
              variants={itemVariants}
              whileHover={{ 
                y: -4, 
                boxShadow: "0 10px 25px -5px rgba(92, 62, 163, 0.12), 0 8px 16px -4px rgba(92, 62, 163, 0.08)"
              }}
              whileTap={{ scale: 0.985 }}
              className={`p-4 rounded-xl border border-slate-100/80 shadow-soft transition-all duration-300 relative overflow-hidden group flex justify-between items-center ${stat.bgColor}`}
            >
              {/* Decorative background icon watermark */}
              <Icon 
                size={56} 
                className={`absolute -right-2 -bottom-2 opacity-[0.035] transition-transform duration-500 group-hover:scale-115 group-hover:rotate-12 pointer-events-none ${isBrand ? 'text-white' : stat.accentColor}`} 
              />
              
              <div className="flex flex-col gap-1 z-5">
                <p className={`text-[9px] font-bold uppercase tracking-wider ${isBrand ? 'text-white/70' : 'text-slate-400'}`}>
                  {stat.title}
                </p>
                <h3 className="text-xl font-extrabold tracking-tight">
                  {stat.value}
                  {stat.label && (
                    <span className={`text-[9px] font-bold ml-1 ${isBrand ? 'text-white/70' : 'text-slate-400'}`}>
                      {stat.label}
                    </span>
                  )}
                </h3>
                
                {/* Badge pill */}
                <div className="mt-1">
                  {stat.badge.type === 'success' && (
                    <span className="text-[9px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full">
                      {stat.badge.text}
                    </span>
                  )}
                  {stat.badge.type === 'brand' && (
                    <span className="text-[9px] font-bold uppercase tracking-wider bg-white/20 text-white px-2 py-0.5 rounded-full">
                      {stat.badge.text}
                    </span>
                  )}
                  {stat.badge.type === 'amber' && (
                    <span className="text-[9px] font-bold uppercase tracking-wider bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full">
                      {stat.badge.text}
                    </span>
                  )}
                  {stat.badge.type === 'neutral' && (
                    <span className="text-[9px] font-bold uppercase tracking-wider bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                      {stat.badge.text}
                    </span>
                  )}
                  {stat.badge.type === 'sky' && (
                    <span className="text-[9px] font-bold uppercase tracking-wider bg-sky-50 text-sky-600 px-2 py-0.5 rounded-full">
                      {stat.badge.text}
                    </span>
                  )}
                </div>
              </div>

              {/* Icon Container */}
              <div className={`w-9 h-9 rounded-full ${stat.iconBg} flex items-center justify-center shrink-0 z-5 shadow-inner`}>
                <Icon size={16} className={stat.accentColor} />
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
        className="grid grid-cols-1 lg:grid-cols-3 gap-3"
      >
        {/* Trend Bar Chart Card */}
        <div className="lg:col-span-2 bg-white p-4 rounded-xl border border-slate-100 shadow-soft">
          <div className="flex justify-between items-center mb-3.5">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Production Trend</h3>
              <p className="text-[10px] text-brand-text-muted mt-0.5">Annual performance analytics</p>
            </div>
            
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none text-slate-700 font-semibold focus:border-brand-primary cursor-pointer hover:bg-slate-100 transition-colors"
            >
              {yearsList.map(y => (
                <option key={y} value={y}>Year {y}</option>
              ))}
            </select>
          </div>
          
          <DashboardChart data={chartData} />
        </div>

        {/* Last Entry & Quick Actions Card */}
        <div className="flex flex-col gap-3">
          {/* Last Entry */}
          <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-soft flex-1 flex flex-col justify-between group">
            <div>
              <h4 className="text-[10px] font-bold text-slate-450 uppercase tracking-wider mb-3">Last Entry</h4>
              
              <div className="flex items-center gap-3 p-3 bg-slate-50/60 border border-slate-100 rounded-xl transition-all duration-300 group-hover:border-brand-primary/10 group-hover:bg-brand-light-purple/5">
                <div className="w-9 h-9 rounded-xl bg-brand-light-purple flex items-center justify-center shrink-0 text-brand-primary shadow-sm">
                  <Calendar size={16} />
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
                  <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-extrabold bg-brand-light-purple/60 border border-brand-primary/10 text-brand-primary">
                    {lastEntryFalls.toLocaleString()} Falls
                  </span>
                </div>
              </div>
            </div>

            <motion.button 
              onClick={() => onNavigate('history')}
              whileHover={{ scale: 1.015 }}
              whileTap={{ scale: 0.985 }}
              className="w-full mt-4 py-1.5 border border-slate-200 hover:border-slate-350 hover:bg-slate-50 text-[10px] font-extrabold text-slate-700 bg-white rounded-lg flex items-center justify-center gap-1 shadow-sm transition-all cursor-pointer"
            >
              View History <ChevronRight size={12} />
            </motion.button>
          </div>

          {/* Quick Actions */}
          <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-soft">
            <h4 className="text-[10px] font-bold text-slate-455 uppercase tracking-wider mb-3">Quick Shortcuts</h4>
            
            <div className="space-y-2">
              <motion.button
                onClick={() => onNavigate('daily-entry')}
                whileHover={{ scale: 1.015, x: 2 }}
                whileTap={{ scale: 0.985 }}
                className="w-full flex items-center gap-3 p-3 bg-slate-50/60 border border-slate-100 hover:border-brand-primary/20 hover:bg-brand-light-purple/10 text-left rounded-xl transition-all duration-200 group cursor-pointer"
              >
                <div className="w-8 h-8 rounded-lg bg-brand-light-purple flex items-center justify-center shrink-0 text-brand-primary shadow-inner">
                  <PenSquare size={15} />
                </div>
                
                <div className="flex-1 min-w-0">
                  <h5 className="text-xs font-bold text-slate-800 group-hover:text-brand-primary transition-colors">Record New Falls</h5>
                  <p className="text-[9px] text-brand-text-muted mt-0.5">Enter completed saree bundles</p>
                </div>
                
                <ChevronRight size={14} className="text-slate-400 group-hover:text-brand-primary group-hover:translate-x-0.5 transition-all" />
              </motion.button>

              <motion.button
                onClick={() => onNavigate('rates')}
                whileHover={{ scale: 1.015, x: 2 }}
                whileTap={{ scale: 0.985 }}
                className="w-full flex items-center gap-3 p-3 bg-slate-50/60 border border-slate-100 hover:border-brand-primary/20 hover:bg-brand-light-purple/10 text-left rounded-xl transition-all duration-200 group cursor-pointer"
              >
                <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center shrink-0 text-amber-600 shadow-inner">
                  <IndianRupee size={15} />
                </div>
                
                <div className="flex-1 min-w-0">
                  <h5 className="text-xs font-bold text-slate-800 group-hover:text-brand-primary transition-colors">Update Rate Card</h5>
                  <p className="text-[9px] text-brand-text-muted mt-0.5">Adjust active rate per dozen</p>
                </div>
                
                <ChevronRight size={14} className="text-slate-400 group-hover:text-brand-primary group-hover:translate-x-0.5 transition-all" />
              </motion.button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
export default Dashboard;
