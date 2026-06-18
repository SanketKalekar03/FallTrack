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
import { dbService } from './services/dbService';

function App() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [appName, setAppName] = useState<string>(() => {
    return localStorage.getItem('falltrack_app_name') || 'FallTrack';
  });
  const [profileName, setProfileName] = useState<string>(() => {
    return localStorage.getItem('falltrack_profile_name') || 'Rajesh Kumar';
  });
  const [profilePhone, setProfilePhone] = useState<string>(() => {
    return localStorage.getItem('falltrack_profile_phone') || '9876543210';
  });

  useEffect(() => {
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
  }, []);

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
            color: '#1E1B4B',
            borderRadius: '12px',
            border: '1px solid #E5E7EB',
            fontSize: '13px',
            fontWeight: 500,
            boxShadow: '0 4px 12px rgba(92, 62, 163, 0.08)'
          } 
        }} 
      />
    </>
  );
}

export default App;
