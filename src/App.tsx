import { useState, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
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
import { dbService } from './services/dbService';
import { useAuthStore } from './store/useAuthStore';

function App() {
  const { user, loading, initAuth } = useAuthStore();
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  
  const [appName, setAppName] = useState<string>('FallTrack');
  const [profileName, setProfileName] = useState<string>('');
  const [profilePhone, setProfilePhone] = useState<string>('9876543210');

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  useEffect(() => {
    if (!user) {
      setAppName('FallTrack');
      setProfileName('');
      setProfilePhone('9876543210');
      return;
    }
    const loadProfile = async () => {
      try {
        const profile = await dbService.getProfile();
        setAppName(profile.app_name);
        setProfileName(profile.manager_name);
        setProfilePhone(profile.manager_phone);
      } catch (err) {
        console.warn('Could not load profile settings from database:', err);
      }
    };
    loadProfile();
  }, [user]);

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

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-bg flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-brand-primary flex items-center justify-center text-white text-lg font-extrabold shadow-md animate-pulse">
          FT
        </div>
        <div className="w-6 h-6 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <Login />
        <Toaster 
          position="top-right" 
          toastOptions={{ 
            duration: 4000,
            style: {
              background: '#FFFFFF',
              color: '#0F172A',
              borderRadius: '12px',
              border: '1px solid #E5E7EB',
              fontSize: '13px',
              fontWeight: 500,
              boxShadow: '0 4px 12px rgba(2, 132, 199, 0.08)'
            } 
          }} 
        />
      </>
    );
  }

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
      <Toaster 
        position="top-right" 
        toastOptions={{ 
          duration: 4000,
          style: {
            background: '#FFFFFF',
            color: '#0F172A',
            borderRadius: '12px',
            border: '1px solid #E5E7EB',
            fontSize: '13px',
            fontWeight: 500,
            boxShadow: '0 4px 12px rgba(2, 132, 199, 0.08)'
          } 
        }} 
      />
    </>
  );
}

export default App;
