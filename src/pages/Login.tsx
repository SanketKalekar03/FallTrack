import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Lock, 
  Mail, 
  Sparkles, 
  ArrowRight, 
  ShieldCheck, 
  Globe,
  AlertCircle 
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import toast from 'react-hot-toast';

export const Login: React.FC = () => {
  const { signIn, signUp, error, loading, mode, clearError } = useAuthStore();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleToggleMode = () => {
    setIsSignUp(prev => !prev);
    clearError();
    setEmail('');
    setPassword('');
    setConfirmPassword('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast.error('Please fill in all fields');
      return;
    }

    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    if (isSignUp) {
      if (password !== confirmPassword) {
        toast.error('Passwords do not match');
        return;
      }
      try {
        await signUp(email, password);
        toast.success(
          mode === 'online' 
            ? 'Account created! Check your email or log in' 
            : 'Offline account created successfully!'
        );
      } catch (err: any) {
        toast.error(err.message || 'Failed to sign up');
      }
    } else {
      try {
        await signIn(email, password);
        toast.success('Successfully logged in!');
      } catch (err: any) {
        toast.error(err.message || 'Invalid credentials');
      }
    }
  };

  return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center p-4 sm:p-6 lg:p-8 font-sans selection:bg-brand-primary/20">
      {/* Container card */}
      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 100, damping: 15 }}
        className="w-full max-w-4xl bg-white rounded-2xl border border-slate-100 shadow-xl overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-[500px]"
      >
        {/* Left Side: Brand Panel */}
        <div className="md:col-span-5 bg-gradient-to-br from-brand-primary to-brand-accent p-8 text-white flex flex-col justify-between relative overflow-hidden">
          {/* Subtle watermark background */}
          <Sparkles 
            size={220} 
            className="absolute -right-16 -bottom-16 opacity-10 pointer-events-none rotate-12" 
          />
          
          <div className="z-10">
            {/* Logo */}
            <div className="flex items-center gap-2.5 mb-8">
              <img src="/logo.png" alt="FallTrack" className="w-9 h-9 rounded-xl object-contain shadow-md" />
              <span className="font-extrabold text-lg tracking-tight">FallTrack</span>
            </div>
            
            <h2 className="text-2xl font-extrabold leading-tight tracking-tight mb-4">
              Manage Saree Fall Production & Income
            </h2>
            <p className="text-white/80 text-xs font-semibold leading-relaxed">
              Track bundle counts, manage colors, monitor rates, and automate salary calculation cycles in one place.
            </p>
          </div>

          <div className="space-y-4 mt-8 md:mt-0 z-10">
            {/* Highlights */}
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center text-white shadow-sm border border-white/10 shrink-0">
                <Globe size={14} />
              </div>
              <div>
                <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-white/90">Real-Time Cloud Sync</h4>
                <p className="text-[9px] text-white/70">Access and manage your production ledger securely from any web browser.</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center text-white shadow-sm border border-white/10 shrink-0">
                <ShieldCheck size={14} />
              </div>
              <div>
                <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-white/90">Data Security</h4>
                <p className="text-[9px] text-white/70">Row Level Security (RLS) keeps your production ledger secure.</p>
              </div>
            </div>
          </div>

          {/* Footer note */}
          <div className="mt-8 md:mt-0 z-10 text-[9px] text-white/60 font-medium">
            © {new Date().getFullYear()} FallTrack App.
          </div>
        </div>

        {/* Right Side: Auth Form */}
        <div className="md:col-span-7 p-8 sm:p-10 flex flex-col justify-center relative">
          <div className="max-w-md mx-auto w-full">
            
            {/* Header */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-1.5">
                <h3 className="text-xl font-extrabold text-slate-800 tracking-tight">
                  {isSignUp ? 'Create account' : 'Welcome back'}
                </h3>
                {mode === 'offline' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-extrabold bg-amber-50 border border-amber-100 text-amber-600">
                    Offline Mode
                  </span>
                )}
              </div>
              <p className="text-xs text-brand-text-muted">
                {isSignUp 
                  ? 'Sign up to configure your production logs' 
                  : 'Sign in to access your FallTrack ledger'}
              </p>
            </div>

            {/* Error block */}
            <AnimatePresence mode="wait">
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl flex items-start gap-2.5 text-red-650"
                >
                  <AlertCircle size={15} className="shrink-0 mt-0.5" />
                  <div className="flex-1 text-[11px] font-semibold leading-normal">
                    {error}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-extrabold text-slate-455 uppercase tracking-wider">Email Address</label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full pl-9 pr-3.5 py-2 text-xs bg-slate-50/50 hover:bg-slate-50 border border-slate-200 focus:border-brand-primary focus:bg-white rounded-lg outline-none font-medium text-slate-700 shadow-sm transition-all focus:ring-3 focus:ring-brand-primary/10"
                  />
                  <Mail size={13} className="absolute left-3 top-2.5 text-slate-400" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-extrabold text-slate-455 uppercase tracking-wider">Password</label>
                <div className="relative">
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-3.5 py-2 text-xs bg-slate-50/50 hover:bg-slate-50 border border-slate-200 focus:border-brand-primary focus:bg-white rounded-lg outline-none font-medium text-slate-700 shadow-sm transition-all focus:ring-3 focus:ring-brand-primary/10"
                  />
                  <Lock size={13} className="absolute left-3 top-2.5 text-slate-400" />
                </div>
              </div>

              {isSignUp && (
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold text-slate-455 uppercase tracking-wider">Confirm Password</label>
                  <div className="relative">
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-9 pr-3.5 py-2 text-xs bg-slate-50/50 hover:bg-slate-50 border border-slate-200 focus:border-brand-primary focus:bg-white rounded-lg outline-none font-medium text-slate-700 shadow-sm transition-all focus:ring-3 focus:ring-brand-primary/10"
                    />
                    <Lock size={13} className="absolute left-3 top-2.5 text-slate-400" />
                  </div>
                </div>
              )}

              <motion.button
                type="submit"
                disabled={loading}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                className="w-full py-2 bg-brand-primary hover:bg-brand-primary-hover text-white text-xs font-bold rounded-lg shadow-md shadow-brand-primary/15 flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    {isSignUp ? 'Register Account' : 'Sign In'}
                    <ArrowRight size={13} />
                  </>
                )}
              </motion.button>
            </form>

            {/* Toggle Sign In / Sign Up */}
            <div className="mt-6 text-center">
              <button
                onClick={handleToggleMode}
                className="text-[11px] font-bold text-brand-primary hover:text-brand-primary-hover cursor-pointer transition-colors outline-none"
              >
                {isSignUp 
                  ? 'Already have an account? Sign In' 
                  : "Don't have an account? Sign Up"}
              </button>
            </div>

          </div>
        </div>

      </motion.div>
    </div>
  );
};
