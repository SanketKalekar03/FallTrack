import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';
import React, { useState, useEffect, useRef } from 'react';
import { View, ActivityIndicator, Animated, StyleSheet, Text, Image } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import packageJson from './package.json';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Circle, G, Rect } from 'react-native-svg';

// Keep native splash screen visible while loading custom JS animations
SplashScreen.preventAutoHideAsync().catch(() => {});
import { 
  LayoutDashboard, 
  PlusCircle, 
  History, 
  Coins, 
  Settings,
  Plus,
  ShieldCheck
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
import { InitialSetupScreen } from './src/screens/InitialSetupScreen';
import { settingsService } from './src/services/settingsService';
import type { InitialSetupData } from './src/types';

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

// Custom Spool & Needle Icon for Splash Screen (matches mockup logo exactly)
const SpoolIcon = () => (
  <Svg width={90} height={90} viewBox="0 0 100 100">
    <G fill="none" stroke="#0F52BA" strokeWidth="4.2" strokeLinecap="round" strokeLinejoin="round">
      {/* Spool Top core stem */}
      <Rect x="47" y="12" width="6" height="6" rx="1.5" fill="#0F52BA" stroke="none" />
      
      {/* Spool Top flange cap */}
      <Path d="M 38,18 L 62,18 L 59,22 L 41,22 Z" fill="#0F52BA" stroke="none" />

      {/* Main Thread Body (Cylinder cone wound with thread) */}
      <Path d="M 40,22 L 60,22 L 66,66 L 34,66 Z" fill="#0F52BA" />

      {/* Diagonal Thread Winding Wraps (White lines on the blue thread body with 3D curves) */}
      <Path d="M 40,27 C 48,32 52,32 60,28" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" />
      <Path d="M 39,34 C 48,39 52,39 61,35" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" />
      <Path d="M 38,41 C 48,46 52,46 62,42" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" />
      <Path d="M 36,48 C 48,53 52,53 64,49" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" />
      <Path d="M 35,55 C 48,60 52,60 65,56" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" />
      <Path d="M 34,62 C 48,67 52,67 66,63" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" />

      {/* Bottom flange base */}
      <Path d="M 32,66 L 68,66 L 70,70 L 30,70 Z" fill="#0F52BA" stroke="none" />
      
      {/* Spool Bottom core stem */}
      <Rect x="47" y="70" width="6" height="6" rx="1.5" fill="#0F52BA" stroke="none" />

      {/* Loop of thread coming out from the top-right, sweeping around the spool */}
      <Path d="M 59,20 C 72,12 85,25 78,45 C 72,60 55,80 25,80 C 12,80 15,68 28,68 C 42,68 52,74 72,70" stroke="#0F52BA" strokeWidth="4.2" fill="none" />

      {/* Needle piercing through the bottom-left loop */}
      <Path d="M 12,78 L 38,52" stroke="#0F52BA" strokeWidth="4.2" />
      {/* Needle eye near the bottom-left */}
      <Circle cx={15} cy={75} r={1.2} fill="#0F52BA" />
    </G>
  </Svg>
);

export default function App() {
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isSplashAnimationComplete, setIsSplashAnimationComplete] = useState(false);
  const [isSetupCompleted, setIsSetupCompleted] = useState<boolean | null>(null);
  const [setupChecking, setSetupChecking] = useState<boolean>(false);

  const logoScale = useRef(new Animated.Value(0.5)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const splashOpacity = useRef(new Animated.Value(1)).current;

  // New animators for progress loading and sequential text entrance
  const loaderProgress = useRef(new Animated.Value(-60)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const marathiOpacity = useRef(new Animated.Value(0)).current;

  // Verify setup completion when authenticated user changes
  useEffect(() => {
    if (!user) {
      setIsSetupCompleted(null);
      setSetupChecking(false);
      return;
    }

    let isMounted = true;
    const checkSetup = async () => {
      setSetupChecking(true);
      try {
        const { isSetupCompleted } = await settingsService.getUserSettings(user.id);
        if (isMounted) {
          setIsSetupCompleted(isSetupCompleted);
        }
      } catch (err) {
        console.warn('Error checking mobile setup status:', err);
        if (isMounted) {
          setIsSetupCompleted(false);
        }
      } finally {
        if (isMounted) {
          setSetupChecking(false);
        }
      }
    };

    checkSetup();
    return () => {
      isMounted = false;
    };
  }, [user]);

  const handleInitialSetupComplete = async (data: InitialSetupData) => {
    if (!user) return;
    await settingsService.completeInitialSetup(user.id, data);
    setIsSetupCompleted(true);
  };

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
      Animated.sequence([
        Animated.delay(250),
        Animated.timing(textOpacity, {
          toValue: 1.0,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(marathiOpacity, {
          toValue: 1.0,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    // 3. Start checking auth session
    initSession();
  }, []);

  // 4. Looping linear progress bar translation animation for the loader
  useEffect(() => {
    if (isSplashAnimationComplete) return;
    let isMounted = true;
    
    const animateProgress = () => {
      if (!isMounted) return;
      loaderProgress.setValue(-60);
      Animated.timing(loaderProgress, {
        toValue: 160,
        duration: 1200,
        useNativeDriver: true,
      }).start(() => {
        if (isMounted) animateProgress();
      });
    };
    
    animateProgress();
    return () => {
      isMounted = false;
    };
  }, [isSplashAnimationComplete]);

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
      setIsSetupCompleted(null);
    } catch (e) {
      console.warn('Sign out failed:', e);
    } finally {
      setAuthLoading(false);
    }
  };

  // Render animated splash screen while loading
  if (!isSplashAnimationComplete) {
    return (
      <View style={{ flex: 1 }}>
        <StatusBar style="light" />
        <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: splashOpacity }]}>
          {/* Photo-realistic background image of spools in factory */}
          <Image
            source={require('./assets/splash_bg.jpg')}
            style={[StyleSheet.absoluteFillObject, { width: '100%', height: '100%' }]}
            resizeMode="cover"
          />
          {/* Royal blue semi-transparent gradient overlay to blend the background photo */}
          <LinearGradient
            colors={['rgba(15, 82, 186, 0.55)', 'rgba(10, 46, 102, 0.82)']}
            style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
          >

            {/* Central White Spool Circle Logo */}
            <Animated.View style={{
              alignItems: 'center',
              transform: [{ scale: logoScale }],
              opacity: logoOpacity,
            }}>
              <View style={{
                width: 140,
                height: 140,
                borderRadius: 70,
                backgroundColor: '#FFFFFF',
                justifyContent: 'center',
                alignItems: 'center',
                shadowColor: '#000000',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.18,
                shadowRadius: 10,
                elevation: 8,
                marginBottom: 24,
              }}>
                <SpoolIcon />
              </View>
            </Animated.View>

            {/* App Name & English Taglines */}
            <Animated.View style={{ alignItems: 'center', opacity: textOpacity }}>
              <Text style={{ fontSize: 32, fontWeight: '900', color: '#FFFFFF', letterSpacing: 1.5, textTransform: 'uppercase' }}>
                FallTrack
              </Text>
              <Text style={{ fontSize: 13, fontWeight: '600', color: 'rgba(255, 255, 255, 0.75)', marginTop: 8, letterSpacing: 0.5, textAlign: 'center' }}>
                Smart Production Tracking
              </Text>
              <Text style={{ fontSize: 13, fontWeight: '600', color: 'rgba(255, 255, 255, 0.75)', marginTop: 2, letterSpacing: 0.5, textAlign: 'center' }}>
                for Textile Industries
              </Text>
            </Animated.View>

            {/* Marathi Tagline */}
            <Animated.View style={{ alignItems: 'center', opacity: marathiOpacity, marginTop: 24 }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: 'rgba(255, 255, 255, 0.9)', fontStyle: 'italic', letterSpacing: 0.2 }}>
                उत्पादन नोंदवा, व्यवसाय वाढवा.
              </Text>
            </Animated.View>

            {/* Horizontal Line Loading Indicator */}
            <View style={{ 
              width: 160, 
              height: 3, 
              backgroundColor: 'rgba(255, 255, 255, 0.2)', 
              borderRadius: 1.5, 
              overflow: 'hidden', 
              marginTop: 48, 
              marginBottom: 12 
            }}>
              <Animated.View style={{
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: 60,
                backgroundColor: '#FFFFFF',
                borderRadius: 1.5,
                transform: [{ translateX: loaderProgress }]
              }} />
            </View>
            <Text style={{ fontSize: 11, fontWeight: '600', color: 'rgba(255, 255, 255, 0.5)', letterSpacing: 1 }}>
              Loading...
            </Text>

            {/* Bottom Safe-Area Branding Footer */}
            <View style={{ position: 'absolute', bottom: 80, alignItems: 'center' }}>
              <View style={{ 
                flexDirection: 'row', 
                alignItems: 'center', 
                backgroundColor: 'rgba(255, 255, 255, 0.08)', 
                paddingHorizontal: 12, 
                paddingVertical: 6, 
                borderRadius: 20, 
                marginBottom: 8 
              }}>
                <ShieldCheck size={13} color="#10B981" style={{ marginRight: 6 }} />
                <Text style={{ fontSize: 9, fontWeight: '800', color: '#E2E8F0', letterSpacing: 0.8, textTransform: 'uppercase' }}>
                  Secure Production Ledger
                </Text>
              </View>
              <Text style={{ fontSize: 10, fontWeight: '700', color: 'rgba(255, 255, 255, 0.35)', letterSpacing: 0.8 }}>
                VERSION {packageJson.version}
              </Text>
            </View>
          </LinearGradient>
        </Animated.View>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AlertProvider>
        {!user ? (
          <LoginScreen onLoginSuccess={(u) => setUser(u)} />
        ) : setupChecking || isSetupCompleted === null ? (
          <View style={{ flex: 1, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : isSetupCompleted === false ? (
          <InitialSetupScreen
            userEmail={user.email}
            onComplete={handleInitialSetupComplete}
            onSignOut={handleLogout}
          />
        ) : (
          <MainNavigator user={user} handleLogout={handleLogout} />
        )}
      </AlertProvider>
    </SafeAreaProvider>
  );
}
