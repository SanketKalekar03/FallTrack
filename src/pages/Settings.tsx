import React, { useState, useRef, useEffect } from 'react';
import { 
  Download, 
  Upload, 
  FileSpreadsheet, 
  FileText, 
  Database, 
  User, 
  Phone, 
  Save, 
  ShieldCheck, 
  CheckCircle2, 
  AlertTriangle, 
  Sparkles, 
  Mail, 
  AppWindow, 
  Hash, 
  HardDrive, 
  Activity,
  Layers
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { motion } from 'framer-motion';
import { dbService } from '../services/dbService';
import { useProductionStore } from '../store/useProductionStore';
import { useRateStore } from '../store/useRateStore';
import { useColorStore } from '../store/useColorStore';
import { useAuthStore } from '../store/useAuthStore';
import { exportEntriesToCSV } from '../utils/csvExport';
import { exportEntriesToPDF } from '../utils/pdfExport';
import { confirmDialog } from '../store/useConfirmStore';

interface SettingsProps {
  appName: string;
  setAppName: (name: string) => void;
  profileName: string;
  setProfileName: (name: string) => void;
  profilePhone: string;
  setProfilePhone: (phone: string) => void;
}

export const Settings: React.FC<SettingsProps> = ({ 
  appName, 
  setAppName,
  profileName,
  setProfileName,
  profilePhone,
  setProfilePhone
}) => {
  const { entries, fetchEntries } = useProductionStore();
  const { getActiveRateForDate, fetchRates } = useRateStore();
  const { colors, fetchColors } = useColorStore();
  const { user, mode } = useAuthStore();
  
  const [localAppName, setLocalAppName] = useState(appName);
  const [localProfileName, setLocalProfileName] = useState(profileName);
  const [localProfilePhone, setLocalProfilePhone] = useState(profilePhone);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchColors();
    fetchRates();
    fetchEntries();
  }, [fetchColors, fetchRates, fetchEntries]);

  // Check if there are unsaved edits
  const hasUnsavedChanges = 
    localAppName.trim() !== appName || 
    localProfileName.trim() !== profileName || 
    localProfilePhone.trim() !== profilePhone;

  // Calculate quick lifetime stats for profile summary card
  const totalFalls = entries.reduce((sum, e) => sum + e.quantity, 0);
  const todayStr = new Date().toISOString().split('T')[0];
  const currentRate = getActiveRateForDate(todayStr);

  // Unified save handler
  const handleSaveAll = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanApp = localAppName.trim();
    const cleanName = localProfileName.trim();
    const cleanPhone = localProfilePhone.trim();

    if (!cleanApp) {
      toast.error("Application name cannot be empty");
      return;
    }
    if (!cleanName) {
      toast.error("Profile name cannot be empty");
      return;
    }
    if (!cleanPhone) {
      toast.error("Phone number cannot be empty");
      return;
    }

    // Phone number validation: Must be exactly 10 digits starting with 6-9
    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      toast.error("Please enter a valid 10-digit phone number.");
      return;
    }

    try {
      setIsSaving(true);
      await dbService.updateProfile(cleanName, cleanPhone, cleanApp);
      setAppName(cleanApp);
      setProfileName(cleanName);
      setProfilePhone(cleanPhone);
      toast.success("Settings saved successfully!");
    } catch (err: any) {
      toast.error("Failed to save settings: " + (err?.message || "Unknown error"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportCSVAll = () => {
    if (entries.length === 0) {
      toast.error("No records to export");
      return;
    }
    exportEntriesToCSV(entries, getActiveRateForDate);
    toast.success("Full CSV exported successfully!");
  };

  const handleExportPDFAll = () => {
    if (entries.length === 0) {
      toast.error("No records to export");
      return;
    }
    exportEntriesToPDF(entries, getActiveRateForDate, `${appName || 'FallTrack'} Complete Database Export`);
    toast.success("Full PDF exported successfully!");
  };

  // Backup download triggers JSON generation of the local storage
  const handleBackupDownload = () => {
    try {
      const data = dbService.exportBackupData();
      const jsonString = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `FallTrack_Backup_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success("Backup JSON exported successfully!");
    } catch (err: any) {
      toast.error("Backup failed: " + err.message);
    }
  };

  // Backup restore triggers reading a uploaded JSON file
  const handleBackupRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const backup = JSON.parse(text);

        // Simple validation of JSON backup schema
        if (!backup.colors || !backup.rates || !backup.entries) {
          toast.error("Invalid backup file format.");
          return;
        }

        const confirmed = await confirmDialog({
          title: "Restore Backup Data",
          message: "Restoring this JSON backup will replace and synchronize active records, rates, and colors. Do you wish to proceed?",
          confirmText: "Proceed & Restore",
          type: "warning"
        });
        if (!confirmed) return;

        await dbService.importBackupData(backup);
        
        // Trigger state store re-fetching
        await fetchEntries();
        await fetchRates();
        await fetchColors();
        
        toast.success("Backup restored successfully!");
        if (fileInputRef.current) fileInputRef.current.value = ''; // Reset file input
      } catch (err: any) {
        toast.error("Restore failed: " + (err?.message || "Check file format."));
      }
    };
    reader.readAsText(file);
  };

  // Dynamic initials for avatar
  const avatarInitials = (profileName || 'Manager')
    .trim()
    .split(/\s+/)
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 sm:gap-4 pb-6 items-stretch">
      {/* ============================================================== */}
      {/* Left Column: Executive Profile & System Overview Card         */}
      {/* ============================================================== */}
      <div className="lg:col-span-4 flex flex-col gap-3.5 sm:gap-4 h-full">
        {/* Profile Card */}
        <motion.div 
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="bg-white rounded-xl border border-slate-200/80 shadow-[0_2px_12px_-2px_rgba(2,132,199,0.05)] overflow-hidden relative group"
        >
          {/* Compact Gradient Banner */}
          <div className="h-20 bg-gradient-to-r from-sky-500 via-sky-600 to-sky-700 relative overflow-hidden">
            <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:10px_10px]" />
            <div className="absolute -right-4 -bottom-4 w-20 h-20 bg-white/10 rounded-full blur-lg pointer-events-none" />
            <div className="absolute top-2.5 right-2.5 flex items-center gap-1 px-2 py-0.5 bg-black/20 backdrop-blur-md rounded-full text-[9px] font-bold text-white tracking-wide border border-white/15">
              <Sparkles size={10} className="text-sky-200" />
              <span>Workspace Admin</span>
            </div>
          </div>
          
          {/* Avatar & Profile Identity */}
          <div className="px-4 pb-4 text-center relative">
            <div className="relative inline-block -mt-9 mb-1.5">
              <div className="w-17 h-17 rounded-full bg-white p-1 shadow-md shadow-sky-900/10 border border-slate-100">
                <div className="w-full h-full rounded-full bg-brand-light-purple/60 border-2 border-brand-primary/25 flex items-center justify-center text-brand-primary font-extrabold text-xl tracking-wider">
                  {avatarInitials}
                </div>
              </div>
            </div>

            <h3 className="text-sm sm:text-base font-bold text-slate-800 tracking-tight leading-snug">
              {profileName || 'Production Manager'}
            </h3>
            
            <div className="mt-1 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-sky-50 text-sky-700 border border-sky-200/60">
              <ShieldCheck size={11} className="text-sky-600" />
              <span>Production Manager</span>
            </div>

            {/* Profile Metadata List */}
            <div className="mt-3.5 pt-3 border-t border-slate-100 space-y-1.5 text-left">
              <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-50/70 border border-slate-100">
                <div className="flex items-center gap-2 text-[11px] text-slate-500">
                  <div className="w-5.5 h-5.5 rounded-md bg-white border border-slate-200/60 flex items-center justify-center text-slate-600">
                    <Hash size={11} />
                  </div>
                  <span className="font-medium text-[10.5px]">User Identifier</span>
                </div>
                <span className="font-mono text-[11px] font-bold text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200/60 shadow-2xs">
                  FT-8842
                </span>
              </div>

              <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-50/70 border border-slate-100">
                <div className="flex items-center gap-2 text-[11px] text-slate-500">
                  <div className="w-5.5 h-5.5 rounded-md bg-white border border-slate-200/60 flex items-center justify-center text-slate-600">
                    <Phone size={11} />
                  </div>
                  <span className="font-medium text-[10.5px]">Phone Number</span>
                </div>
                <span className="text-[11px] font-bold text-slate-800">
                  +91 {profilePhone || 'Not set'}
                </span>
              </div>

              <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-50/70 border border-slate-100">
                <div className="flex items-center gap-2 text-[11px] text-slate-500">
                  <div className="w-5.5 h-5.5 rounded-md bg-white border border-slate-200/60 flex items-center justify-center text-slate-600">
                    <Mail size={11} />
                  </div>
                  <span className="font-medium text-[10.5px]">Account Email</span>
                </div>
                <span className="text-[11px] font-semibold text-slate-700 truncate max-w-[140px]" title={user?.email || 'Offline user'}>
                  {user?.email || 'Local User'}
                </span>
              </div>

              <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-50/70 border border-slate-100">
                <div className="flex items-center gap-2 text-[11px] text-slate-500">
                  <div className="w-5.5 h-5.5 rounded-md bg-white border border-slate-200/60 flex items-center justify-center text-slate-600">
                    <HardDrive size={11} />
                  </div>
                  <span className="font-medium text-[10.5px]">Sync State</span>
                </div>
                <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded ${
                  mode === 'online' 
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/70' 
                    : 'bg-amber-50 text-amber-700 border border-amber-200/70'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${mode === 'online' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                  {mode === 'online' ? 'Supabase Cloud' : 'Local Storage'}
                </span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* System Activity & Analytics Card (Equal Height) */}
        <motion.div 
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.05 }}
          className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200/80 shadow-[0_2px_12px_-2px_rgba(2,132,199,0.05)] flex-1 flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-6.5 h-6.5 rounded-lg bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-600">
                  <Activity size={13} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800">System Records</h4>
                  <p className="text-[9px] text-slate-400">Workspace data ledger</p>
                </div>
              </div>
              <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200/60">
                v1.0.9
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-2.5">
              <div className="p-2.5 bg-slate-50/70 rounded-lg border border-slate-100">
                <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block">Logged Entries</span>
                <span className="text-sm font-extrabold text-slate-800 mt-0.5 block">{entries.length}</span>
                <span className="text-[9px] text-slate-400 block">Recorded days</span>
              </div>
              <div className="p-2.5 bg-sky-50/50 rounded-lg border border-sky-100/70">
                <span className="text-[9px] font-extrabold text-sky-600 uppercase tracking-wider block">Total Volume</span>
                <span className="text-sm font-extrabold text-sky-700 mt-0.5 block">{totalFalls.toLocaleString()}</span>
                <span className="text-[9px] text-sky-600/70 block">Falls produced</span>
              </div>
              <div className="p-2.5 bg-emerald-50/50 rounded-lg border border-emerald-100/70">
                <span className="text-[9px] font-extrabold text-emerald-600 uppercase tracking-wider block">Current Rate</span>
                <span className="text-sm font-extrabold text-emerald-700 mt-0.5 block">₹{currentRate.toFixed(2)}</span>
                <span className="text-[9px] text-emerald-600/70 block">Per dozen</span>
              </div>
              <div className="p-2.5 bg-purple-50/50 rounded-lg border border-purple-100/70">
                <span className="text-[9px] font-extrabold text-purple-600 uppercase tracking-wider block">Color Palette</span>
                <span className="text-sm font-extrabold text-purple-700 mt-0.5 block">{colors.length}</span>
                <span className="text-[9px] text-purple-600/70 block">Active shades</span>
              </div>
            </div>
          </div>

          <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
            <span className="flex items-center gap-1.5 font-medium text-slate-600">
              <CheckCircle2 size={12} className="text-emerald-500" />
              <span>Ledger Verified</span>
            </span>
            <span className="font-semibold text-sky-600 bg-sky-50 px-1.5 py-0.5 rounded text-[9px] border border-sky-100">
              Live Sync
            </span>
          </div>
        </motion.div>
      </div>

      {/* ============================================================== */}
      {/* Right Column: Configuration & Data Export Management           */}
      {/* ============================================================== */}
      <div className="lg:col-span-8 flex flex-col gap-3.5 sm:gap-4 h-full">
        
        {/* Workspace & Profile Configuration Card */}
        <motion.div 
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="bg-white p-3.5 sm:p-4.5 rounded-xl border border-slate-200/80 shadow-[0_2px_12px_-2px_rgba(2,132,199,0.05)]"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-1.5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-600 shadow-2xs shrink-0">
                <AppWindow size={16} />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-slate-800">Workspace & Profile Settings</h3>
                <p className="text-[10px] sm:text-[10.5px] text-slate-400 mt-0.5">Customize branding, manager identity, and contact information</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSaveAll} className="mt-3.5 space-y-3">
            {/* Application Branding Section */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[9px] sm:text-[10px] font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  <span>Application Brand Name</span>
                </label>
                <span className="text-[9.5px] text-slate-400">Appears across headers and print reports</span>
              </div>
              <div className="relative">
                <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                  <Layers size={14} />
                </div>
                <input
                  type="text"
                  value={localAppName}
                  onChange={(e) => setLocalAppName(e.target.value)}
                  placeholder="e.g. FallTrack"
                  className="w-full pl-8 pr-3 py-1.5 sm:py-2 bg-slate-50/50 hover:bg-slate-50 focus:bg-white border border-slate-200 focus:border-sky-500 focus:ring-3 focus:ring-sky-500/10 rounded-lg text-xs font-semibold text-slate-800 outline-none transition-all placeholder:text-slate-400"
                />
              </div>
            </div>

            {/* Profile Identity Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-0.5">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[9px] sm:text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                    Manager Name
                  </label>
                </div>
                <div className="relative">
                  <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                    <User size={14} />
                  </div>
                  <input
                    type="text"
                    value={localProfileName}
                    onChange={(e) => setLocalProfileName(e.target.value)}
                    placeholder="e.g. Shrikant Kalekar"
                    className="w-full pl-8 pr-3 py-1.5 sm:py-2 bg-slate-50/50 hover:bg-slate-50 focus:bg-white border border-slate-200 focus:border-sky-500 focus:ring-3 focus:ring-sky-500/10 rounded-lg text-xs font-semibold text-slate-800 outline-none transition-all placeholder:text-slate-400"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[9px] sm:text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                    Phone Number (10 Digits)
                  </label>
                </div>
                <div className="relative">
                  <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                    <Phone size={14} />
                  </div>
                  <input
                    type="text"
                    maxLength={10}
                    value={localProfilePhone}
                    onChange={(e) => {
                      const numeric = e.target.value.replace(/[^0-9]/g, '');
                      setLocalProfilePhone(numeric);
                    }}
                    placeholder="e.g. 9876543210"
                    className="w-full pl-8 pr-3 py-1.5 sm:py-2 bg-slate-50/50 hover:bg-slate-50 focus:bg-white border border-slate-200 focus:border-sky-500 focus:ring-3 focus:ring-sky-500/10 rounded-lg text-xs font-semibold text-slate-800 outline-none transition-all placeholder:text-slate-400"
                  />
                </div>
              </div>
            </div>

            {/* Bottom Form Actions */}
            <div className="pt-2.5 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2.5">
              <div>
                {hasUnsavedChanges ? (
                  <div className="flex items-center gap-1.5 text-[10.5px] font-semibold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200/60">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                    <span>Unsaved changes detected</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-[10.5px] text-slate-400 font-medium">
                    <CheckCircle2 size={13} className="text-emerald-500" />
                    <span>Settings synchronized</span>
                  </div>
                )}
              </div>

              <motion.button
                type="submit"
                disabled={isSaving}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-1.5 sm:py-2 bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-600 hover:to-sky-700 text-white text-xs font-bold rounded-lg shadow-sm shadow-sky-500/20 cursor-pointer transition-all disabled:opacity-60"
              >
                <Save size={13} />
                <span>{isSaving ? "Saving..." : "Save Settings"}</span>
              </motion.button>
            </div>
          </form>
        </motion.div>

        {/* Data Management & Export Hub Card */}
        <motion.div 
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.05 }}
          className="bg-white p-3.5 sm:p-4.5 rounded-xl border border-slate-200/80 shadow-[0_2px_12px_-2px_rgba(2,132,199,0.05)] flex-1 flex flex-col justify-between"
        >
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <div className="w-8 h-8 rounded-lg bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-600 shadow-2xs shrink-0">
              <Database size={16} />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-slate-800">Data Management & Export Hub</h3>
              <p className="text-[10px] sm:text-[10.5px] text-slate-400 mt-0.5">Export operational logs, generate formatted reports, or archive databases</p>
            </div>
          </div>

          {/* Export Action Tiles Grid */}
          <div className="mt-3.5 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {/* Tile 1: JSON Backup */}
            <motion.div 
              whileHover={{ y: -2 }}
              className="p-3 rounded-lg border border-sky-200/80 bg-gradient-to-b from-sky-50/60 to-white flex flex-col justify-between shadow-2xs hover:shadow-soft transition-all"
            >
              <div>
                <div className="w-8 h-8 rounded-lg bg-sky-500 text-white flex items-center justify-center shadow-sm shadow-sky-500/20 mb-2">
                  <Download size={15} />
                </div>
                <h4 className="text-xs font-bold text-slate-800">Full JSON Backup</h4>
                <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">
                  Export complete data snapshot with colors, rates, and historical logs.
                </p>
              </div>

              <motion.button
                onClick={handleBackupDownload}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                className="mt-3 w-full py-1.5 px-2.5 bg-sky-500 hover:bg-sky-600 text-white text-[11px] font-bold rounded-md shadow-xs shadow-sky-500/20 cursor-pointer transition-all flex items-center justify-center gap-1.5"
              >
                <Download size={12} />
                <span>Backup JSON</span>
              </motion.button>
            </motion.div>

            {/* Tile 2: CSV Spreadsheet */}
            <motion.div 
              whileHover={{ y: -2 }}
              className="p-3 rounded-lg border border-emerald-200/80 bg-gradient-to-b from-emerald-50/40 to-white flex flex-col justify-between shadow-2xs hover:shadow-soft transition-all"
            >
              <div>
                <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-sm shadow-emerald-600/20 mb-2">
                  <FileSpreadsheet size={15} />
                </div>
                <h4 className="text-xs font-bold text-slate-800">Production CSV</h4>
                <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">
                  Raw tabular format compatible with Microsoft Excel and Google Sheets.
                </p>
              </div>

              <motion.button
                onClick={handleExportCSVAll}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                className="mt-3 w-full py-1.5 px-2.5 bg-white hover:bg-emerald-50/60 border border-emerald-200 text-emerald-700 text-[11px] font-bold rounded-md shadow-2xs cursor-pointer transition-all flex items-center justify-center gap-1.5"
              >
                <FileSpreadsheet size={12} />
                <span>Export CSV</span>
              </motion.button>
            </motion.div>

            {/* Tile 3: PDF Document */}
            <motion.div 
              whileHover={{ y: -2 }}
              className="p-3 rounded-lg border border-indigo-200/80 bg-gradient-to-b from-indigo-50/40 to-white flex flex-col justify-between shadow-2xs hover:shadow-soft transition-all"
            >
              <div>
                <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-sm shadow-indigo-600/20 mb-2">
                  <FileText size={15} />
                </div>
                <h4 className="text-xs font-bold text-slate-800">Printable PDF</h4>
                <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">
                  Clean printable production report formatted with financial summaries.
                </p>
              </div>

              <motion.button
                onClick={handleExportPDFAll}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                className="mt-3 w-full py-1.5 px-2.5 bg-white hover:bg-indigo-50/60 border border-indigo-200 text-indigo-700 text-[11px] font-bold rounded-md shadow-2xs cursor-pointer transition-all flex items-center justify-center gap-1.5"
              >
                <FileText size={12} />
                <span>Export PDF</span>
              </motion.button>
            </motion.div>
          </div>

          {/* Database Restore Banner */}
          <div className="mt-3.5 p-2.5 sm:p-3 rounded-lg border border-slate-200/90 bg-slate-50/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-amber-50 border border-amber-200/80 text-amber-600 flex items-center justify-center shrink-0 mt-0.5">
                <AlertTriangle size={13} />
              </div>
              <div>
                <h5 className="text-[11px] sm:text-xs font-bold text-slate-800">Restore Database from Backup</h5>
                <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">
                  Select a valid <code className="text-sky-600 font-bold bg-white px-1 py-0.5 rounded border border-slate-200">.json</code> backup to overwrite local database records.
                </p>
              </div>
            </div>

            <div className="w-full sm:w-auto shrink-0">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleBackupRestore}
                className="hidden"
                id="restore-upload-input"
              />
              <motion.label
                htmlFor="restore-upload-input"
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                className="w-full sm:w-auto cursor-pointer inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-[11px] font-bold rounded-lg shadow-2xs transition-all whitespace-nowrap"
              >
                <Upload size={12} className="text-slate-500" />
                <span>Upload JSON</span>
              </motion.label>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Settings;
