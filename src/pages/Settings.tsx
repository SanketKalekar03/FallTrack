import React, { useState, useRef } from 'react';
import { Download, Upload, FileSpreadsheet, FileText } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { motion } from 'framer-motion';
import { dbService } from '../services/dbService';
import { useProductionStore } from '../store/useProductionStore';
import { useRateStore } from '../store/useRateStore';
import { useColorStore } from '../store/useColorStore';
import { exportEntriesToCSV } from '../utils/csvExport';
import { exportEntriesToPDF } from '../utils/pdfExport';

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
  const { fetchColors } = useColorStore();
  
  const [localAppName, setLocalAppName] = useState(appName);
  const [localProfileName, setLocalProfileName] = useState(profileName);
  const [localProfilePhone, setLocalProfilePhone] = useState(profilePhone);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSaveAppName = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = localAppName.trim();
    if (!name) {
      toast.error("Name cannot be empty");
      return;
    }
    try {
      await dbService.updateProfile(profileName, profilePhone, name);
      setAppName(name);
      toast.success("Settings saved successfully!");
    } catch (err: any) {
      toast.error("Failed to save settings: " + err.message);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = localProfileName.trim();
    const phone = localProfilePhone.trim();
    if (!name) {
      toast.error("Name cannot be empty");
      return;
    }
    if (!phone) {
      toast.error("Phone number cannot be empty");
      return;
    }

    // Phone number validation: Must be exactly 10 digits
    if (!/^[6-9]\d{9}$/.test(phone)) {
      toast.error("Please enter a valid 10-digit phone number.");
      return;
    }

    try {
      await dbService.updateProfile(name, phone, appName);
      setProfileName(name);
      setProfilePhone(phone);
      toast.success("Profile saved successfully!");
    } catch (err: any) {
      toast.error("Failed to save profile: " + err.message);
    }
  };

  const handleExportCSVAll = () => {
    if (entries.length === 0) {
      toast.error("No records to export");
      return;
    }
    exportEntriesToCSV(entries, getActiveRateForDate);
    toast.success("Full CSV Exported!");
  };

  const handleExportPDFAll = () => {
    if (entries.length === 0) {
      toast.error("No records to export");
      return;
    }
    exportEntriesToPDF(entries, getActiveRateForDate, 'FallTrack Complete Database Export');
    toast.success("Full PDF Exported!");
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
      
      toast.success("Backup JSON exported!");
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
          toast.error("Invalid backup format.");
          return;
        }

        if (window.confirm("Restoring backup will replace existing data. Proceed?")) {
          await dbService.importBackupData(backup);
          
          // Trigger state store re-fetching
          await fetchEntries();
          await fetchRates();
          await fetchColors();
          
          toast.success("Backup restored successfully!");
          if (fileInputRef.current) fileInputRef.current.value = ''; // Reset file input
        }
      } catch (err: any) {
        toast.error("Restore failed. Check file format.");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Left panel: Profile Card */}
      <motion.div 
        whileHover={{ y: -4 }}
        className="bg-white p-4 sm:p-5 rounded-xl border border-slate-100 shadow-soft flex flex-col items-center text-center relative overflow-hidden group"
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-brand-light-purple/20 rounded-bl-full pointer-events-none" />
        
        <div className="w-20 h-20 rounded-full bg-brand-light-purple/50 flex items-center justify-center border-2 border-brand-primary/20 mt-3 overflow-hidden shadow-inner transition-transform duration-500 group-hover:scale-105">
          {/* Decorative avatar icon */}
          <div className="text-2xl font-extrabold text-brand-primary">
            {profileName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
          </div>
        </div>

        <div className="mt-4">
          <h4 className="text-base font-bold text-slate-800">{profileName}</h4>
          <p className="text-xs text-brand-text-muted mt-0.5">Production Manager</p>
        </div>

        <div className="mt-6 w-full border-t border-slate-100 pt-4 space-y-2.5 text-left text-xs text-slate-600">
          <div className="flex justify-between">
            <span className="font-semibold text-slate-400 uppercase tracking-wider text-[9px]">User ID</span>
            <span className="font-extrabold text-slate-750">FT-8842</span>
          </div>
          <div className="flex justify-between">
            <span className="font-semibold text-slate-400 uppercase tracking-wider text-[9px]">Phone</span>
            <span className="font-extrabold text-slate-750">{profilePhone}</span>
          </div>
        </div>
      </motion.div>

      {/* Right panel: Application Settings & Data Management */}
      <div className="lg:col-span-2 space-y-4">
        {/* App Settings */}
        <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-100 shadow-soft">
          <div>
            <h3 className="text-sm font-bold text-slate-800">Application Settings</h3>
            <p className="text-[10px] text-brand-text-muted mt-0.5">Update application name across headers and reports</p>
          </div>

          <form onSubmit={handleSaveAppName} className="mt-4 flex flex-col sm:flex-row items-end gap-3">
            <div className="flex flex-col gap-1 w-full">
              <label className="text-[9px] font-extrabold text-slate-455 uppercase tracking-wider">Application Name</label>
              <input
                type="text"
                value={localAppName}
                onChange={(e) => setLocalAppName(e.target.value)}
                className="px-3 py-1.5 bg-white border border-slate-200 focus:border-brand-primary focus:ring-3 focus:ring-brand-primary/10 rounded-lg text-xs font-semibold outline-none text-slate-700 shadow-sm transition-all"
              />
            </div>
            <motion.button
              type="submit"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full sm:w-auto px-5 py-2 bg-brand-primary hover:bg-brand-primary-hover text-white text-xs font-bold rounded-lg shadow-md shadow-brand-primary/15 transition-all whitespace-nowrap cursor-pointer"
            >
              Save Changes
            </motion.button>
          </form>
        </div>

        {/* Profile Settings */}
        <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-100 shadow-soft">
          <div>
            <h3 className="text-sm font-bold text-slate-800">Profile Settings</h3>
            <p className="text-[10px] text-brand-text-muted mt-0.5">Update profile name and phone number details</p>
          </div>

          <form onSubmit={handleSaveProfile} className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
            <div className="flex flex-col gap-1 w-full">
              <label className="text-[9px] font-extrabold text-slate-455 uppercase tracking-wider">Profile Name</label>
              <input
                type="text"
                value={localProfileName}
                onChange={(e) => setLocalProfileName(e.target.value)}
                className="px-3 py-1.5 bg-white border border-slate-200 focus:border-brand-primary focus:ring-3 focus:ring-brand-primary/10 rounded-lg text-xs font-semibold outline-none text-slate-700 shadow-sm transition-all"
              />
            </div>
            
            <div className="flex flex-col gap-1 w-full">
              <label className="text-[9px] font-extrabold text-slate-455 uppercase tracking-wider">Phone Number (10 digits)</label>
              <input
                type="text"
                maxLength={10}
                placeholder="e.g. 9876543210"
                value={localProfilePhone}
                onChange={(e) => {
                  // Only allow numeric digits
                  const val = e.target.value.replace(/[^0-9]/g, '');
                  setLocalProfilePhone(val);
                }}
                className="px-3 py-1.5 bg-white border border-slate-200 focus:border-brand-primary focus:ring-3 focus:ring-brand-primary/10 rounded-lg text-xs font-semibold outline-none text-slate-700 shadow-sm transition-all"
              />
            </div>
            
            <div className="sm:col-span-2 flex justify-end">
              <motion.button
                type="submit"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full sm:w-auto px-5 py-2 bg-brand-primary hover:bg-brand-primary-hover text-white text-xs font-bold rounded-lg shadow-md shadow-brand-primary/15 transition-all whitespace-nowrap cursor-pointer"
              >
                Save Profile
              </motion.button>
            </div>
          </form>
        </div>

        {/* Data Management */}
        <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-100 shadow-soft">
          <div>
            <h3 className="text-sm font-bold text-slate-800">Data Management</h3>
            <p className="text-[10px] text-brand-text-muted mt-0.5">Export logs or manage local storage database backups</p>
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Backup Button */}
            <motion.button
              onClick={handleBackupDownload}
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              className="flex flex-col items-center justify-center p-4 bg-gradient-to-br from-brand-primary to-brand-accent text-white rounded-xl shadow-md shadow-brand-primary/15 transition-all cursor-pointer border-0"
            >
              <Download size={18} />
              <span className="text-xs font-bold mt-2">Backup Data</span>
            </motion.button>

            {/* Export CSV */}
            <motion.button
              onClick={handleExportCSVAll}
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              className="flex flex-col items-center justify-center p-4 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-700 rounded-xl shadow-sm transition-all cursor-pointer"
            >
              <FileSpreadsheet size={18} className="text-brand-primary" />
              <span className="text-xs font-bold mt-2">Export CSV</span>
            </motion.button>

            {/* Export PDF */}
            <motion.button
              onClick={handleExportPDFAll}
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              className="flex flex-col items-center justify-center p-4 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-700 rounded-xl shadow-sm transition-all cursor-pointer"
            >
              <FileText size={18} className="text-brand-primary" />
              <span className="text-xs font-bold mt-2">Export PDF</span>
            </motion.button>
          </div>

          {/* Import / Restore Database */}
          <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h5 className="text-[11px] font-bold text-slate-750">Restore Backup</h5>
              <p className="text-[9px] text-slate-400 mt-0.5">Import a JSON backup to overwrite records</p>
            </div>
            
            <div className="relative w-full sm:w-auto">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleBackupRestore}
                className="hidden"
                id="restore-upload-input"
              />
              <label
                htmlFor="restore-upload-input"
                className="w-full sm:w-auto cursor-pointer flex items-center justify-center gap-1.5 px-3 py-1.5 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-600 text-xs font-bold rounded-lg shadow-sm transition-all"
              >
                <Upload size={13} className="text-slate-500" />
                Upload JSON
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default Settings;
