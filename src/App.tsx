import { useState, useEffect } from 'react';
import { PremiumToaster } from './components/PremiumToaster';
import { ConfirmModal } from './components/ConfirmModal';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { DailyEntry } from './pages/DailyEntry';
import { DailyRecords } from './pages/DailyRecords';
import { Reports } from './pages/Reports';
import { RateManagement } from './pages/RateManagement';
import { ColorManagement } from './pages/ColorManagement';
import { Settings } from './pages/Settings';
import { IncomePeriods } from './pages/IncomePeriods';
import { Login } from './pages/Login';
import { InitialSetupModal } from './components/InitialSetupModal';
import { useAuthStore } from './store/useAuthStore';
import { useSettingsStore } from './store/useSettingsStore';
import type { InitialSetupData } from './types';
import toast from 'react-hot-toast';

function App() {
  const { user, loading: authLoading, initAuth, signOut } = useAuthStore();
  const { 
    profile, 
    isSetupCompleted, 
    loading: settingsLoading, 
    checkSetupStatus, 
    saveInitialSetup 
  } = useSettingsStore();

  const [activeTab, setActiveTab] = useState<string>('dashboard');
  
  const [appName, setAppName] = useState<string>('FallTrack');
  const [profileName, setProfileName] = useState<string>('');
  const [profilePhone, setProfilePhone] = useState<string>('9876543210');

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  // When user is authenticated, query database to determine setup status
  useEffect(() => {
    if (!user) {
      setAppName('FallTrack');
      setProfileName('');
      setProfilePhone('9876543210');
      return;
    }

    checkSetupStatus(user.id);
  }, [user, checkSetupStatus]);

  // Sync profile details into state
  useEffect(() => {
    if (profile) {
      setAppName(profile.app_name || 'FallTrack');
      setProfileName(profile.manager_name || '');
      setProfilePhone(profile.manager_phone || '9876543210');
    }
  }, [profile]);

  const handleInitialSetupComplete = async (data: InitialSetupData) => {
    if (!user) return;
    try {
      const updated = await saveInitialSetup(user.id, data);
      setAppName(updated.app_name);
      setProfileName(updated.manager_name);
      setProfilePhone(updated.manager_phone);
      toast.success('Workspace configured successfully! Welcome to FallTrack.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to complete setup');
      throw err;
    }
  };

  const renderActivePage = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard onNavigate={setActiveTab} />;
      case 'daily-entry':
        return <DailyEntry />;
      case 'history':
        return <DailyRecords />;
      case 'reports':
        return <Reports />;
      case 'income':
        return <IncomePeriods />;
      case 'rates':
        return <RateManagement />;
      case 'colors':
        return <ColorManagement />;
      case 'settings':
        return (
          <Settings 
            appName={appName} 
            setAppName={setAppName} 
            profileName={profileName}
            setProfileName={setProfileName}
            profilePhone={profilePhone}
            setProfilePhone={setProfilePhone}
          />
        );
      default:
        return <Dashboard onNavigate={setActiveTab} />;
    }
  };

  // 1. Loading State: Either authenticating or checking database setup status.
  // CRITICAL: Prevents any dashboard flash before setup status is determined.
  if (authLoading || (user && isSetupCompleted === null && settingsLoading)) {
    return (
      <div className="min-h-screen bg-brand-bg flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-brand-primary flex items-center justify-center text-white text-lg font-extrabold shadow-md animate-pulse">
          FT
        </div>
        <div className="w-6 h-6 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // 2. Unauthenticated State
  if (!user) {
    return (
      <>
        <Login />
        <PremiumToaster />
        <ConfirmModal />
      </>
    );
  }

  // 3. Mandatory First-Time Setup State:
  // Renders the blurred Dashboard in the background while the mandatory setup modal is displayed.
  // The background is completely inert, aria-hidden, non-focusable, and non-interactive until setup succeeds.
  if (isSetupCompleted === false) {
    return (
      <div className="relative min-h-screen overflow-hidden">
        {/* Inert Blurred Dashboard Background */}
        <div 
          className="fixed inset-0 pointer-events-none select-none filter blur-md opacity-60 scale-105 transform-gpu transition-all"
          aria-hidden="true"
          tabIndex={-1}
        >
          <Layout 
            activeTab="dashboard" 
            setActiveTab={() => {}} 
            appName={appName}
            profileName={profileName || 'Manager'}
            profilePhone={profilePhone}
          >
            <Dashboard onNavigate={() => {}} />
          </Layout>
        </div>

        {/* Mandatory Setup Modal */}
        <InitialSetupModal 
          isOpen={true}
          userEmail={user.email}
          onComplete={handleInitialSetupComplete}
          onSignOut={signOut}
        />
        <PremiumToaster />
      </div>
    );
  }

  // 4. Completed Setup: Full protected application access
  return (
    <>
      <Layout 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        appName={appName}
        profileName={profileName}
        profilePhone={profilePhone}
      >
        {renderActivePage()}
      </Layout>
      <PremiumToaster />
      <ConfirmModal />
    </>
  );
}

export default App;
