import React, { useEffect, useState } from 'react';
import { Palette, Plus, Search, Edit2, Trash2, X, Check } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { useColorStore } from '../store/useColorStore';
import { useProductionStore } from '../store/useProductionStore';
import type { Color } from '../types';
import { matchColor, isExactColorMatch } from '../utils/transliterate';
import { confirmDialog } from '../store/useConfirmStore';

export const ColorManagement: React.FC = () => {
  const { colors, fetchColors, addColor, updateColor, deleteColor, loading } = useColorStore();
  const { entries, fetchEntries } = useProductionStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newColorName, setNewColorName] = useState('');
  const [editingColor, setEditingColor] = useState<Color | null>(null);
  const [editColorName, setEditColorName] = useState('');

  useEffect(() => {
    fetchColors();
    fetchEntries();
  }, [fetchColors, fetchEntries]);

  // Filtered colors list
  const filteredColors = colors.filter(c => 
    matchColor(c.name, searchQuery)
  );

  // Helper to count how many entries use a given color
  const getColorUsageCount = (colorId: string) => {
    return entries.filter(e => e.color_id === colorId).length;
  };

  const handleAddColor = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newColorName.trim();
    if (!name) {
      toast.error("Please enter a color name.");
      return;
    }

    // Check if color name already exists (case insensitive or transliterated)
    const exists = colors.some(c => isExactColorMatch(c.name, name));
    if (exists) {
      toast.error("This color already exists.");
      return;
    }

    try {
      await addColor(name);
      toast.success("Color added successfully!");
      setNewColorName('');
      setIsAddModalOpen(false);
    } catch (err: any) {
      toast.error(`Error adding color: ${err.message}`);
    }
  };

  const handleOpenEdit = (color: Color) => {
    setEditingColor(color);
    setEditColorName(color.name);
  };

  const handleSaveEdit = async () => {
    const name = editColorName.trim();
    if (!editingColor) return;
    if (!name) {
      toast.error("Please enter a color name.");
      return;
    }

    // Check duplicate color names (excluding current, case insensitive or transliterated)
    const exists = colors.some(c => c.id !== editingColor.id && isExactColorMatch(c.name, name));
    if (exists) {
      toast.error("This color name already exists.");
      return;
    }

    try {
      await updateColor(editingColor.id, name);
      toast.success("Color updated successfully!");
      setEditingColor(null);
    } catch (err: any) {
      toast.error(`Error updating color: ${err.message}`);
    }
  };

  const handleDelete = async (color: Color) => {
    const usageCount = getColorUsageCount(color.id);
    if (usageCount > 0) {
      toast.error(
        `This color cannot be deleted as it is used in ${usageCount} production logs.`
      );
      return;
    }

    const confirmed = await confirmDialog({
      title: "Delete Saree Color",
      message: `Are you sure you want to delete "${color.name}"? This color will be permanently removed.`,
      confirmText: "Delete Color",
      type: "danger"
    });
    if (!confirmed) return;

    try {
      await deleteColor(color.id);
      toast.success("Color deleted successfully!");
    } catch (err: any) {
      toast.error(`Error deleting color: ${err.message}`);
    }
  };

  // Framer Motion Variants
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.03
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <div className="space-y-4">
      {/* Header Panel */}
      <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-100 shadow-soft flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Palette size={15} className="text-brand-primary" />
            Color Management
          </h3>
          <p className="text-[10px] text-brand-text-muted mt-0.5">Manage, add, search, and edit saree fall colors in the system</p>
        </div>

        <motion.button
          onClick={() => setIsAddModalOpen(true)}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="flex items-center justify-center gap-1.5 px-4 py-1.5 bg-brand-primary hover:bg-brand-primary-hover text-white text-xs font-bold rounded-lg shadow-md shadow-brand-primary/15 transition-all cursor-pointer w-full sm:w-auto"
        >
          <Plus size={13} /> Add New Color
        </motion.button>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-100 shadow-soft flex items-center gap-2 max-w-sm">
        <div className="relative w-full">
          <input
            type="text"
            placeholder="Search color..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-1.5 pl-8 bg-white border border-slate-200 focus:border-brand-primary focus:ring-3 focus:ring-brand-primary/10 rounded-lg text-xs font-semibold outline-none text-slate-700 shadow-sm transition-all"
          />
          <Search size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
        </div>
      </div>

      {/* Colors Grid */}
      <div className="bg-slate-50/15 border border-slate-100/70 rounded-xl p-4">
        {loading && colors.length === 0 ? (
          <div className="text-center py-12 text-xs text-slate-400 font-medium">
            Loading colors...
          </div>
        ) : filteredColors.length === 0 ? (
          <div className="text-center py-12 text-xs text-slate-400 font-medium bg-white rounded-xl border">
            No colors found matching the search query.
          </div>
        ) : (
          <motion.div 
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3"
          >
            {filteredColors.map((color) => {
              const usageCount = getColorUsageCount(color.id);
              return (
                <motion.div
                  key={color.id}
                  variants={itemVariants}
                  whileHover={{ 
                    y: -3, 
                    boxShadow: "0 8px 20px -2px rgba(92, 62, 163, 0.08), 0 2px 10px -1px rgba(92, 62, 163, 0.06)",
                    borderColor: "rgba(92, 62, 163, 0.2)"
                  }}
                  className="bg-white p-3.5 rounded-xl border border-slate-100 shadow-soft flex items-center justify-between transition-colors duration-200"
                >
                  <div className="min-w-0">
                    <span className="text-xs font-extrabold text-slate-800 block truncate">
                      {color.name}
                    </span>
                    <span className={`inline-flex items-center gap-1 mt-1 text-[9px] font-bold px-1.5 py-0.5 rounded-md ${
                      usageCount > 0 
                        ? 'bg-emerald-50 text-emerald-600 border border-emerald-100/50' 
                        : 'bg-slate-50 text-slate-450 border border-slate-100'
                    }`}>
                      {usageCount} logs
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEdit(color)}
                      className="p-1 hover:bg-slate-100 text-slate-400 hover:text-brand-primary rounded transition-all cursor-pointer"
                      title="Edit Color Name"
                    >
                      <Edit2 size={12} />
                    </button>
                    <button
                      onClick={() => handleDelete(color)}
                      className={`p-1 rounded transition-all cursor-pointer ${
                        usageCount > 0
                          ? 'text-slate-200 cursor-not-allowed'
                          : 'hover:bg-red-50 text-slate-400 hover:text-red-650'
                      }`}
                      title={usageCount > 0 ? "Cannot delete color in use" : "Delete Color"}
                      disabled={usageCount > 0}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </div>

      {/* Add Color Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
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
              <form onSubmit={handleAddColor}>
                <div className="px-4 py-2.5 border-b border-slate-100 flex justify-between items-center bg-brand-light-purple/20">
                  <h4 className="text-xs font-extrabold text-brand-primary uppercase tracking-wider">Add New Color</h4>
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="p-1 rounded-lg hover:bg-slate-150 transition-colors text-slate-400 cursor-pointer"
                  >
                    <X size={15} />
                  </button>
                </div>

                <div className="p-4 space-y-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-extrabold text-slate-455 uppercase tracking-wider">Color Name</label>
                    <input
                      type="text"
                      value={newColorName}
                      onChange={(e) => setNewColorName(e.target.value)}
                      placeholder="e.g. Red, Yellow, Blue"
                      className="px-3 py-1.5 bg-white border border-slate-200 focus:border-brand-primary focus:ring-3 focus:ring-brand-primary/10 rounded-lg text-xs font-semibold outline-none text-slate-700 shadow-sm transition-all"
                      autoFocus
                    />
                  </div>
                </div>

                <div className="px-4 py-2.5 bg-slate-50/50 border-t border-slate-100 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-3.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-55 hover:border-slate-300 text-slate-700 text-xs font-bold rounded-lg shadow-sm transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex items-center gap-1.5 px-4 py-1.5 bg-brand-primary hover:bg-brand-primary-hover text-white text-xs font-bold rounded-lg shadow-md shadow-brand-primary/15 transition-all duration-200 cursor-pointer"
                  >
                    <Check size={13} /> Add Color
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Color Modal */}
      <AnimatePresence>
        {editingColor && (
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
                <h4 className="text-xs font-extrabold text-brand-primary uppercase tracking-wider">Edit Color Name</h4>
                <button
                  onClick={() => setEditingColor(null)}
                  className="p-1 rounded-lg hover:bg-slate-150 transition-colors text-slate-400 cursor-pointer"
                >
                  <X size={15} />
                </button>
              </div>

              <div className="p-4 space-y-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-extrabold text-slate-455 uppercase tracking-wider">Color Name</label>
                  <input
                    type="text"
                    value={editColorName}
                    onChange={(e) => setEditColorName(e.target.value)}
                    className="px-3 py-1.5 bg-white border border-slate-200 focus:border-brand-primary focus:ring-3 focus:ring-brand-primary/10 rounded-lg text-xs font-semibold outline-none text-slate-700 shadow-sm transition-all"
                    autoFocus
                  />
                </div>
              </div>

              <div className="px-4 py-2.5 bg-slate-50/50 border-t border-slate-100 flex justify-end gap-2">
                <button
                  onClick={() => setEditingColor(null)}
                  className="px-3.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-55 hover:border-slate-350 text-slate-700 text-xs font-bold rounded-lg shadow-sm transition-all cursor-pointer"
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
export default ColorManagement;
