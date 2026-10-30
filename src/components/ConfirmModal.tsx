import React, { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Trash2, AlertTriangle, HelpCircle, X } from 'lucide-react';
import { useConfirmStore } from '../store/useConfirmStore';

export const ConfirmModal: React.FC = () => {
  const { isOpen, options, handleConfirm, handleCancel } = useConfirmStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleCancel]);

  const type = options.type || 'danger';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleCancel}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50"
        >
          <motion.div
            initial={{ scale: 0.94, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.94, opacity: 0, y: 15 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl border border-slate-150 shadow-2xl max-w-md w-full overflow-hidden p-6 sm:p-7 text-center relative"
          >
            {/* Close button */}
            <button
              type="button"
              onClick={handleCancel}
              className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>

            {/* Top ambient glow */}
            <div
              className={`absolute top-0 left-1/2 -translate-x-1/2 w-56 h-20 blur-xl pointer-events-none ${
                type === 'danger'
                  ? 'bg-gradient-to-b from-red-500/10 via-rose-500/5 to-transparent'
                  : type === 'warning'
                  ? 'bg-gradient-to-b from-amber-500/10 via-orange-500/5 to-transparent'
                  : 'bg-gradient-to-b from-brand-primary/10 via-sky-400/5 to-transparent'
              }`}
            />

            {/* Emblem Icon */}
            <div className="relative z-1 mb-4 flex justify-center">
              {type === 'danger' && (
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-b from-rose-50 to-red-50 border border-red-100 flex items-center justify-center shadow-xs">
                  <div className="w-11 h-11 rounded-xl bg-white border border-red-100/80 flex items-center justify-center shadow-xs">
                    <Trash2 size={20} className="text-red-500" />
                  </div>
                </div>
              )}
              {type === 'warning' && (
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-b from-amber-50 to-orange-50 border border-amber-100 flex items-center justify-center shadow-xs">
                  <div className="w-11 h-11 rounded-xl bg-white border border-amber-100/80 flex items-center justify-center shadow-xs">
                    <AlertTriangle size={20} className="text-amber-500" />
                  </div>
                </div>
              )}
              {type === 'info' && (
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-b from-sky-50 to-blue-50 border border-sky-100 flex items-center justify-center shadow-xs">
                  <div className="w-11 h-11 rounded-xl bg-white border border-sky-100/80 flex items-center justify-center shadow-xs">
                    <HelpCircle size={20} className="text-brand-primary" />
                  </div>
                </div>
              )}
            </div>

            {/* Title & Message */}
            <div className="relative z-1 mb-6">
              <h3 className="text-lg sm:text-xl font-extrabold text-slate-800 tracking-tight">
                {options.title}
              </h3>
              <p className="text-xs sm:text-[13px] text-brand-text-muted mt-2 leading-relaxed max-w-xs sm:max-w-sm mx-auto">
                {options.message}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="relative z-1 flex items-center gap-3">
              <button
                type="button"
                onClick={handleCancel}
                className="flex-1 py-2.5 sm:py-3 px-5 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-700 text-xs sm:text-sm font-bold rounded-xl shadow-xs transition-all cursor-pointer"
              >
                {options.cancelText || 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className={`flex-1 py-2.5 sm:py-3 px-5 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  type === 'danger'
                    ? 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 shadow-red-600/20'
                    : type === 'warning'
                    ? 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 shadow-amber-600/20'
                    : 'bg-gradient-to-r from-brand-primary to-brand-primary-hover shadow-brand-primary/20'
                }`}
              >
                {type === 'danger' && <Trash2 size={15} />}
                <span>{options.confirmText || 'Confirm'}</span>
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
