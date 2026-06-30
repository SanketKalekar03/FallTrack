import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  useFonts, 
  NotoSansDevanagari_500Medium, 
  NotoSansDevanagari_700Bold 
} from '@expo-google-fonts/noto-sans-devanagari';
import { 
  LayoutDashboard, 
  PlusCircle, 
  History, 
  Coins, 
  Settings,
  Plus 
} from 'lucide-react-native';

// Lib/Supabase
import { supabase, isSupabaseConfigured } from './src/lib/supabase';
import { syncLocalDataToCloudMobile } from './src/services/dbService';

// Screens
import { DashboardScreen } from './src/screens/DashboardScreen';
import { DailyEntryScreen } from './src/screens/DailyEntryScreen';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { IncomeTrackerScreen } from './src/screens/IncomeTrackerScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { LoginScreen } from './src/screens/LoginScreen';

import { AlertProvider } from './src/components/AlertProvider';
import { COLORS } from './src/utils/theme';

const Tab = createBottomTabNavigator();

export default function App() {
  const [fontsLoaded] = useFonts({
    'NotoSansDevanagari-Medium': NotoSansDevanagari_500Medium,
    'NotoSansDevanagari-Bold': NotoSansDevanagari_700Bold,
  });

  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    initSession();
  }, []);

  const initSession = async () => {
    setAuthLoading(true);
    try {
      if (isSupabaseConfigured && supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session && session.user) {
          const u = session.user;
          await AsyncStorage.setItem('falltrack_active_user_id', u.id);
          await syncLocalDataToCloudMobile(u.id);
          setUser({ id: u.id, email: u.email || '' });
        } else {
          await AsyncStorage.removeItem('falltrack_active_user_id');
          setUser(null);
        }

        // Listen for auth changes
        supabase.auth.onAuthStateChange(async (_event, session) => {
          if (session && session.user) {
            const u = session.user;
            await AsyncStorage.setItem('falltrack_active_user_id', u.id);
            await syncLocalDataToCloudMobile(u.id);
            setUser({ id: u.id, email: u.email || '' });
          } else {
            await AsyncStorage.removeItem('falltrack_active_user_id');
            setUser(null);
          }
        });
      } else {
        // Offline auth init
        const activeUserId = await AsyncStorage.getItem('falltrack_active_user_id');
        const localUsersData = await AsyncStorage.getItem('falltrack_local_users');
        const localUsers: any[] = localUsersData ? JSON.parse(localUsersData) : [];
        if (activeUserId) {
          const matched = localUsers.find(u => u.id === activeUserId);
          if (matched) {
            setUser({ id: matched.id, email: matched.email });
          } else {
            await AsyncStorage.removeItem('falltrack_active_user_id');
            setUser(null);
          }
        } else {
          setUser(null);
        }
      }
    } catch (e) {
      console.warn('Auth init failed:', e);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    setAuthLoading(true);
    try {
      if (isSupabaseConfigured && supabase) {
        await supabase.auth.signOut();
      }
      await AsyncStorage.removeItem('falltrack_active_user_id');
      setUser(null);
    } catch (e) {
      console.warn('Sign out failed:', e);
    } finally {
      setAuthLoading(false);
    }
  };

  if (!fontsLoaded || authLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <AlertProvider>
        {user ? (
          <NavigationContainer>
            <Tab.Navigator
              screenOptions={({ route }) => ({
                tabBarIcon: ({ color }) => {
                  if (route.name === 'Dashboard') {
                    return <LayoutDashboard size={24} color={color} />;
                  } else if (route.name === 'History') {
                    return <History size={24} color={color} />;
                  } else if (route.name === 'Daily Entry') {
                    return (
                      <View style={{
                        width: 36,
                        height: 36,
                        borderRadius: 18,
                        backgroundColor: COLORS.primary,
                        justifyContent: 'center',
                        alignItems: 'center',
                        shadowColor: COLORS.primary,
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.2,
                        shadowRadius: 3,
                        elevation: 3,
                        marginBottom: 6,
                      }}>
                        <Plus size={20} color="#FFFFFF" />
                      </View>
                    );
                  } else if (route.name === 'Income Tracker') {
                    return <Coins size={24} color={color} />;
                  } else if (route.name === 'Settings') {
                    return <Settings size={24} color={color} />;
                  }
                  return null;
                },
                tabBarActiveTintColor: COLORS.primary,
                tabBarInactiveTintColor: '#94A3B8',
                tabBarStyle: {
                  height: 64,
                  paddingBottom: 8,
                  paddingTop: 8,
                  backgroundColor: '#FFFFFF',
                  borderTopWidth: 1,
                  borderTopColor: '#F1F5F9',
                  shadowColor: '#000000',
                  shadowOffset: { width: 0, height: -3 },
                  shadowOpacity: 0.04,
                  shadowRadius: 6,
                  elevation: 8,
                },
                tabBarLabelStyle: {
                  fontSize: 10,
                  fontWeight: '700',
                  marginTop: 2,
                },
                headerShown: false,
              })}
            >
              <Tab.Screen name="Dashboard" component={DashboardScreen} />
              <Tab.Screen name="History" component={HistoryScreen} />
              <Tab.Screen name="Daily Entry" component={DailyEntryScreen} />
              <Tab.Screen name="Income Tracker" component={IncomeTrackerScreen} />
              <Tab.Screen name="Settings">
                {props => <SettingsScreen {...props} onLogout={handleLogout} userEmail={user.email} />}
              </Tab.Screen>
            </Tab.Navigator>
          </NavigationContainer>
        ) : (
          <LoginScreen onLoginSuccess={(u) => setUser(u)} />
        )}
      </AlertProvider>
    </SafeAreaProvider>
  );
}
