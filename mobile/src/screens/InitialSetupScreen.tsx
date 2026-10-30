import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  SafeAreaView
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  User, 
  Sparkles, 
  ArrowRight, 
  AlertCircle, 
  LogOut,
  IndianRupee,
  Phone
} from 'lucide-react-native';
import { COLORS } from '../utils/theme';
import type { InitialSetupData } from '../types';
import { normalizeIndianMobile } from '../services/settingsService';

interface InitialSetupScreenProps {
  userEmail: string;
  onComplete: (data: InitialSetupData) => Promise<void>;
  onSignOut: () => void;
}

export const InitialSetupScreen: React.FC<InitialSetupScreenProps> = ({
  userEmail,
  onComplete,
  onSignOut
}) => {
  const [managerName, setManagerName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [ratePerDozen, setRatePerDozen] = useState('5.00');

  const [errors, setErrors] = useState<{
    managerName?: string;
    mobileNumber?: string;
    ratePerDozen?: string;
    general?: string;
  }>({});

  const [touched, setTouched] = useState<{
    managerName?: boolean;
    mobileNumber?: boolean;
    ratePerDozen?: boolean;
  }>({});

  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateField = (field: 'managerName' | 'mobileNumber' | 'ratePerDozen', value: string) => {
    switch (field) {
      case 'managerName': {
        const trimmed = value.trim();
        if (!trimmed) return 'Manager name is required.';
        if (trimmed.length < 2) return 'Manager name must be at least 2 characters.';
        return undefined;
      }
      case 'mobileNumber': {
        const digits = value.replace(/\D/g, '');
        if (!digits) return 'Mobile number is required.';
        if (digits.length !== 10) return 'Mobile number must be exactly 10 digits.';
        if (!/^[6-9]/.test(digits)) {
          return 'Must be an Indian mobile number starting with 6, 7, 8, or 9.';
        }
        return undefined;
      }
      case 'ratePerDozen': {
        const num = parseFloat(value.trim());
        if (value.trim() === '' || isNaN(num)) return 'Rate per dozen is required.';
        if (num <= 0) return 'Rate must be a positive amount greater than 0.';
        if (num > 10000) return 'Rate cannot exceed ₹10,000.00.';
        return undefined;
      }
    }
  };

  const handleBlur = (field: 'managerName' | 'mobileNumber' | 'ratePerDozen') => {
    setTouched(prev => ({ ...prev, [field]: true }));
    let val = '';
    if (field === 'managerName') val = managerName;
    if (field === 'mobileNumber') val = mobileNumber;
    if (field === 'ratePerDozen') val = ratePerDozen;

    const error = validateField(field, val);
    setErrors(prev => ({ ...prev, [field]: error }));
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;

    const nameErr = validateField('managerName', managerName);
    const phoneErr = validateField('mobileNumber', mobileNumber);
    const rateErr = validateField('ratePerDozen', ratePerDozen);

    setTouched({
      managerName: true,
      mobileNumber: true,
      ratePerDozen: true
    });

    if (nameErr || phoneErr || rateErr) {
      setErrors({
        managerName: nameErr,
        mobileNumber: phoneErr,
        ratePerDozen: rateErr
      });
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    try {
      const cleanPhone = normalizeIndianMobile(mobileNumber);
      const cleanRate = Number(parseFloat(ratePerDozen).toFixed(2));

      await onComplete({
        managerName: managerName.trim(),
        mobileNumber: cleanPhone,
        ratePerDozen: cleanRate
      });
    } catch (err: any) {
      setErrors(prev => ({
        ...prev,
        general: err.message || 'Failed to save configuration. Please try again.'
      }));
      setIsSubmitting(false);
    }
  };

  const parsedRate = parseFloat(ratePerDozen || '0');
  const displayRate = parsedRate > 0 ? parsedRate.toFixed(2) : '5.00';

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.card}>
            {/* Header Area */}
            <LinearGradient
              colors={['#E0F2FE', '#F0F9FF']}
              style={styles.headerGradient}
            >
              <View style={styles.headerRow}>
                {/* Logo Badge */}
                <View style={styles.brandRow}>
                  <View style={styles.logoBadge}>
                    <Text style={styles.logoText}>FT</Text>
                  </View>
                  <View>
                    <Text style={styles.brandTitle}>FallTrack</Text>
                    <Text style={styles.brandSubtitle}>INITIAL SETUP</Text>
                  </View>
                </View>

                {/* User & Sign Out */}
                <View style={styles.userBadgeCol}>
                  <View style={styles.userBadge}>
                    <User size={12} color={COLORS.primary} style={{ marginRight: 4 }} />
                    <Text numberOfLines={1} style={styles.userBadgeText}>
                      {userEmail}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={onSignOut}
                    disabled={isSubmitting}
                    style={styles.signOutBtn}
                  >
                    <LogOut size={12} color="#EF4444" style={{ marginRight: 4 }} />
                    <Text style={styles.signOutText}>Sign out</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <Text style={styles.welcomeTitle}>Welcome to FallTrack</Text>
              <Text style={styles.welcomeDesc}>
                Set up your manager workspace to start recording daily saree fall production.
              </Text>
            </LinearGradient>

            {/* Form Fields */}
            <View style={styles.formContainer}>
              {/* General Error Banner */}
              {errors.general && (
                <View style={styles.generalErrorBox}>
                  <AlertCircle size={16} color="#DC2626" style={{ marginRight: 8, marginTop: 2 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.generalErrorTitle}>Setup Failed</Text>
                    <Text style={styles.generalErrorText}>{errors.general}</Text>
                  </View>
                </View>
              )}

              {/* Field 1: Manager Name */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>
                  Manager Name <Text style={{ color: '#EF4444' }}>*</Text>
                </Text>
                <View style={[
                  styles.inputWrap,
                  errors.managerName && styles.inputErrorBorder
                ]}>
                  <User size={18} color="#94A3B8" style={{ marginLeft: 12, marginRight: 8 }} />
                  <TextInput
                    style={styles.textInput}
                    value={managerName}
                    onChangeText={(val) => {
                      setManagerName(val);
                      if (touched.managerName) {
                        setErrors(prev => ({ ...prev, managerName: validateField('managerName', val) }));
                      }
                    }}
                    onBlur={() => handleBlur('managerName')}
                    placeholder="e.g. Ramesh Patil"
                    placeholderTextColor="#94A3B8"
                    autoCapitalize="words"
                    editable={!isSubmitting}
                  />
                </View>
                {errors.managerName && (
                  <View style={styles.errorRow}>
                    <AlertCircle size={12} color="#EF4444" style={{ marginRight: 4 }} />
                    <Text style={styles.errorText}>{errors.managerName}</Text>
                  </View>
                )}
              </View>

              {/* Field 2: Mobile Number */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>
                  Mobile Number <Text style={{ color: '#EF4444' }}>*</Text>
                </Text>
                <View style={[
                  styles.inputWrap,
                  errors.mobileNumber && styles.inputErrorBorder
                ]}>
                  <View style={styles.prefixBadge}>
                    <Text style={styles.prefixText}>+91</Text>
                  </View>
                  <TextInput
                    style={[styles.textInput, { letterSpacing: 0.8 }]}
                    value={mobileNumber}
                    onChangeText={(val) => {
                      const digits = val.replace(/\D/g, '').slice(0, 10);
                      setMobileNumber(digits);
                      if (touched.mobileNumber) {
                        setErrors(prev => ({ ...prev, mobileNumber: validateField('mobileNumber', digits) }));
                      }
                    }}
                    onBlur={() => handleBlur('mobileNumber')}
                    placeholder="9876543210"
                    placeholderTextColor="#94A3B8"
                    keyboardType="numeric"
                    maxLength={10}
                    editable={!isSubmitting}
                  />
                </View>
                {errors.mobileNumber ? (
                  <View style={styles.errorRow}>
                    <AlertCircle size={12} color="#EF4444" style={{ marginRight: 4 }} />
                    <Text style={styles.errorText}>{errors.mobileNumber}</Text>
                  </View>
                ) : (
                  <Text style={styles.hintText}>
                    Standard 10-digit Indian mobile number (e.g. 9876543210).
                  </Text>
                )}
              </View>

              {/* Field 3: Rate per Dozen */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>
                  Rate per Dozen (₹) <Text style={{ color: '#EF4444' }}>*</Text>
                </Text>
                <View style={[
                  styles.inputWrap,
                  errors.ratePerDozen && styles.inputErrorBorder
                ]}>
                  <View style={styles.prefixBadge}>
                    <Text style={[styles.prefixText, { fontWeight: '900' }]}>₹</Text>
                  </View>
                  <TextInput
                    style={[styles.textInput, { flex: 1 }]}
                    value={ratePerDozen}
                    onChangeText={(val) => {
                      setRatePerDozen(val);
                      if (touched.ratePerDozen) {
                        setErrors(prev => ({ ...prev, ratePerDozen: validateField('ratePerDozen', val) }));
                      }
                    }}
                    onBlur={() => handleBlur('ratePerDozen')}
                    placeholder="5.00"
                    placeholderTextColor="#94A3B8"
                    keyboardType="decimal-pad"
                    editable={!isSubmitting}
                  />
                  <View style={styles.suffixBadge}>
                    <Text style={styles.suffixText}>/ dozen</Text>
                  </View>
                </View>
                {errors.ratePerDozen ? (
                  <View style={styles.errorRow}>
                    <AlertCircle size={12} color="#EF4444" style={{ marginRight: 4 }} />
                    <Text style={styles.errorText}>{errors.ratePerDozen}</Text>
                  </View>
                ) : (
                  <View style={styles.formulaBadge}>
                    <Sparkles size={13} color={COLORS.primary} style={{ marginRight: 6 }} />
                    <Text style={styles.formulaText}>
                      <Text style={{ fontWeight: '700' }}>Formula: </Text>
                      12 falls = 1 dozen. (Falls ÷ 12) × ₹{displayRate}
                    </Text>
                  </View>
                )}
              </View>

              {/* Submit Button */}
              <TouchableOpacity
                onPress={handleSubmit}
                disabled={isSubmitting}
                activeOpacity={0.85}
                style={styles.submitBtn}
              >
                {isSubmitting ? (
                  <View style={styles.btnRow}>
                    <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
                    <Text style={styles.submitBtnText}>Configuring Workspace...</Text>
                  </View>
                ) : (
                  <View style={styles.btnRow}>
                    <Text style={styles.submitBtnText}>Complete Setup & Continue</Text>
                    <ArrowRight size={18} color="#FFFFFF" style={{ marginLeft: 6 }} />
                  </View>
                )}
              </TouchableOpacity>

              <Text style={styles.footerNotice}>
                Setup is required once to personalize your workspace & calculate piece-rate earnings accurately.
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 16,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  headerGradient: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  logoText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  brandTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
    lineHeight: 18,
  },
  brandSubtitle: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: 0.8,
  },
  userBadgeCol: {
    alignItems: 'flex-end',
    maxWidth: 160,
  },
  userBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  userBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
    maxWidth: 110,
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  signOutText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#EF4444',
  },
  welcomeTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  welcomeDesc: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 4,
    lineHeight: 17,
  },
  formContainer: {
    padding: 20,
  },
  generalErrorBox: {
    flexDirection: 'row',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  generalErrorTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#991B1B',
  },
  generalErrorText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#B91C1C',
    marginTop: 2,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#334155',
    marginBottom: 6,
    letterSpacing: 0.2,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    height: 46,
    overflow: 'hidden',
  },
  inputErrorBorder: {
    borderColor: '#EF4444',
    backgroundColor: '#FFF5F5',
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    paddingHorizontal: 12,
  },
  prefixBadge: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 12,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#CBD5E1',
  },
  prefixText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#475569',
  },
  suffixBadge: {
    paddingHorizontal: 12,
    height: '100%',
    justifyContent: 'center',
  },
  suffixText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  errorText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#EF4444',
  },
  hintText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#94A3B8',
    marginTop: 4,
  },
  formulaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 6,
  },
  formulaText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#0369A1',
    flex: 1,
  },
  submitBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 6,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  footerNotice: {
    fontSize: 10,
    fontWeight: '500',
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 14,
  },
});
