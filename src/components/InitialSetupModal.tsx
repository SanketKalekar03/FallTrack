import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  User, 
  Sparkles, 
  ArrowRight, 
  AlertCircle, 
  Loader2, 
  LogOut
} from 'lucide-react';
import type { InitialSetupData } from '../types';
import { normalizeIndianMobile } from '../services/settingsService';

interface InitialSetupModalProps {
  isOpen: boolean;
  userEmail?: string;
  userName?: string;
  onComplete: (data: InitialSetupData) => Promise<void>;
  onSignOut: () => void;
}

export const InitialSetupModal: React.FC<InitialSetupModalProps> = ({
  isOpen,
  userEmail,
  userName,
  onComplete,
  onSignOut
}) => {
  // Form fields state
  const [managerName, setManagerName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [ratePerDozen, setRatePerDozen] = useState('5.00');

  // Field errors
  const [errors, setErrors] = useState<{
    managerName?: string;
    mobileNumber?: string;
    ratePerDozen?: string;
    general?: string;
  }>({});

  // Touched state for progressive validation
  const [touched, setTouched] = useState<{
    managerName?: boolean;
    mobileNumber?: boolean;
    ratePerDozen?: boolean;
  }>({});

  const [isSubmitting, setIsSubmitting] = useState(false);

  // References for focus trap & autofocus
  const modalRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Prevent escape dismissal & enforce focus trapping
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Prevent escape dismissal
        e.preventDefault();
        e.stopPropagation();
      }

      // Basic focus trap within the modal
      if (e.key === 'Tab' && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusableElements.length > 0) {
          const firstElement = focusableElements[0];
          const lastElement = focusableElements[focusableElements.length - 1];

          if (e.shiftKey && document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          } else if (!e.shiftKey && document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    // Autofocus initial input
    const timer = setTimeout(() => nameInputRef.current?.focus(), 120);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      clearTimeout(timer);
    };
  }, [isOpen]);

  // Validation function
  const validateField = (field: 'managerName' | 'mobileNumber' | 'ratePerDozen', value: string) => {
    switch (field) {
      case 'managerName': {
        const trimmed = value.trim();
        if (!trimmed) return 'Manager name is required.';
        if (trimmed.length < 2) return 'Manager name must be at least 2 characters.';
        return undefined;
      }
      case 'mobileNumber': {
        const digits = value.replace(/\D/g, '');
        if (!digits) return 'Mobile number is required.';
        if (digits.length !== 10) return 'Mobile number must be exactly 10 digits.';
        if (!/^[6-9]/.test(digits)) {
          return 'Enter a valid Indian mobile number starting with 6, 7, 8, or 9.';
        }
        return undefined;
      }
      case 'ratePerDozen': {
        const num = parseFloat(value.trim());
        if (value.trim() === '' || isNaN(num)) return 'Rate per dozen is required.';
        if (num <= 0) return 'Rate must be a positive amount greater than 0.';
        if (num > 10000) return 'Rate cannot exceed ₹10,000.00.';
        return undefined;
      }
    }
  };

  const handleBlur = (field: 'managerName' | 'mobileNumber' | 'ratePerDozen') => {
    setTouched(prev => ({ ...prev, [field]: true }));
    let val = '';
    if (field === 'managerName') val = managerName;
    if (field === 'mobileNumber') val = mobileNumber;
    if (field === 'ratePerDozen') val = ratePerDozen;

    const error = validateField(field, val);
    setErrors(prev => ({ ...prev, [field]: error }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    // Validate all fields
    const nameErr = validateField('managerName', managerName);
    const phoneErr = validateField('mobileNumber', mobileNumber);
    const rateErr = validateField('ratePerDozen', ratePerDozen);

    setTouched({
      managerName: true,
      mobileNumber: true,
      ratePerDozen: true
    });

    if (nameErr || phoneErr || rateErr) {
      setErrors({
        managerName: nameErr,
        mobileNumber: phoneErr,
        ratePerDozen: rateErr
      });
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    try {
      const cleanPhone = normalizeIndianMobile(mobileNumber);
      const cleanRate = Number(parseFloat(ratePerDozen).toFixed(2));

      await onComplete({
        managerName: managerName.trim(),
        mobileNumber: cleanPhone,
        ratePerDozen: cleanRate
      });
      // Submission successful; modal will unmount when state updates
    } catch (err: any) {
      // Preserve form values, show clear error with retry option
      setErrors(prev => ({
        ...prev,
        general: err.message || 'Failed to save configuration. Please check your network and retry.'
      }));
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/40 backdrop-blur-[2px] overflow-hidden selection:bg-brand-primary/20"
        role="dialog"
        aria-modal="true"
        aria-labelledby="setup-modal-title"
        aria-describedby="setup-modal-description"
      >
        <motion.div
          ref={modalRef}
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ type: 'spring', stiffness: 350, damping: 28 }}
          className="relative w-full max-w-md bg-white rounded-2xl sm:rounded-3xl border border-slate-100 shadow-2xl overflow-hidden my-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header Ambient Glow */}
          <div className="absolute top-0 inset-x-0 h-28 bg-gradient-to-b from-brand-primary/10 via-sky-400/5 to-transparent pointer-events-none" />

          {/* Top Banner & Title Area */}
          <div className="relative pt-4 sm:pt-5 px-5 sm:px-6 pb-2.5 sm:pb-3 border-b border-slate-100">
            <div className="flex items-center justify-between gap-3 mb-2.5">
              {/* Brand Logo & Badge */}
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-primary to-brand-accent flex items-center justify-center text-white font-black text-xs shadow-md">
                  FT
                </div>
                <div className="flex flex-col">
                  <span className="font-extrabold text-sm text-slate-800 leading-none">FallTrack</span>
                  <span className="text-[10px] font-semibold text-brand-primary tracking-wide uppercase mt-0.5">Initial Setup</span>
                </div>
              </div>

              {/* User Account & Sign out link */}
              {(userEmail || userName) && (
                <div className="flex flex-col items-end">
                  <div 
                    className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-100/90 border border-slate-200/80 rounded-md text-slate-700 text-[11px] font-bold shadow-2xs max-w-[160px] sm:max-w-[200px]"
                    title={`Logged in as: ${userName || userEmail}`}
                  >
                    <User size={11} className="text-brand-primary shrink-0" />
                    <span className="truncate">{userName || userEmail}</span>
                  </div>
                  <button
                    type="button"
                    onClick={onSignOut}
                    disabled={isSubmitting}
                    className="flex items-center gap-1 text-[10px] font-semibold text-slate-400 hover:text-rose-600 transition-colors px-1 py-0.5 rounded cursor-pointer disabled:opacity-50 mt-0.5"
                    title="Sign out to use a different account"
                  >
                    <LogOut size={11} />
                    <span>Sign out</span>
                  </button>
                </div>
              )}
            </div>

            <h1 id="setup-modal-title" className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
              Welcome to FallTrack
            </h1>
            <p id="setup-modal-description" className="text-xs text-slate-500 font-medium mt-0.5 leading-snug">
              Set up your workspace to start managing your daily saree fall records.
            </p>
          </div>

          {/* Form Content */}
          <form onSubmit={handleSubmit} noValidate className="p-4 sm:p-5 space-y-3 sm:space-y-3.5">
            {/* General Error Banner */}
            {errors.general && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-2.5 bg-red-50/80 border border-red-200/80 rounded-xl flex items-start gap-2.5 text-red-700 text-xs font-medium"
              >
                <AlertCircle size={15} className="text-red-500 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold text-red-800">Setup failed</p>
                  <p className="mt-0.5">{errors.general}</p>
                </div>
              </motion.div>
            )}

            {/* Field 1: Manager Name */}
            <div className="space-y-1">
              <label 
                htmlFor="setup-manager-name" 
                className="block text-[11px] font-bold text-slate-700 tracking-tight"
              >
                Manager Name <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <User size={15} />
                </div>
                <input
                  ref={nameInputRef}
                  id="setup-manager-name"
                  type="text"
                  value={managerName}
                  onChange={(e) => {
                    setManagerName(e.target.value);
                    if (touched.managerName) {
                      setErrors(prev => ({ ...prev, managerName: validateField('managerName', e.target.value) }));
                    }
                  }}
                  onBlur={() => handleBlur('managerName')}
                  disabled={isSubmitting}
                  placeholder="e.g. Ramesh Patil"
                  className={`w-full pl-9 pr-3.5 py-2 bg-slate-50 border rounded-xl text-xs sm:text-sm font-semibold text-slate-800 placeholder-slate-400 transition-all focus:bg-white focus:outline-none ${
                    errors.managerName 
                      ? 'border-red-300 focus:border-red-500 focus:ring-2 focus:ring-red-100' 
                      : 'border-slate-200 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/15'
                  }`}
                  aria-invalid={Boolean(errors.managerName)}
                  aria-describedby={errors.managerName ? 'setup-name-error' : undefined}
                />
              </div>
              {errors.managerName && (
                <p id="setup-name-error" className="text-[10px] font-semibold text-red-600 flex items-center gap-1 mt-0.5">
                  <AlertCircle size={11} className="shrink-0" />
                  {errors.managerName}
                </p>
              )}
            </div>

            {/* Field 2: Mobile Number */}
            <div className="space-y-1">
              <label 
                htmlFor="setup-mobile-number" 
                className="block text-[11px] font-bold text-slate-700 tracking-tight"
              >
                Mobile Number <span className="text-red-500">*</span>
              </label>
              <div className="relative flex rounded-xl border border-slate-200 overflow-hidden focus-within:border-brand-primary focus-within:ring-2 focus-within:ring-brand-primary/15 transition-all">
                <span className="inline-flex items-center px-3 bg-slate-100 border-r border-slate-200 text-slate-600 text-xs font-bold select-none shrink-0">
                  +91
                </span>
                <div className="relative flex-1">
                  <input
                    id="setup-mobile-number"
                    type="tel"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={10}
                    value={mobileNumber}
                    onKeyDown={(e) => {
                      // Allow navigation & editing keys
                      if (
                        e.key === 'Backspace' ||
                        e.key === 'Delete' ||
                        e.key === 'Tab' ||
                        e.key === 'Escape' ||
                        e.key === 'Enter' ||
                        e.key === 'ArrowLeft' ||
                        e.key === 'ArrowRight' ||
                        e.key === 'ArrowUp' ||
                        e.key === 'ArrowDown' ||
                        e.key === 'Home' ||
                        e.key === 'End'
                      ) {
                        return;
                      }
                      // Allow copy/paste/select all shortcuts
                      if (e.ctrlKey || e.metaKey) {
                        return;
                      }
                      // Block any non-digit character from being typed
                      if (!/^[0-9]$/.test(e.key)) {
                        e.preventDefault();
                      }
                    }}
                    onPaste={(e) => {
                      e.preventDefault();
                      const pasteText = e.clipboardData.getData('text');
                      const digits = pasteText
                        .replace(/\D/g, '')
                        .replace(/^91(?=[6-9]\d{9}$)/, '')
                        .replace(/^0(?=[6-9]\d{9}$)/, '')
                        .slice(0, 10);
                      setMobileNumber(digits);
                      if (touched.mobileNumber) {
                        setErrors(prev => ({ ...prev, mobileNumber: validateField('mobileNumber', digits) }));
                      }
                    }}
                    onChange={(e) => {
                      // Strictly digits only, capped at 10 digits
                      const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                      setMobileNumber(digits);
                      if (touched.mobileNumber) {
                        setErrors(prev => ({ ...prev, mobileNumber: validateField('mobileNumber', digits) }));
                      }
                    }}
                    onBlur={() => handleBlur('mobileNumber')}
                    disabled={isSubmitting}
                    placeholder="9876543210"
                    className="w-full px-3 py-2 bg-slate-50 text-xs sm:text-sm font-semibold text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none tracking-wide"
                    aria-invalid={Boolean(errors.mobileNumber)}
                    aria-describedby={errors.mobileNumber ? 'setup-phone-error' : undefined}
                  />
                </div>
              </div>
              {errors.mobileNumber ? (
                <p id="setup-phone-error" className="text-[10px] font-semibold text-red-600 flex items-center gap-1 mt-0.5">
                  <AlertCircle size={11} className="shrink-0" />
                  {errors.mobileNumber}
                </p>
              ) : (
                <p className="text-[10px] font-medium text-slate-400">
                  Standard 10-digit Indian mobile number (digits only, e.g. 9876543210).
                </p>
              )}
            </div>

            {/* Field 3: Rate per Dozen */}
            <div className="space-y-1">
              <label 
                htmlFor="setup-rate-per-dozen" 
                className="block text-[11px] font-bold text-slate-700 tracking-tight"
              >
                Rate per Dozen (₹) <span className="text-red-500">*</span>
              </label>
              <div className="relative flex items-center rounded-xl border border-slate-200 overflow-hidden focus-within:border-brand-primary focus-within:ring-2 focus-within:ring-brand-primary/15 transition-all bg-slate-50 focus-within:bg-white">
                <span className="inline-flex items-center self-stretch px-3 bg-slate-100 border-r border-slate-200 text-slate-700 text-xs sm:text-sm font-extrabold select-none shrink-0">
                  ₹
                </span>
                <input
                  id="setup-rate-per-dozen"
                  type="number"
                  step="0.05"
                  min="0.10"
                  max="10000"
                  value={ratePerDozen}
                  onChange={(e) => {
                    setRatePerDozen(e.target.value);
                    if (touched.ratePerDozen) {
                      setErrors(prev => ({ ...prev, ratePerDozen: validateField('ratePerDozen', e.target.value) }));
                    }
                  }}
                  onBlur={() => handleBlur('ratePerDozen')}
                  disabled={isSubmitting}
                  placeholder="5.00"
                  className="flex-1 min-w-0 px-3 py-2 bg-transparent text-xs sm:text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none"
                  aria-invalid={Boolean(errors.ratePerDozen)}
                  aria-describedby={errors.ratePerDozen ? 'setup-rate-error' : 'setup-rate-hint'}
                />
                <span className="inline-flex items-center self-stretch px-3 text-slate-400 text-xs font-semibold select-none whitespace-nowrap shrink-0">
                  / dozen
                </span>
              </div>
              {errors.ratePerDozen ? (
                <p id="setup-rate-error" className="text-[10px] font-semibold text-red-600 flex items-center gap-1 mt-0.5">
                  <AlertCircle size={11} className="shrink-0" />
                  {errors.ratePerDozen}
                </p>
              ) : (
                <div id="setup-rate-hint" className="py-1 px-2 rounded-lg bg-sky-50/70 border border-sky-100/70 flex items-center gap-1.5 mt-1">
                  <Sparkles size={12} className="text-brand-primary shrink-0" />
                  <p className="text-[10px] text-slate-600 font-medium leading-none">
                    <strong className="text-slate-700">Formula:</strong> 12 falls = 1 dozen. <span className="text-slate-500">(Falls ÷ 12) × </span><span className="font-mono text-brand-primary font-bold">₹{parseFloat(ratePerDozen || '0') > 0 ? parseFloat(ratePerDozen).toFixed(2) : '5.00'}</span>
                  </p>
                </div>
              )}
            </div>

            {/* Submit Action Button */}
            <div className="pt-1">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-brand-primary to-brand-primary-hover hover:from-brand-primary-hover hover:to-sky-700 text-white font-extrabold text-xs sm:text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    <span>Configuring Workspace...</span>
                  </>
                ) : (
                  <>
                    <span>Complete Setup & Continue</span>
                    <ArrowRight size={15} />
                  </>
                )}
              </button>
            </div>

            {/* Non-dismissible notice footer */}
            <p className="text-center text-[10px] font-medium text-slate-400">
              Setup is required once to personalize your workspace & calculate piece-rate earnings accurately.
            </p>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
