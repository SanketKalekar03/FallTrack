import React from 'react';
import { Toaster, toast, resolveValue } from 'react-hot-toast';
import { Check, AlertCircle, Loader2, X, Sparkles } from 'lucide-react';

export const PremiumToaster: React.FC = () => {
  return (
    <Toaster
      position="top-right"
      gutter={10}
      containerStyle={{
        top: 70,
        right: 20,
        zIndex: 99999,
      }}
      toastOptions={{
        duration: 3500,
      }}
    >
      {(t) => (
        <div
          style={{
            opacity: t.visible ? 1 : 0,
            transform: t.visible ? 'scale(1)' : 'scale(0.96)',
            transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
          className="flex items-center gap-3 px-4 py-3 bg-white rounded-xl border border-slate-200/90 shadow-[0_10px_28px_-4px_rgba(2,132,199,0.12),0_4px_12px_-2px_rgba(15,23,42,0.06)] pointer-events-auto select-none min-w-[240px] max-w-sm"
        >
          {/* Solid Circle Icon Emblem */}
          {t.type === 'success' && (
            <div className="w-6.5 h-6.5 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-xs shadow-emerald-500/25">
              <Check size={13} strokeWidth={3} className="text-white" />
            </div>
          )}
          {t.type === 'error' && (
            <div className="w-6.5 h-6.5 rounded-full bg-red-500 text-white flex items-center justify-center shrink-0 shadow-xs shadow-red-500/25">
              <AlertCircle size={13} strokeWidth={2.5} className="text-white" />
            </div>
          )}
          {t.type === 'loading' && (
            <div className="w-6.5 h-6.5 rounded-full bg-brand-primary text-white flex items-center justify-center shrink-0 shadow-xs shadow-brand-primary/25">
              <Loader2 size={13} strokeWidth={2.5} className="text-white animate-spin" />
            </div>
          )}
          {(t.type === 'blank' || t.type === 'custom') && (
            <div className="w-6.5 h-6.5 rounded-full bg-brand-primary text-white flex items-center justify-center shrink-0 shadow-xs shadow-brand-primary/25">
              <Sparkles size={13} strokeWidth={2.5} className="text-white" />
            </div>
          )}

          {/* Toast Message Content */}
          <div className="flex-1 text-xs sm:text-[13px] font-bold text-slate-800 tracking-tight leading-snug">
            {resolveValue(t.message, t)}
          </div>

          {/* Close Dismiss Button */}
          {t.type !== 'loading' && (
            <button
              type="button"
              onClick={() => toast.dismiss(t.id)}
              className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer shrink-0 ml-1"
              aria-label="Close"
            >
              <X size={13} />
            </button>
          )}
        </div>
      )}
    </Toaster>
  );
};
export default PremiumToaster;
