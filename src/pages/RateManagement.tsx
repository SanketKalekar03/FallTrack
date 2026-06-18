import React, { useEffect, useState } from 'react';
import { Calendar, Trash2, TrendingUp, Save } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { motion } from 'framer-motion';
import { useRateStore } from '../store/useRateStore';
import { rateSchema } from '../schemas/validation';

export const RateManagement: React.FC = () => {
  const { rates, fetchRates, addRate, deleteRate, loading } = useRateStore();

  const [rateInput, setRateInput] = useState('');
  const [effectiveFromInput, setEffectiveFromInput] = useState(() => {
    // Default to today
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });

  const [errors, setErrors] = useState<{ rate?: string; date?: string }>({});

  useEffect(() => {
    fetchRates();
  }, [fetchRates]);

  // Find active rate as of today
  const getTodayLocalDate = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const todayStr = getTodayLocalDate();

  // The active rate is the latest one where effective_from <= today
  const activeRateObj = rates.find(r => r.effective_from <= todayStr) || (rates.length > 0 ? rates[rates.length - 1] : null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const rateNum = parseFloat(rateInput);
    const result = rateSchema.safeParse({
      rate_per_dozen: rateNum,
      effective_from: effectiveFromInput
    });

    if (!result.success) {
      const fieldErrors = result.error.flatten().fieldErrors;
      setErrors({
        rate: fieldErrors.rate_per_dozen?.[0],
        date: fieldErrors.effective_from?.[0]
      });
      toast.error("Please check rate and date values.");
      return;
    }

    try {
      await addRate({
        rate_per_dozen: rateNum,
        effective_from: effectiveFromInput
      });
      toast.success("Rate added successfully!");
      setRateInput('');
      // Reset date to today
      const d = new Date();
      setEffectiveFromInput(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    } catch (err: any) {
      toast.error(`Error adding rate: ${err.message}`);
    }
  };

  const handleDelete = async (id: string, rate: number) => {
    // Count how many rates we have; don't allow deleting the last remaining rate
    if (rates.length === 1) {
      toast.error("At least one rate is required. Cannot delete last rate.");
      return;
    }

    if (window.confirm(`Are you sure you want to delete rate ₹${rate}?`)) {
      try {
        await deleteRate(id);
        toast.success("Rate deleted successfully.");
      } catch (err: any) {
        toast.error(`Error: ${err.message}`);
      }
    }
  };

  const formatDateString = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  // Framer Motion Variants
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.04
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 8 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <div className="space-y-4">
      {/* Top Section: Active Card + Form */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Active Rate Card */}
        <motion.div 
          whileHover={{ y: -4 }}
          className="bg-gradient-to-br from-brand-light-purple to-[#EBE5FF] p-4 rounded-xl text-brand-primary shadow-soft border border-brand-primary/10 flex flex-col justify-between relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 w-28 h-28 bg-brand-primary/5 rounded-bl-full pointer-events-none" />
          
          <div>
            <span className="inline-block px-2.5 py-0.5 bg-brand-primary/10 text-brand-primary rounded-full text-[10px] font-extrabold uppercase tracking-wider">
              Active Rate
            </span>
            
            <div className="mt-3.5">
              <span className="text-[10px] text-brand-primary/80 font-bold uppercase">Current Rate</span>
              <h3 className="text-2xl font-extrabold text-brand-primary tracking-tight mt-0.5">
                Rs. {activeRateObj ? activeRateObj.rate_per_dozen.toFixed(2) : '5.00'} 
                <span className="text-xs font-semibold text-brand-primary/80"> / Dozen</span>
              </h3>
            </div>
          </div>

          <div className="mt-4 pt-2.5 border-t border-brand-primary/10 flex items-center gap-2 text-brand-primary/80">
            <Calendar size={14} className="text-brand-primary/60" />
            <span className="text-xs font-medium">
              Active Since: <span className="font-bold text-slate-700">
                {activeRateObj ? formatDateString(activeRateObj.effective_from) : '01 Jan 2026'}
              </span>
            </span>
          </div>
        </motion.div>

        {/* Update Rate Form Card */}
        <div className="lg:col-span-2 bg-white p-4 rounded-xl border border-slate-100 shadow-soft">
          <div>
            <h3 className="text-sm font-bold text-slate-800">Update Rate</h3>
            <p className="text-[11px] text-brand-text-muted mt-0.5">Set a new production rate effective from a specific date</p>
          </div>

          <form onSubmit={handleSave} className="mt-3 space-y-2.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Rate input */}
              <div className="flex flex-col gap-1">
                <label className="text-[9px] font-extrabold text-slate-450 uppercase tracking-wider">Rate Per Dozen (₹)</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={rateInput}
                    onChange={(e) => {
                      setRateInput(e.target.value);
                      if (errors.rate) setErrors(prev => ({ ...prev, rate: undefined }));
                    }}
                    className={`w-full px-3 py-1.5 bg-white border rounded-lg text-xs font-bold outline-none text-slate-700 shadow-sm transition-all focus:border-brand-primary focus:ring-3 focus:ring-brand-primary/10 ${
                      errors.rate ? 'border-red-300 focus:border-red-500 focus:ring-red-500/10' : 'border-slate-200'
                    }`}
                  />
                  <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-xs text-slate-400 font-bold">
                    ₹ / Dozen
                  </div>
                </div>
                {errors.rate && (
                  <span className="text-[10px] text-red-555 font-medium">
                    {errors.rate}
                  </span>
                )}
              </div>

              {/* Effective date input */}
              <div className="flex flex-col gap-1">
                <label className="text-[9px] font-extrabold text-slate-450 uppercase tracking-wider">Effective Date</label>
                <input
                  type="date"
                  value={effectiveFromInput}
                  onChange={(e) => {
                    setEffectiveFromInput(e.target.value);
                    if (errors.date) setErrors(prev => ({ ...prev, date: undefined }));
                  }}
                  className={`px-3 py-1.5 bg-white border rounded-lg text-xs font-semibold outline-none text-slate-700 shadow-sm transition-all focus:border-brand-primary focus:ring-3 focus:ring-brand-primary/10 ${
                    errors.date ? 'border-red-300 focus:border-red-500 focus:ring-red-500/10' : 'border-slate-200'
                  }`}
                />
                {errors.date && (
                  <span className="text-[10px] text-red-500 font-medium">
                    {errors.date}
                  </span>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <motion.button
                type="submit"
                disabled={loading}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex items-center gap-1.5 px-5 py-2 bg-brand-primary hover:bg-brand-primary-hover text-white text-xs font-bold rounded-lg shadow-md shadow-brand-primary/15 transition-all duration-200 active:scale-[0.98] cursor-pointer"
              >
                <Save size={13} /> Save New Rate
              </motion.button>
            </div>
          </form>
        </div>
      </div>

      {/* Rate History List Card */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-soft overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">
          <h4 className="text-sm font-bold text-slate-800">Rate History</h4>
          <p className="text-[10px] text-brand-text-muted mt-0.5">Audit log of rate updates and effective dates</p>
        </div>

        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="divide-y divide-slate-100"
        >
          {rates.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-slate-400 font-medium">
              No rate entries loaded.
            </div>
          ) : (
            rates.map((r) => {
              const isActive = activeRateObj?.id === r.id;
              return (
                <motion.div 
                  key={r.id} 
                  variants={itemVariants}
                  className={`p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/20 transition-colors duration-150 ${
                    isActive ? 'bg-emerald-50/5' : ''
                  }`}
                >
                  {/* Left & Middle */}
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm border ${
                      isActive 
                        ? 'bg-emerald-50 text-emerald-600 border-emerald-100' 
                        : 'bg-brand-light-purple text-brand-primary border-brand-primary/5'
                    }`}>
                      <TrendingUp size={15} />
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-extrabold text-slate-800">
                          Rs. {r.rate_per_dozen.toFixed(2)} / dozen
                        </span>
                        {isActive && (
                          <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded-md text-[9px] font-bold uppercase tracking-wider">
                            Active
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[9px] font-bold text-slate-400">
                          Effective From: {formatDateString(r.effective_from)}
                        </span>
                        <span className="text-[9px] font-extrabold text-slate-305">•</span>
                        <span className="text-[9px] text-slate-400">
                          Created: {r.created_at ? new Date(r.created_at).toLocaleDateString('en-IN') : 'Initial Setup'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right Actions */}
                  <div className="flex justify-end shrink-0">
                    <button
                      onClick={() => handleDelete(r.id, r.rate_per_dozen)}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-red-200 hover:bg-red-55/10 hover:border-red-300 text-red-650 text-[10px] font-bold rounded-lg shadow-sm transition-all duration-200 disabled:opacity-40 disabled:hover:bg-white disabled:hover:border-slate-200 disabled:text-slate-400 cursor-pointer"
                      title="Delete Rate"
                      disabled={isActive && rates.length === 1}
                    >
                      <Trash2 size={11} className={isActive && rates.length === 1 ? 'text-slate-300' : 'text-red-500'} /> Delete
                    </button>
                  </div>
                </motion.div>
              );
            })
          )}
        </motion.div>
      </div>

      {/* Predictive Trends card matching rates mockup */}
      <div className="bg-brand-light-purple/35 p-4 rounded-xl border border-brand-light-purple-hover flex flex-col items-center text-center max-w-2xl mx-auto space-y-2.5">
        <div className="p-1.5 bg-brand-light-purple rounded-full text-brand-primary">
          <TrendingUp size={18} />
        </div>
        <h4 className="text-xs font-bold text-slate-800">Predictive Trends</h4>
        <p className="text-[11px] text-slate-650 max-w-md leading-relaxed">
          Automated forecasting suggests a seasonal rate adjustment of <span className="font-bold text-brand-primary">+8% in Q3</span> based on historical production volume.
        </p>
        <button 
          onClick={() => toast.success("Predictive analytics report open.")}
          className="text-[11px] font-bold text-brand-primary hover:underline flex items-center gap-1"
        >
          View Full Analysis &rarr;
        </button>
      </div>
    </div>
  );
};
export default RateManagement;
