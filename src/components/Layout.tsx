import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  PenSquare, 
  History, 
  BarChart3, 
  IndianRupee, 
  Settings as SettingsIcon, 
  Menu, 
  X,
  Palette,
  Coins,
  LogOut
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuthStore } from '../store/useAuthStore';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  appName: string;
  profileName: string;
  profilePhone: string;
}

export const Layout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab, appName, profileName, profilePhone }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const { signOut, user } = useAuthStore();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'daily-entry', label: 'Daily Entry', icon: PenSquare },
    { id: 'history', label: 'Production History', icon: History },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
    { id: 'income', label: 'Income Tracker', icon: Coins },
    { id: 'rates', label: 'Rate Management', icon: IndianRupee },
    { id: 'colors', label: 'Color Management', icon: Palette },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
  ];

  const handleNavClick = (tabId: string) => {
    setActiveTab(tabId);
    setMobileMenuOpen(false);
  };

  // Convert tab ID to display title
  const getPageTitle = () => {
    switch (activeTab) {
      case 'dashboard': return 'Dashboard';
      case 'daily-entry': return 'Daily Production Entry';
      case 'history': return 'Daily Records';
      case 'reports': return 'Reports';
      case 'income': return 'Income Tracker';
      case 'rates': return 'Rate Management';
      case 'colors': return 'Color Management';
      case 'settings': return 'Settings';
      default: return 'FallTrack';
    }
  };

  const getPageSubtitle = () => {
    switch (activeTab) {
      case 'dashboard': return `Welcome back, ${profileName || 'Manager'}`;
      case 'daily-entry': return 'Efficiently log daily fall counts by color.';
      case 'history': return 'Viewing saved production logs';
      case 'reports': return 'Detailed performance and income analytics.';
      case 'income': return 'Manage custom production payment and billing cycles.';
      case 'rates': return 'Set active production rates for future operations.';
      case 'colors': return 'Manage colors in the system and view their usage statistics.';
      case 'settings': return 'Manage application settings and exports.';
      default: return '';
    }
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-white border-r border-slate-100 py-4 px-2.5">
      {/* Header Logo */}
      <div className="px-2.5 mb-3.5">
        <h1 className="text-base font-bold text-brand-primary flex items-center gap-2">
          <img src="/logo.png" alt="FallTrack" className="w-6 h-6 rounded-md object-contain shadow-xs" />
          {appName}
        </h1>
        <p className="text-[9px] text-brand-text-muted mt-0.5">Production Manager</p>
      </div>

      {/* Administrator-style Badge */}
      <div className="px-2.5 mb-4">
        <div className="flex items-center gap-2 px-2.5 py-1.5 bg-brand-light-purple border border-brand-primary/10 rounded-xl text-[9px] font-bold text-brand-primary">
          <svg className="w-3.5 h-3.5 text-brand-primary" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
          </svg>
          Manager Control
        </div>
      </div>

    {/* Navigation */}
      <nav className="flex-1 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <motion.button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              whileHover={{ x: 4 }}
              whileTap={{ scale: 0.98 }}
              className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-semibold transition-colors duration-200 relative group cursor-pointer ${
                isActive 
                  ? 'text-white' 
                  : 'text-slate-600 hover:bg-slate-50/70 hover:text-slate-900'
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="activeNavBackground"
                  className="absolute inset-0 bg-brand-primary shadow-md shadow-brand-primary/20 z-0"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  style={{ borderRadius: 12 }}
                />
              )}
              <span className="flex items-center gap-2 z-10 relative">
                <Icon size={15} className={isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-650 transition-colors'} />
                <span>{item.label}</span>
              </span>
              {isActive && (
                <span className="w-1.5 h-1.5 bg-white rounded-full ml-auto z-10 relative animate-pulse" />
              )}
            </motion.button>
          );
        })}
      </nav>

      {/* User Profile Card */}
      <div className="mt-auto flex flex-col gap-2">
        <motion.div 
          whileHover={{ scale: 1.02, y: -2 }}
          className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl flex items-center gap-2 shadow-sm transition-all duration-300 hover:shadow-soft"
        >
          <div className="w-7 h-7 rounded-full bg-brand-light-purple flex items-center justify-center text-brand-primary font-bold border border-brand-light-purple-hover text-xs">
            {profileName ? profileName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'M'}
          </div>
          <div className="flex-1 overflow-hidden">
            <h4 className="text-xs font-bold text-slate-800 truncate">{profileName || '...'}</h4>
            <p className="text-[9px] text-brand-text-muted truncate">{user?.email || profilePhone}</p>
          </div>
        </motion.div>
        
        <motion.button
          onClick={() => {
            setMobileMenuOpen(false);
            setShowLogoutConfirm(true);
          }}
          whileHover={{ x: 4 }}
          whileTap={{ scale: 0.98 }}
          className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-semibold text-red-650 hover:bg-red-50 hover:text-red-700 transition-colors duration-200 cursor-pointer"
        >
          <LogOut size={15} />
          <span>Sign Out</span>
        </motion.button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen md:h-screen flex bg-brand-bg font-sans">
      {/* Desktop Sidebar */}
      <aside className="hidden md:block w-52 fixed h-screen top-0 left-0 z-20">
        <SidebarContent />
      </aside>

      {/* Main Container */}
      <div className="flex-1 md:pl-52 flex flex-col min-h-screen md:min-h-0 md:h-screen">
        {/* Header Bar */}
        <header className="sticky top-0 bg-brand-bg/85 backdrop-blur-md border-b border-slate-100 px-5 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between z-10 no-print shrink-0">
          <div>
            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-slate-800">{getPageTitle()}</h2>
            <p className="text-xs sm:text-[13px] font-medium text-brand-text-muted mt-0.5">{getPageSubtitle()}</p>
          </div>

          <div className="flex items-center gap-3">
            {/* Local Date Badge */}
            <div className="hidden sm:inline-flex items-center gap-2 px-2.5 py-1 bg-white border border-slate-200/70 rounded-xl shadow-[0_1px_4px_rgba(0,0,0,0.03)]">
              <div className="w-7 h-7 rounded-lg bg-[#EFF6FF] flex items-center justify-center shrink-0">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="3" y="5" width="18" height="15.5" rx="3.5" fill="#FFFFFF" stroke="#2563EB" strokeWidth="1.8" />
                  <path d="M3 9.5C3 6.8 4.5 5 7.5 5H16.5C19.5 5 21 6.8 21 9.5V10H3V9.5Z" fill="#2563EB" />
                  <rect x="7" y="2" width="2" height="4.5" rx="1" fill="#1D4ED8" />
                  <rect x="15" y="2" width="2" height="4.5" rx="1" fill="#1D4ED8" />
                  <circle cx="7" cy="13" r="0.9" fill="#2563EB" />
                  <circle cx="10.3" cy="13" r="0.9" fill="#2563EB" />
                  <circle cx="13.7" cy="13" r="0.9" fill="#2563EB" />
                  <circle cx="17" cy="13" r="0.9" fill="#2563EB" />
                  <circle cx="7" cy="16.5" r="0.9" fill="#2563EB" />
                  <circle cx="10.3" cy="16.5" r="0.9" fill="#2563EB" />
                  <circle cx="13.7" cy="16.5" r="0.9" fill="#2563EB" />
                  <circle cx="17" cy="16.5" r="0.9" fill="#2563EB" />
                </svg>
              </div>
              <div className="h-3.5 w-[1px] bg-blue-100 shrink-0" />
              <div className="text-[11.5px] sm:text-xs leading-none whitespace-nowrap">
                <span className="font-medium text-slate-500">Local Date:</span>
                <span className="font-bold text-slate-800 ml-1">
                  {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
              </div>
            </div>
            
            {/* Mobile Menu Toggle */}
            <button 
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-1.5 rounded-lg bg-white border border-slate-200 shadow-sm text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <Menu size={18} />
            </button>
          </div>
        </header>

        {/* Mobile Navigation Drawer */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.4 }}
                exit={{ opacity: 0 }}
                onClick={() => setMobileMenuOpen(false)}
                className="fixed inset-0 bg-black z-40 md:hidden"
              />
              
              {/* Drawer Container */}
              <motion.div
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'tween', duration: 0.25 }}
                className="fixed inset-y-0 left-0 w-52 z-50 md:hidden shadow-2xl h-full"
              >
                <div className="absolute top-4 right-4 z-50">
                  <button 
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors text-slate-600"
                  >
                    <X size={16} />
                  </button>
                </div>
                <SidebarContent />
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col p-3 md:p-4 max-w-6xl w-full mx-auto min-h-0 overflow-y-auto">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex-1 flex flex-col min-h-0 h-full"
          >
            {children}
          </motion.div>
        </main>
      </div>

      {/* Premium Sign Out Confirmation Popup */}
      <AnimatePresence>
        {showLogoutConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowLogoutConfirm(false)}
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
                onClick={() => setShowLogoutConfirm(false)}
                className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>

              {/* Top ambient brand glow */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-56 h-20 bg-gradient-to-b from-brand-primary/10 via-rose-500/5 to-transparent blur-xl pointer-events-none" />

              {/* Circular Emblem Icon */}
              <div className="relative z-1 mb-4 flex justify-center">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-b from-rose-50 to-red-50 border border-red-100 flex items-center justify-center shadow-xs">
                  <div className="w-11 h-11 rounded-xl bg-white border border-red-100/80 flex items-center justify-center shadow-xs">
                    <LogOut size={20} className="text-red-500 translate-x-0.5" />
                  </div>
                </div>
              </div>

              {/* Heading & Subtext */}
              <div className="relative z-1">
                <h3 className="text-lg sm:text-xl font-extrabold text-slate-800 tracking-tight">
                  Sign Out Confirmation
                </h3>
                <p className="text-xs sm:text-[13px] text-brand-text-muted mt-1.5 leading-relaxed max-w-xs sm:max-w-sm mx-auto">
                  Are you sure you want to sign out? You will need to sign in again to access the dashboard.
                </p>
              </div>

              {/* Profile Context Pill */}
              <div className="relative z-1 mt-5 mb-6 p-3 sm:p-3.5 bg-slate-50/90 border border-slate-200/80 rounded-xl flex items-center gap-3 text-left">
                <div className="w-10 h-10 rounded-full bg-brand-light-purple flex items-center justify-center text-brand-primary font-extrabold border border-brand-light-purple-hover text-xs sm:text-sm shrink-0 shadow-2xs">
                  {profileName ? profileName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'M'}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs sm:text-sm font-bold text-slate-800 truncate">{profileName || 'Manager'}</h4>
                  <p className="text-[11px] sm:text-xs text-brand-text-muted truncate">{user?.email || profilePhone}</p>
                </div>
                <span className="shrink-0 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200/70 rounded-full">
                  Active
                </span>
              </div>

              {/* Action Buttons */}
              <div className="relative z-1 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowLogoutConfirm(false)}
                  className="flex-1 py-2.5 sm:py-3 px-5 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-700 text-xs sm:text-sm font-bold rounded-xl shadow-xs transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowLogoutConfirm(false);
                    signOut();
                  }}
                  className="flex-1 py-2.5 sm:py-3 px-5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md shadow-red-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <LogOut size={15} />
                  <span>Sign Out</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
export default Layout;
