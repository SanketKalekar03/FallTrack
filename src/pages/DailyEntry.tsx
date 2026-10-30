import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  Save, 
  Keyboard, 
  Languages, 
  CloudLightning,
  RotateCcw,
  TrendingUp,
  Sparkles,
  Calendar
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { useProductionStore } from '../store/useProductionStore';
import { useRateStore } from '../store/useRateStore';
import { MarathiColorSelect } from '../components/MarathiColorSelect';
import { productionEntrySchema } from '../schemas/validation';
import { dbService } from '../services/dbService';
import { confirmDialog } from '../store/useConfirmStore';

interface EntryRow {
  key: string;
  colorId: string;
  quantityStr: string;
}

export const DailyEntry: React.FC = () => {
  const { entries, fetchEntries, saveEntries } = useProductionStore();
  const { getActiveRateForDate, fetchRates } = useRateStore();

  const [entryDate] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  
  const [rows, setRows] = useState<EntryRow[]>(() => {
    const draft = dbService.getDraft();
    return draft || [{ key: 'row-0', colorId: '', quantityStr: '0' }];
  });

  // Errors map: key -> field errors
  const [errors, setErrors] = useState<{ [key: string]: { colorId?: string; quantity?: string } }>({});

  useEffect(() => {
    fetchEntries();
    fetchRates();
  }, [fetchEntries, fetchRates]);

  // Auto-save draft to localStorage whenever rows change
  useEffect(() => {
    dbService.saveDraft(rows);
  }, [rows]);

  const handleAddRow = () => {
    const newKey = `row-${Date.now()}`;
    setRows(prev => [
      ...prev,
      { key: newKey, colorId: '', quantityStr: '0' }
    ]);
    
    // Autofocus the color search input of the newly added row
    setTimeout(() => {
      const nextInput = document.querySelector(`#row-color-select-${newKey} input`) as HTMLInputElement;
      if (nextInput) {
        nextInput.focus();
      }
    }, 50);
  };

  const handleRemoveRow = (key: string) => {
    if (rows.length === 1) {
      setRows([{ key: 'row-0', colorId: '', quantityStr: '0' }]);
      setErrors({});
      return;
    }
    setRows(prev => prev.filter(r => r.key !== key));
    setErrors(prev => {
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
  };

  const handleRowChange = (key: string, field: 'colorId' | 'quantityStr', value: string) => {
    setRows(prev => prev.map(row => {
      if (row.key === key) {
        return { ...row, [field]: value };
      }
      return row;
    }));

    // Clear validation error when field changes
    setErrors(prev => {
      if (!prev[key]) return prev;
      const rowErrors = { ...prev[key] };
      if (field === 'colorId') delete rowErrors.colorId;
      if (field === 'quantityStr') delete rowErrors.quantity;
      
      const copy = { ...prev };
      if (Object.keys(rowErrors).length === 0) {
        delete copy[key];
      } else {
        copy[key] = rowErrors;
      }
      return copy;
    });
  };

  const handleResetDraft = async () => {
    const confirmed = await confirmDialog({
      title: "Clear Current Draft",
      message: "Are you sure you want to clear all entered rows and start over? Unsaved inputs will be reset.",
      confirmText: "Clear Draft",
      type: "warning"
    });
    if (!confirmed) return;
    setRows([{ key: 'row-0', colorId: '', quantityStr: '0' }]);
    setErrors({});
    dbService.clearDraft();
    toast.success("Draft cleared successfully!");
  };

  const handleSave = async () => {
    const validationErrors: typeof errors = {};
    let hasError = false;

    // Check for empty or invalid rows
    const formattedEntries: any[] = [];

    rows.forEach(row => {
      const qtyNum = parseInt(row.quantityStr, 10);
      
      // Parse with zod
      const result = productionEntrySchema.safeParse({
        entry_date: entryDate,
        color_id: row.colorId,
        quantity: qtyNum
      });

      if (!result.success) {
        hasError = true;
        const fieldErrors = result.error.flatten().fieldErrors;
        validationErrors[row.key] = {
          colorId: fieldErrors.color_id?.[0],
          quantity: fieldErrors.quantity?.[0]
        };
      } else {
        formattedEntries.push({
          entry_date: entryDate,
          color_id: row.colorId,
          quantity: qtyNum
        });
      }
    });

    if (hasError) {
      setErrors(validationErrors);
      toast.error("Please correct the validation errors.");
      return;
    }

    if (formattedEntries.length === 0) {
      toast.error("At least one entry row is required.");
      return;
    }

    try {
      await saveEntries(formattedEntries);
      toast.success("Entries saved successfully!");
      
      // Reset rows and clear drafts
      setRows([{ key: 'row-0', colorId: '', quantityStr: '0' }]);
      setErrors({});
      dbService.clearDraft();
    } catch (err: any) {
      toast.error(`Error saving entries: ${err.message || ''}`);
    }
  };

  // Live calculations
  const totalColors = new Set(rows.filter(r => r.colorId).map(r => r.colorId)).size;
  const totalQuantity = rows.reduce((sum, r) => {
    const val = parseInt(r.quantityStr, 10);
    return sum + (isNaN(val) || val < 0 ? 0 : val);
  }, 0);

  const activeRate = getActiveRateForDate(entryDate);
  const estEarnings = rows.reduce((sum, r) => {
    const qty = parseInt(r.quantityStr, 10);
    const validQty = isNaN(qty) || qty < 0 ? 0 : qty;
    return sum + (validQty / 12) * activeRate;
  }, 0);

  return (
    <div className="space-y-4">
      {/* Configuration Header Card */}
      <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-100 shadow-soft flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Sparkles size={15} className="text-brand-primary animate-pulse" />
            Record Daily Production
          </h3>
          <p className="text-[10px] text-brand-text-muted mt-0.5">Log saree fall counts by color and calculate estimated earnings in real-time</p>
        </div>
        
        <div className="flex flex-col gap-1 w-full sm:w-auto">
          <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Entry Date (Locked)</label>
          <div className="relative">
            <input
              type="date"
              value={entryDate}
              disabled
              className="px-3 py-1.5 pl-8 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold outline-none text-slate-405 shadow-sm transition-all cursor-not-allowed"
            />
            <Calendar size={13} className="absolute left-2.5 top-2 text-slate-400" />
          </div>
        </div>
      </div>

      {/* Split Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: Form (7 columns) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white rounded-xl border border-slate-100 shadow-soft">
            <div className="py-2.5 px-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 rounded-t-xl">
              <h4 className="text-[10px] font-extrabold text-slate-455 uppercase tracking-wider flex items-center gap-1.5">
                <Keyboard size={12} className="text-brand-primary" /> Entry Rows
              </h4>
              <motion.button
                onClick={handleAddRow}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-200 hover:border-brand-primary hover:text-brand-primary text-slate-700 text-[10px] font-bold rounded-lg shadow-sm transition-all cursor-pointer"
              >
                <Plus size={11} className="text-brand-primary" /> Add Row
              </motion.button>
            </div>

            {/* Form Rows Table / List */}
            <div className="p-4 space-y-2 relative z-10">
              <AnimatePresence initial={false}>
                {rows.map((row, index) => {
                  return (
                    <motion.div 
                      key={row.key} 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -10 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                      className="flex flex-row items-center gap-3 p-2 bg-slate-50/30 border border-slate-100 hover:border-slate-200/60 rounded-xl transition-all duration-200"
                      style={{ zIndex: rows.length - index }}
                    >
                      {/* Index Indicator */}
                      <div className="shrink-0 flex items-center justify-center w-6 h-6 rounded bg-slate-100 text-slate-455 text-[10px] font-bold">
                        {index + 1}
                      </div>

                      {/* Color Input */}
                      <div className="flex-1 min-w-0" id={`row-color-select-${row.key}`}>
                        <MarathiColorSelect
                          selectedColorId={row.colorId}
                          onSelect={(colorId) => handleRowChange(row.key, 'colorId', colorId)}
                          error={errors[row.key]?.colorId}
                          placeholder="Search color..."
                        />
                      </div>

                      {/* Quantity Input */}
                      <div className="w-24 sm:w-28 shrink-0 flex items-center">
                        <input
                          type="number"
                          value={row.quantityStr}
                          onChange={(e) => handleRowChange(row.key, 'quantityStr', e.target.value)}
                          onFocus={(e) => {
                            if (e.target.value === '0') handleRowChange(row.key, 'quantityStr', '');
                          }}
                          onBlur={(e) => {
                            if (e.target.value === '') handleRowChange(row.key, 'quantityStr', '0');
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              // If it is the last row, add a new row
                              if (index === rows.length - 1) {
                                handleAddRow();
                              } else {
                                // Focus next row's color input
                                const nextRowKey = rows[index + 1].key;
                                setTimeout(() => {
                                  const nextInput = document.querySelector(`#row-color-select-${nextRowKey} input`) as HTMLInputElement;
                                  nextInput?.focus();
                                }, 50);
                              }
                            }
                          }}
                          placeholder="Falls"
                          className={`w-full px-2.5 py-1.5 text-xs bg-white border rounded-lg outline-none text-right font-bold transition-all shadow-sm ${
                            errors[row.key]?.quantity
                              ? 'border-red-300 focus:border-red-500 focus:ring-3 focus:ring-red-500/10'
                              : 'border-slate-200 focus:border-brand-primary focus:ring-3 focus:ring-brand-primary/10'
                          }`}
                        />
                      </div>

                      {/* Delete Row Button */}
                      <div className="shrink-0 flex items-center justify-center">
                        <button
                          onClick={() => handleRemoveRow(row.key)}
                          className="p-1.5 text-slate-400 hover:text-red-650 hover:bg-red-50 hover:border-red-100 border border-transparent rounded-lg transition-all cursor-pointer"
                          title="Remove Row"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>

            {/* Save Buttons & Footer Actions */}
            <div className="bg-slate-50/70 py-3 px-4 border-t border-slate-100 flex justify-between items-center gap-3 rounded-b-xl">
              <motion.button
                onClick={handleResetDraft}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex items-center justify-center gap-1.5 px-3 py-2 bg-white border border-slate-200 hover:bg-slate-55 hover:border-slate-300 text-slate-600 text-xs font-bold rounded-lg shadow-sm transition-all cursor-pointer"
              >
                <RotateCcw size={12} /> Clear Draft
              </motion.button>

              <motion.button
                onClick={handleSave}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex items-center justify-center gap-1.5 px-5 py-2 bg-brand-primary hover:bg-brand-primary-hover text-white text-xs font-bold rounded-lg shadow-md shadow-brand-primary/15 transition-all duration-200 active:scale-[0.98] cursor-pointer"
              >
                <Save size={12} /> Save Entries
              </motion.button>
            </div>
          </div>
        </div>

        {/* Right Column: Draft Stats Card & Saved Logs Timeline (5 columns) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Draft Summary Card */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-soft p-4 space-y-3">
            <div>
              <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <TrendingUp size={13} className="text-brand-primary" /> Live Draft Summary
              </h4>
              <p className="text-[9px] text-brand-text-muted mt-0.5">Calculated dynamically for current unsaved rows</p>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <motion.div 
                whileHover={{ y: -2 }}
                className="p-2.5 bg-white rounded-lg border border-slate-100 shadow-sm"
              >
                <span className="text-[8px] font-extrabold text-slate-400 uppercase tracking-wider block">Colors</span>
                <span className="text-sm font-extrabold text-slate-800 mt-0.5 block">{totalColors}</span>
              </motion.div>
              <motion.div 
                whileHover={{ y: -2 }}
                className="p-2.5 bg-gradient-to-br from-brand-light-purple to-[#EBE5FF] rounded-lg text-brand-primary border border-brand-primary/10 shadow-sm"
              >
                <span className="text-[8px] font-bold text-brand-primary/80 uppercase tracking-wider block">Total Falls</span>
                <span className="text-sm font-extrabold text-brand-primary mt-0.5 block">{totalQuantity.toLocaleString()}</span>
              </motion.div>
              <motion.div 
                whileHover={{ y: -2 }}
                className="p-2.5 bg-gradient-to-br from-brand-primary to-brand-accent rounded-lg text-white shadow-md shadow-brand-primary/10 border-0"
              >
                <span className="text-[8px] font-bold text-white/85 uppercase tracking-wider block">Est. Income</span>
                <span className="text-sm font-extrabold text-white mt-0.5 block">Rs. {Math.round(estEarnings).toLocaleString()}</span>
              </motion.div>
            </div>
          </div>

          {/* Saved Timeline/Ledger */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-soft overflow-hidden">
            <div className="py-2.5 px-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <div>
                <h4 className="text-[10px] font-extrabold text-slate-455 uppercase tracking-wider">
                  Saved Logs on {new Date(entryDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </h4>
                <p className="text-[9px] text-brand-text-muted mt-0.5">Committed database records for today</p>
              </div>
              {entries.filter(e => e.entry_date === entryDate).length > 0 && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[9px] font-extrabold bg-emerald-50 border border-emerald-100 text-emerald-600">
                  {entries.filter(e => e.entry_date === entryDate).reduce((sum, e) => sum + e.quantity, 0).toLocaleString()} Falls
                </span>
              )}
            </div>

            <div className="p-4 max-h-[350px] overflow-y-auto">
              {entries.filter(e => e.entry_date === entryDate).length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-xs text-slate-400 font-medium">No records saved for this date yet.</p>
                  <p className="text-[9px] text-slate-400 mt-0.5">Fill the form and click "Save Entries".</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <AnimatePresence initial={false}>
                    {entries.filter(e => e.entry_date === entryDate).map((entry) => {
                      return (
                        <motion.div 
                          key={entry.id} 
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          className="flex items-center justify-between p-2.5 bg-slate-50/30 border border-slate-100 rounded-lg hover:border-slate-200/50 transition-all cursor-pointer"
                        >
                          <div>
                            <span className="text-xs font-bold text-slate-750 block">
                              {entry.color?.name || 'Unspecified'}
                            </span>
                          </div>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-extrabold bg-brand-light-purple/60 border border-brand-primary/10 text-brand-primary">
                            {entry.quantity.toLocaleString()} Falls
                          </span>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Speed details info card */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white p-3 rounded-xl border border-slate-100/60 shadow-sm flex items-start gap-3">
          <div className="p-1.5 bg-brand-light-purple rounded-lg text-brand-primary">
            <Keyboard size={15} />
          </div>
          <div>
            <h5 className="text-xs font-bold text-slate-800">Speed Entry</h5>
            <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">Press <kbd className="px-1 py-0.5 bg-slate-100 border rounded text-[9px]">ENTER</kbd> to add and focus the next row instantly.</p>
          </div>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-100/60 shadow-sm flex items-start gap-3">
          <div className="p-1.5 bg-brand-light-purple rounded-lg text-brand-primary">
            <Languages size={15} />
          </div>
          <div>
            <h5 className="text-xs font-bold text-slate-800">Language Support</h5>
            <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">Type color names to search or auto-create.</p>
          </div>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-100/60 shadow-sm flex items-start gap-3">
          <div className="p-1.5 bg-brand-light-purple rounded-lg text-brand-primary">
            <CloudLightning size={15} />
          </div>
          <div>
            <h5 className="text-xs font-bold text-slate-800">Draft Auto-Save</h5>
            <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">Drafts are saved locally on your device. You won't lose your work if the page reloads.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
export default DailyEntry;
