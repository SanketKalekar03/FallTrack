import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  ActivityIndicator, 
  KeyboardAvoidingView, 
  Platform, 
  ScrollView 
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Mail, Lock, Sparkles, ArrowRight, ShieldCheck, CloudLightning } from 'lucide-react-native';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAlert } from '../components/AlertProvider';
import { COLORS } from '../utils/theme';
import { migrateLocalDefaultToUserMobile, syncLocalDataToCloudMobile } from '../services/dbService';

interface LoginScreenProps {
  onLoginSuccess: (user: { id: string; email: string }) => void;
}

// Simple base64 encoding/decoding representation for local hashing helper
const hashPassword = (password: string): string => {
  try {
    return btoa(password);
  } catch (e) {
    // Basic fallback encoding
    return password.split('').reverse().join('');
  }
};

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const insets = useSafeAreaInsets();
  const { showToast, showAlert } = useAlert();
  
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const mode = isSupabaseConfigured ? 'online' : 'offline';

  const handleToggleMode = () => {
    setIsSignUp(prev => !prev);
    setEmail('');
    setPassword('');
    setConfirmPassword('');
  };

  const handleSubmit = async () => {
    if (!email.trim() || !password) {
      showAlert('Validation Error', 'Please fill in all fields.');
      return;
    }

    if (password.length < 6) {
      showAlert('Validation Error', 'Password must be at least 6 characters.');
      return;
    }

    const cleanEmail = email.trim().toLowerCase();

    setLoading(true);

    if (mode === 'online' && supabase) {
      try {
        if (isSignUp) {
          if (password !== confirmPassword) {
            setLoading(false);
            showAlert('Validation Error', 'Passwords do not match.');
            return;
          }

          const { data, error } = await supabase.auth.signUp({
            email: cleanEmail,
            password
          });

          if (error) throw error;

          if (data.user) {
            showToast('Account created successfully!', 'success');
            await AsyncStorage.setItem('falltrack_active_user_id', data.user.id);
            await migrateLocalDefaultToUserMobile(data.user.id);
            await syncLocalDataToCloudMobile(data.user.id);
            onLoginSuccess({ id: data.user.id, email: data.user.email || '' });
          } else {
            showAlert('Sign Up', 'Please check your email to verify your account.');
            setIsSignUp(false);
          }
        } else {
          const { data, error } = await supabase.auth.signInWithPassword({
            email: cleanEmail,
            password
          });

          if (error) throw error;

          if (data.user) {
            showToast('Welcome back!', 'success');
            await AsyncStorage.setItem('falltrack_active_user_id', data.user.id);
            await migrateLocalDefaultToUserMobile(data.user.id);
            await syncLocalDataToCloudMobile(data.user.id);
            onLoginSuccess({ id: data.user.id, email: data.user.email || '' });
          }
        }
      } catch (err: any) {
        showAlert('Authentication Error', err.message || 'Failed to authenticate.');
      } finally {
        setLoading(false);
      }
    } else {
      // Local/Offline Mode auth
      try {
        const localUsersData = await AsyncStorage.getItem('falltrack_local_users');
        const localUsers: any[] = localUsersData ? JSON.parse(localUsersData) : [];

        if (isSignUp) {
          if (password !== confirmPassword) {
            setLoading(false);
            showAlert('Validation Error', 'Passwords do not match.');
            return;
          }

          const exists = localUsers.some(u => u.email === cleanEmail);
          if (exists) {
            setLoading(false);
            showAlert('Validation Error', 'Email is already registered.');
            return;
          }

          const newUserId = 'local-user-' + Math.random().toString(36).substring(2, 11) + '-' + Date.now().toString(36);
          const newUser = {
            id: newUserId,
            email: cleanEmail,
            passwordHash: hashPassword(password)
          };

          localUsers.push(newUser);
          await AsyncStorage.setItem('falltrack_local_users', JSON.stringify(localUsers));
          await AsyncStorage.setItem('falltrack_active_user_id', newUserId);
          await migrateLocalDefaultToUserMobile(newUserId);

          showToast('Offline account registered!', 'success');
          onLoginSuccess({ id: newUserId, email: cleanEmail });
        } else {
          const matchedUser = localUsers.find(
            u => u.email === cleanEmail && u.passwordHash === hashPassword(password)
          );

          if (!matchedUser) {
            setLoading(false);
            showAlert('Error', 'Invalid email or password.');
            return;
          }

          await AsyncStorage.setItem('falltrack_active_user_id', matchedUser.id);
          await migrateLocalDefaultToUserMobile(matchedUser.id);
          showToast('Welcome back (Offline)!', 'success');
          onLoginSuccess({ id: matchedUser.id, email: matchedUser.email });
        }
      } catch (err: any) {
        showAlert('Error', 'Failed to perform local auth: ' + err.message);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
      style={styles.container}
    >
      <ScrollView 
        contentContainerStyle={[styles.scrollContainer, { paddingTop: insets.top + 30, paddingBottom: insets.bottom + 30 }]} 
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Brand Header */}
        <View style={styles.brandHeader}>
          <View style={styles.logoIcon}>
            <Sparkles size={32} color={COLORS.primary} />
          </View>
          <Text style={styles.brandTitle}>FallTrack</Text>
          <Text style={styles.brandSubtitle}>Production & Income Ledger</Text>
        </View>

        {/* Auth form container */}
        <View style={styles.formContainer}>
          <View style={styles.formHeader}>
            <Text style={styles.formTitle}>
              {isSignUp ? 'Create Account' : 'Welcome Back'}
            </Text>
            {mode === 'offline' && (
              <View style={styles.offlineBadge}>
                <Text style={styles.offlineBadgeText}>Offline Mode</Text>
              </View>
            )}
          </View>

          <Text style={styles.formSubtitle}>
            {isSignUp 
              ? 'Sign up to configure your production logs' 
              : 'Sign in to access your ledger'}
          </Text>

          {/* Email input */}
          <View style={styles.inputWrapper}>
            <Text style={styles.inputLabel}>Email Address</Text>
            <View style={styles.inputContainer}>
              <Mail size={16} color={COLORS.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="name@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          {/* Password input */}
          <View style={styles.inputWrapper}>
            <Text style={styles.inputLabel}>Password</Text>
            <View style={styles.inputContainer}>
              <Lock size={16} color={COLORS.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          {/* Confirm Password input */}
          {isSignUp && (
            <View style={styles.inputWrapper}>
              <Text style={styles.inputLabel}>Confirm Password</Text>
              <View style={styles.inputContainer}>
                <Lock size={16} color={COLORS.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="••••••••"
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>
          )}

          {/* Submit button */}
          <TouchableOpacity 
            style={styles.submitBtn} 
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <View style={styles.submitBtnRow}>
                <Text style={styles.submitBtnText}>
                  {isSignUp ? 'Register Account' : 'Sign In'}
                </Text>
                <ArrowRight size={16} color="#FFFFFF" />
              </View>
            )}
          </TouchableOpacity>

          {/* Toggle mode */}
          <TouchableOpacity 
            style={styles.toggleModeBtn} 
            onPress={handleToggleMode}
          >
            <Text style={styles.toggleModeText}>
              {isSignUp 
                ? 'Already have an account? Sign In' 
                : "Don't have an account? Sign Up"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContainer: {
    paddingHorizontal: 20,
    justifyContent: 'center',
    flexGrow: 1,
  },
  brandHeader: {
    alignItems: 'center',
    marginBottom: 32,
    marginTop: 10,
  },
  logoIcon: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: COLORS.lavender,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(2, 132, 199, 0.1)',
  },
  brandTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: 0.5,
  },
  brandSubtitle: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 4,
    fontWeight: '600',
  },
  formContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 24,
    elevation: 3,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
  },
  formHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text,
  },
  offlineBadge: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  offlineBadgeText: {
    color: '#D97706',
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  formSubtitle: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginBottom: 20,
  },
  inputWrapper: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    height: 46,
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    padding: 0,
  },
  submitBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    height: 46,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  submitBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  toggleModeBtn: {
    alignItems: 'center',
    marginTop: 16,
    paddingVertical: 4,
  },
  toggleModeText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
});
