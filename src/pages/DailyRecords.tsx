import React, { useEffect, useState } from 'react';
import { 
  Search, 
  Trash2, 
  Edit2, 
  Download, 
  Printer, 
  ChevronLeft, 
  ChevronRight, 
  X, 
  Check, 
  Filter,
  Calendar,
  Copy
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { useProductionStore } from '../store/useProductionStore';
import { useRateStore } from '../store/useRateStore';
import { useColorStore } from '../store/useColorStore';
import type { ProductionEntry } from '../types';
import { exportEntriesToCSV } from '../utils/csvExport';
import { exportEntriesToPDF } from '../utils/pdfExport';
import { MarathiColorSelect } from '../components/MarathiColorSelect';
import { productionEntrySchema } from '../schemas/validation';

export const DailyRecords: React.FC = () => {
  const { 
    entries, 
    fetchEntries, 
    filters, 
    setFilters, 
    resetFilters, 
    updateEntry, 
    deleteEntry, 
    loading 
  } = useProductionStore();
  const { getActiveRateForDate, fetchRates } = useRateStore();
  const { fetchColors } = useColorStore();

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  // Edit Modal states
  const [editingEntry, setEditingEntry] = useState<ProductionEntry | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editColorId, setEditColorId] = useState('');
  const [editQuantityStr, setEditQuantityStr] = useState('');
  const [editErrors, setEditErrors] = useState<{ colorId?: string; quantity?: string }>({});

  // Quick filters state
  const [activePill, setActivePill] = useState<'all' | 'today' | 'month'>('all');

  const getLocalDateString = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const todayStr = getLocalDateString();
  const currentMonthStr = todayStr.substring(0, 7);

  // Local filter states before applying
  const [localSearch, setLocalSearch] = useState(filters.search);
  const [localStartDate, setLocalStartDate] = useState(filters.startDate);
  const [localEndDate, setLocalEndDate] = useState(filters.endDate);
  const [localMonth, setLocalMonth] = useState(filters.month);
  const [localYear, setLocalYear] = useState(filters.year);

  useEffect(() => {
    fetchEntries();
    fetchRates();
    fetchColors();
  }, [fetchEntries, fetchRates, fetchColors]);

  // Sync local filters with store filters on load
  useEffect(() => {
    setLocalSearch(filters.search);
    setLocalStartDate(filters.startDate);
    setLocalEndDate(filters.endDate);
    setLocalMonth(filters.month);
    setLocalYear(filters.year);
  }, [filters]);

  const handleApplyFilters = () => {
    setFilters({
      search: localSearch,
      startDate: localStartDate,
      endDate: localEndDate,
      month: localMonth,
      year: localYear
    });
    
    // Auto-select quick pill if match
    if (localStartDate === todayStr && localEndDate === todayStr) {
      setActivePill('today');
    } else if (localMonth === currentMonthStr && !localStartDate && !localEndDate) {
      setActivePill('month');
    } else if (!localStartDate && !localEndDate && !localMonth) {
      setActivePill('all');
    } else {
      setActivePill('all');
    }

    setCurrentPage(1); // Reset to page 1
    setTimeout(() => {
      fetchEntries();
    }, 50);
  };

  const handleResetFilters = () => {
    resetFilters();
    setLocalSearch('');
    setLocalStartDate('');
    setLocalEndDate('');
    setLocalMonth('');
    setLocalYear(new Date().getFullYear().toString());
    setActivePill('all');
    setCurrentPage(1);
    setTimeout(() => {
      fetchEntries();
    }, 50);
  };

  const handlePillClick = (pill: 'all' | 'today' | 'month') => {
    setActivePill(pill);
    if (pill === 'all') {
      resetFilters();
      setLocalStartDate('');
      setLocalEndDate('');
      setLocalMonth('');
      setLocalYear(new Date().getFullYear().toString());
    } else if (pill === 'today') {
      setFilters({
        search: localSearch,
        startDate: todayStr,
        endDate: todayStr,
        month: '',
        year: new Date().getFullYear().toString()
      });
      setLocalStartDate(todayStr);
      setLocalEndDate(todayStr);
      setLocalMonth('');
    } else if (pill === 'month') {
      setFilters({
        search: localSearch,
        startDate: '',
        endDate: '',
        month: currentMonthStr,
        year: new Date().getFullYear().toString()
      });
      setLocalStartDate('');
      setLocalEndDate('');
      setLocalMonth(currentMonthStr);
    }
    setCurrentPage(1);
    setTimeout(() => {
      fetchEntries();
    }, 50);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this record?")) {
      try {
        await deleteEntry(id);
        toast.success("Record deleted successfully!");
      } catch (err: any) {
        toast.error(`Error deleting record: ${err.message}`);
      }
    }
  };

  const handleCopyGroup = (groupEntries: ProductionEntry[]) => {
    try {
      const text = groupEntries
        .map(e => `${e.color?.name || 'Unspecified'} ${e.quantity}`)
        .join('\n');
      navigator.clipboard.writeText(text);
      toast.success("Daily record copied!");
    } catch (err) {
      console.warn("Clipboard copy failed:", err);
    }
  };

  const handleOpenEdit = (entry: ProductionEntry) => {
    setEditingEntry(entry);
    setEditDate(entry.entry_date);
    setEditColorId(entry.color_id);
    setEditQuantityStr(entry.quantity.toString());
    setEditErrors({});
  };

  const handleCloseEdit = () => {
    setEditingEntry(null);
  };

  const handleSaveEdit = async () => {
    if (!editingEntry) return;

    const qty = parseInt(editQuantityStr, 10);
    const result = productionEntrySchema.safeParse({
      entry_date: editDate,
      color_id: editColorId,
      quantity: qty
    });

    if (!result.success) {
      const fieldErrors = result.error.flatten().fieldErrors;
      setEditErrors({
        colorId: fieldErrors.color_id?.[0],
        quantity: fieldErrors.quantity?.[0]
      });
      toast.error("Please correct the validation errors.");
      return;
    }

    try {
      await updateEntry(editingEntry.id, {
        entry_date: editDate,
        color_id: editColorId,
        quantity: qty
      });
      toast.success("Record updated successfully!");
      handleCloseEdit();
    } catch (err: any) {
      toast.error(`Error updating record: ${err.message}`);
    }
  };

  // Group all filtered entries by date
  const groupedByDate: { [dateStr: string]: ProductionEntry[] } = {};
  entries.forEach((entry) => {
    if (!groupedByDate[entry.entry_date]) {
      groupedByDate[entry.entry_date] = [];
    }
    groupedByDate[entry.entry_date].push(entry);
  });
  const sortedDates = Object.keys(groupedByDate).sort((a, b) => b.localeCompare(a));

  // Pagination calculation by days
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentDates = sortedDates.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(sortedDates.length / itemsPerPage);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  // Export handlers
  const handleExportCSV = () => {
    if (entries.length === 0) {
      toast.error("No data to export.");
      return;
    }
    exportEntriesToCSV(entries, getActiveRateForDate);
    toast.success("CSV Downloaded!");
  };

  const handleExportPDF = () => {
    if (entries.length === 0) {
      toast.error("No data to export.");
      return;
    }
    exportEntriesToPDF(entries, getActiveRateForDate, 'FallTrack Historical Entries');
    toast.success("PDF Downloaded!");
  };

  // Dynamic filter values
  const yearsList = Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - i).toString());
  const monthsList = [
    { value: '01', name: 'January' },
    { value: '02', name: 'February' },
    { value: '03', name: 'March' },
    { value: '04', name: 'April' },
    { value: '05', name: 'May' },
    { value: '06', name: 'June' },
    { value: '07', name: 'July' },
    { value: '08', name: 'August' },
    { value: '09', name: 'September' },
    { value: '10', name: 'October' },
    { value: '11', name: 'November' },
    { value: '12', name: 'December' },
  ];

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
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <div className="space-y-4">
      {/* Search & Filter Card */}
      <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-100 shadow-soft">
        <h3 className="text-[10px] font-extrabold text-slate-450 uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <Filter size={13} className="text-brand-primary" /> Search Filters
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Start Date */}
          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-extrabold text-slate-450 uppercase tracking-wider">Start Date</label>
            <input
              type="date"
              value={localStartDate}
              onChange={(e) => {
                setLocalStartDate(e.target.value);
                setLocalMonth(''); // Clear month if specific dates are chosen
              }}
              className="px-3 py-1.5 bg-white border border-slate-200 focus:border-brand-primary focus:ring-3 focus:ring-brand-primary/10 rounded-lg text-xs font-semibold outline-none text-slate-700 shadow-sm transition-all"
            />
          </div>

          {/* End Date */}
          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-extrabold text-slate-450 uppercase tracking-wider">End Date</label>
            <input
              type="date"
              value={localEndDate}
              onChange={(e) => {
                setLocalEndDate(e.target.value);
                setLocalMonth(''); // Clear month if specific dates are chosen
              }}
              className="px-3 py-1.5 bg-white border border-slate-200 focus:border-brand-primary focus:ring-3 focus:ring-brand-primary/10 rounded-lg text-xs font-semibold outline-none text-slate-700 shadow-sm transition-all"
            />
          </div>

          {/* Month Picker */}
          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-extrabold text-slate-450 uppercase tracking-wider">Month</label>
            <select
              value={localMonth ? localMonth.split('-')[1] : ''}
              onChange={(e) => {
                const val = e.target.value;
                if (val) {
                  setLocalMonth(`${localYear}-${val}`);
                  setLocalStartDate(''); // Clear custom date range
                  setLocalEndDate('');
                } else {
                  setLocalMonth('');
                }
              }}
              className="px-3 py-1.5 bg-white border border-slate-200 focus:border-brand-primary focus:ring-3 focus:ring-brand-primary/10 rounded-lg text-xs font-semibold outline-none text-slate-700 shadow-sm transition-all"
            >
              <option value="">Select Month</option>
              {monthsList.map(m => (
                <option key={m.value} value={m.value}>{m.name}</option>
              ))}
            </select>
          </div>

          {/* Year Picker */}
          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-extrabold text-slate-450 uppercase tracking-wider">Year</label>
            <select
              value={localYear}
              onChange={(e) => {
                const val = e.target.value;
                setLocalYear(val);
                // If a month was selected, update its year component as well
                if (localMonth) {
                  const currentM = localMonth.split('-')[1];
                  setLocalMonth(`${val}-${currentM}`);
                }
              }}
              className="px-3 py-1.5 bg-white border border-slate-200 focus:border-brand-primary focus:ring-3 focus:ring-brand-primary/10 rounded-lg text-xs font-semibold outline-none text-slate-700 shadow-sm transition-all"
            >
              {yearsList.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {/* Search Input */}
          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-extrabold text-slate-450 uppercase tracking-wider">Search Color</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Search color..."
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                className="w-full px-3 py-1.5 pl-8 bg-white border border-slate-200 focus:border-brand-primary focus:ring-3 focus:ring-brand-primary/10 rounded-lg text-xs font-semibold outline-none text-slate-700 shadow-sm transition-all"
              />
              <Search size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
            </div>
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2 border-t border-slate-100 pt-3">
          <button
            onClick={handleResetFilters}
            className="px-3.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-700 text-xs font-bold rounded-lg shadow-sm transition-all duration-200 cursor-pointer"
          >
            Clear Filters
          </button>
          
          <button
            onClick={handleApplyFilters}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-brand-primary hover:bg-brand-primary-hover text-white text-xs font-bold rounded-lg shadow-md shadow-brand-primary/15 transition-all duration-200 cursor-pointer"
          >
            Apply Filters
          </button>
        </div>
      </div>

      {/* Results Table Card */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-soft overflow-hidden">
        {/* Table Header Controls */}
        <div className="px-4 py-3 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-50/50">
          <div>
            <h4 className="text-sm font-bold text-slate-800">History Records</h4>
            <p className="text-[10px] text-brand-text-muted mt-0.5">Showing saved production entries</p>
          </div>

          <div className="flex gap-2 w-full sm:w-auto">
            <button
              onClick={handleExportCSV}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 text-[11px] font-bold rounded-lg shadow-sm transition-all duration-200 cursor-pointer"
            >
              <Download size={13} className="text-slate-455" /> Export CSV
            </button>
            <button
              onClick={handleExportPDF}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 text-[11px] font-bold rounded-lg shadow-sm transition-all duration-200 cursor-pointer"
            >
              <Printer size={13} className="text-slate-455" /> Print
            </button>
          </div>
        </div>

        {/* Quick Filter Pills */}
        <div className="px-4 py-2.5 bg-slate-50/20 border-b border-slate-100 flex flex-wrap gap-2 items-center">
          <span className="text-[9px] font-extrabold text-slate-450 uppercase tracking-wider mr-1">Quick Filters</span>
          <button
            onClick={() => handlePillClick('all')}
            className={`px-3 py-0.5 rounded-full text-[10px] font-bold transition-all border cursor-pointer ${
              activePill === 'all'
                ? 'bg-brand-primary text-white border-brand-primary shadow-sm shadow-brand-primary/15'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
            }`}
          >
            All Logs
          </button>
          <button
            onClick={() => handlePillClick('today')}
            className={`px-3 py-0.5 rounded-full text-[10px] font-bold transition-all border cursor-pointer ${
              activePill === 'today'
                ? 'bg-brand-primary text-white border-brand-primary shadow-sm shadow-brand-primary/15'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
            }`}
          >
            Today
          </button>
          <button
            onClick={() => handlePillClick('month')}
            className={`px-3 py-0.5 rounded-full text-[10px] font-bold transition-all border cursor-pointer ${
              activePill === 'month'
                ? 'bg-brand-primary text-white border-brand-primary shadow-sm shadow-brand-primary/15'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
            }`}
          >
            This Month
          </button>
        </div>

        {/* Cards Grid Content */}
        <div className="bg-slate-50/15 border-t border-slate-100">
          {loading ? (
            <div className="px-5 py-12 text-center text-xs text-slate-400 font-medium">
              Loading records...
            </div>
          ) : sortedDates.length === 0 ? (
            <div className="px-5 py-12 text-center text-xs text-slate-400 font-medium bg-white">
              No production logs found matching the filters.
            </div>
          ) : (
            <motion.div 
              variants={containerVariants}
              initial="hidden"
              animate="show"
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4"
            >
              {currentDates.map((dateStr) => {
                const dayEntries = groupedByDate[dateStr];
                const dayTotalFalls = dayEntries.reduce((sum, e) => sum + e.quantity, 0);

                return (
                  <motion.div 
                    key={dateStr} 
                    variants={itemVariants}
                    whileHover={{ 
                      y: -4, 
                      boxShadow: "0 10px 25px -5px rgba(92, 62, 163, 0.08), 0 8px 16px -4px rgba(92, 62, 163, 0.05)"
                    }}
                    className="bg-white rounded-xl border border-slate-100 shadow-soft p-4 flex flex-col justify-between transition-all duration-200"
                  >
                    <div>
                      {/* Card Header */}
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-brand-light-purple flex items-center justify-center shrink-0 text-brand-primary border border-brand-primary/5">
                            <Calendar size={13} />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <h5 className="text-xs font-extrabold text-slate-800">
                                {new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </h5>
                              <button
                                onClick={() => handleCopyGroup(dayEntries)}
                                className="p-0.5 hover:bg-slate-100 text-slate-400 hover:text-brand-primary rounded transition-all cursor-pointer flex items-center justify-center"
                                title="Copy day summary"
                              >
                                <Copy size={11} />
                              </button>
                            </div>
                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block mt-0.5">Production Date</span>
                          </div>
                        </div>
                        
                        <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-extrabold bg-brand-light-purple/60 border border-brand-primary/10 text-brand-primary shadow-sm">
                          {dayTotalFalls.toLocaleString()} Falls
                        </span>
                      </div>

                      {/* Divider */}
                      <div className="border-b border-slate-100 my-3" />

                      {/* Color Entries List */}
                      <div className="space-y-2">
                        {dayEntries.map((entry) => (
                          <div 
                            key={entry.id} 
                            className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-b-0 group"
                          >
                            <span className="text-xs font-bold text-slate-700">
                              {entry.color?.name || 'Unspecified'}
                            </span>

                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-extrabold text-slate-500 bg-slate-100/70 border border-slate-200/40 px-1.5 py-0.5 rounded-md">
                                {entry.quantity.toLocaleString()}
                              </span>
                              
                              <div className="flex items-center gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => handleOpenEdit(entry)}
                                  className="p-1 hover:bg-slate-100 text-slate-400 hover:text-brand-primary rounded transition-all cursor-pointer"
                                  title="Edit"
                                >
                                  <Edit2 size={11} />
                                </button>
                                <button
                                  onClick={() => handleDelete(entry.id)}
                                  className="p-1 hover:bg-red-50 text-slate-400 hover:text-red-650 rounded transition-all cursor-pointer"
                                  title="Delete"
                                >
                                  <Trash2 size={11} />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </div>

        {/* Pagination Footer */}
        {sortedDates.length > 0 && (
          <div className="bg-slate-50/70 px-4 py-2.5 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4">
            <span className="text-xs text-slate-400 font-medium">
              Showing <span className="font-semibold text-slate-700">{indexOfFirstItem + 1}</span> to{' '}
              <span className="font-semibold text-slate-700">{Math.min(indexOfLastItem, sortedDates.length)}</span> of{' '}
              <span className="font-semibold text-slate-700">{sortedDates.length}</span> days
            </span>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-1 border border-slate-200 hover:bg-slate-50 rounded-lg transition-all disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer"
              >
                <ChevronLeft size={12} />
              </button>
              
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                const isActive = page === currentPage;
                return (
                  <button
                    key={page}
                    onClick={() => handlePageChange(page)}
                    className={`w-6 h-6 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      isActive 
                        ? 'bg-brand-primary text-white shadow-sm shadow-brand-primary/10' 
                        : 'border border-slate-200 hover:bg-slate-50 text-slate-650'
                    }`}
                  >
                    {page}
                  </button>
                );
              })}

              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="p-1 border border-slate-200 hover:bg-slate-50 rounded-lg transition-all disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer"
              >
                <ChevronRight size={12} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Edit Entry Modal */}
      <AnimatePresence>
        {editingEntry && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              transition={{ type: 'spring', stiffness: 400, damping: 28 }}
              className="bg-white rounded-xl border border-slate-100 shadow-xl max-w-sm w-full overflow-hidden"
            >
              <div className="px-4 py-2.5 border-b border-slate-100 flex justify-between items-center bg-brand-light-purple/20">
                <h4 className="text-xs font-extrabold text-brand-primary uppercase tracking-wider">Edit Production Entry</h4>
                <button 
                  onClick={handleCloseEdit}
                  className="p-1 rounded-lg hover:bg-slate-150 transition-colors text-slate-400 cursor-pointer"
                >
                  <X size={15} />
                </button>
              </div>

              <div className="p-4 space-y-3">
                {/* Date */}
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-extrabold text-slate-450 uppercase tracking-wider">Entry Date</label>
                  <input
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="px-3 py-1.5 bg-white border border-slate-200 focus:border-brand-primary focus:ring-3 focus:ring-brand-primary/10 rounded-lg text-xs font-semibold outline-none text-slate-700 shadow-sm transition-all"
                  />
                </div>

                {/* Color Selector */}
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-extrabold text-slate-455 uppercase tracking-wider">Color</label>
                  <MarathiColorSelect
                    selectedColorId={editColorId}
                    onSelect={(cid) => {
                      setEditColorId(cid);
                      setEditErrors(prev => ({ ...prev, colorId: undefined }));
                    }}
                    error={editErrors.colorId}
                    placeholder="Search or add color"
                  />
                </div>

                {/* Quantity */}
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-extrabold text-slate-455 uppercase tracking-wider">Falls Count</label>
                  <input
                    type="number"
                    value={editQuantityStr}
                    onChange={(e) => {
                      setEditQuantityStr(e.target.value);
                      setEditErrors(prev => ({ ...prev, quantity: undefined }));
                    }}
                    className={`px-3 py-1.5 bg-white border rounded-lg text-xs font-bold outline-none text-slate-700 shadow-sm transition-all duration-200 ${
                      editErrors.quantity 
                        ? 'border-red-300 focus:border-red-500 focus:ring-3 focus:ring-red-500/10' 
                        : 'border-slate-200 focus:border-brand-primary focus:ring-3 focus:ring-brand-primary/10'
                    }`}
                  />
                  {editErrors.quantity && (
                    <span className="text-[10px] text-red-500 font-medium">
                      {editErrors.quantity}
                    </span>
                  )}
                </div>
              </div>

              <div className="px-4 py-2.5 bg-slate-50/50 border-t border-slate-100 flex justify-end gap-2">
                <button
                  onClick={handleCloseEdit}
                  className="px-3.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-350 text-slate-700 text-xs font-bold rounded-lg shadow-sm transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-brand-primary hover:bg-brand-primary-hover text-white text-xs font-bold rounded-lg shadow-md shadow-brand-primary/15 transition-all duration-200 cursor-pointer"
                >
                  <Check size={13} /> Save Changes
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
export default DailyRecords;
