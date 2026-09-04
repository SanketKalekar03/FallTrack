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
            if (window.confirm("Are you sure you want to sign out?")) {
              signOut();
            }
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
    <div className="min-h-screen flex bg-brand-bg font-sans">
      {/* Desktop Sidebar */}
      <aside className="hidden md:block w-52 fixed h-screen top-0 left-0 z-20">
        <SidebarContent />
      </aside>

      {/* Main Container */}
      <div className="flex-1 md:pl-52 flex flex-col min-h-screen">
        {/* Header Bar */}
        <header className="sticky top-0 bg-brand-bg/85 backdrop-blur-md border-b border-slate-100 px-4 py-2 flex items-center justify-between z-10 no-print">
          <div>
            <h2 className="text-base font-bold text-slate-800">{getPageTitle()}</h2>
            <p className="text-[10px] text-brand-text-muted mt-0.5">{getPageSubtitle()}</p>
          </div>
          
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-block px-2 py-0.5 bg-white border border-slate-100 rounded-full text-[9px] text-brand-text-muted shadow-sm font-semibold">
              📅 Local Time: {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
            </span>
            
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
        <main className="flex-1 p-3 md:p-4 max-w-6xl w-full mx-auto">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="h-full"
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
};
export default Layout;
