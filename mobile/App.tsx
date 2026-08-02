import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';
import React, { useState, useEffect, useRef } from 'react';
import { View, ActivityIndicator, Animated, StyleSheet, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import packageJson from './package.json';

// Keep native splash screen visible while loading custom JS animations
SplashScreen.preventAutoHideAsync().catch(() => {});
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
import { syncLocalDataToCloudMobile, withTimeout, cleanDatabaseDuplicatesOneTime } from './src/services/dbService';

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

const MainNavigator = ({ user, handleLogout }: { user: any; handleLogout: () => void }) => {
  const insets = useSafeAreaInsets();
  
  return (
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
            height: 64 + insets.bottom,
            paddingBottom: 8 + insets.bottom,
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
  );
};

export default function App() {
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isSplashAnimationComplete, setIsSplashAnimationComplete] = useState(false);

  const logoScale = useRef(new Animated.Value(0.5)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const splashOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // 1. Hide native splash screen immediately to reveal JS animated splash screen
    SplashScreen.hideAsync().catch(() => {});

    // 2. Entrance animation bounce & fade
    Animated.parallel([
      Animated.spring(logoScale, {
        toValue: 1.0,
        friction: 6,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.timing(logoOpacity, {
        toValue: 1.0,
        duration: 700,
        useNativeDriver: true,
      }),
    ]).start();

    // 3. Start checking auth session
    initSession();
  }, []);

  const initSession = async () => {
    const startTime = Date.now();
    setAuthLoading(true);
    try {
      if (isSupabaseConfigured && supabase) {
        let session = null;
        try {
          const { data } = await withTimeout(supabase.auth.getSession(), 3000);
          session = data?.session || null;
        } catch (e) {
          console.warn('Supabase getSession failed or timed out:', e);
        }

        if (session && session.user) {
          const u = session.user;
          await AsyncStorage.setItem('falltrack_active_user_id', u.id);
          await syncLocalDataToCloudMobile(u.id);
          await cleanDatabaseDuplicatesOneTime();
          setUser({ id: u.id, email: u.email || '' });
        } else {
          // Fall back to local session if present, to prevent automatic logouts when offline
          const activeUserId = await AsyncStorage.getItem('falltrack_active_user_id');
          const localUsersData = await AsyncStorage.getItem('falltrack_local_users');
          const localUsers: any[] = localUsersData ? JSON.parse(localUsersData) : [];
          if (activeUserId) {
            const matched = localUsers.find(u => u.id === activeUserId);
            if (matched) {
              console.log('Online session check failed/null, falling back to local session:', matched.email);
              setUser({ id: matched.id, email: matched.email });
            } else {
              await AsyncStorage.removeItem('falltrack_active_user_id');
              setUser(null);
            }
          } else {
            setUser(null);
          }
        }

        // Listen for auth changes
        supabase.auth.onAuthStateChange(async (event, session) => {
          if (session && session.user) {
            const u = session.user;
            await AsyncStorage.setItem('falltrack_active_user_id', u.id);
            await syncLocalDataToCloudMobile(u.id);
            await cleanDatabaseDuplicatesOneTime();
            setUser({ id: u.id, email: u.email || '' });
          } else if (event === 'SIGNED_OUT') {
            // Only clear the session on explicit logout events
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
      console.warn('Auth init failed (likely offline), falling back to offline session check:', e);
      try {
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
      } catch (localErr) {
        setUser(null);
      }
    } finally {
      // Enforce that the animated splash screen remains for at least 2000ms
      const elapsed = Date.now() - startTime;
      const delay = Math.max(0, 2000 - elapsed);

      setTimeout(async () => {
        setAuthLoading(false);

        // Smooth fade out of custom JS splash screen
        Animated.timing(splashOpacity, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }).start(() => {
          setIsSplashAnimationComplete(true);
        });
      }, delay);
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

  // Render animated splash screen while loading
  if (!isSplashAnimationComplete) {
    return (
      <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
        <Animated.View style={[StyleSheet.absoluteFillObject, {
          backgroundColor: '#E6F4FE',
          justifyContent: 'center',
          alignItems: 'center',
          opacity: splashOpacity,
        }]}>
          <Animated.View style={{
            alignItems: 'center',
            transform: [{ scale: logoScale }],
            opacity: logoOpacity,
          }}>
            <View style={{
              width: 90,
              height: 90,
              borderRadius: 22,
              backgroundColor: '#0284C7',
              justifyContent: 'center',
              alignItems: 'center',
              shadowColor: '#0284C7',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.25,
              shadowRadius: 8,
              elevation: 6,
              marginBottom: 16,
            }}>
              <Text style={{ fontSize: 38, fontWeight: '900', color: '#FFFFFF' }}>FT</Text>
            </View>
            <Text style={{ fontSize: 24, fontWeight: '900', color: '#0F172A', letterSpacing: 0.5 }}>FallTrack</Text>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#64748B', marginTop: 4, letterSpacing: 0.8, textTransform: 'uppercase' }}>Production Ledger</Text>
          </Animated.View>
          
          <View style={{ position: 'absolute', bottom: 80, alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#0284C7" style={{ marginBottom: 14 }} />
            <Text style={{ fontSize: 11, fontWeight: '700', color: '#94A3B8', letterSpacing: 0.8 }}>VERSION {packageJson.version}</Text>
          </View>
        </Animated.View>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AlertProvider>
        {user ? (
          <MainNavigator user={user} handleLogout={handleLogout} />
        ) : (
          <LoginScreen onLoginSuccess={(u) => setUser(u)} />
        )}
      </AlertProvider>
    </SafeAreaProvider>
  );
}
