import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  TextInput, 
  ActivityIndicator, 
  Modal,
  FlatList
} from 'react-native';
import { useAlert } from '../components/AlertProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { 
  Settings, 
  User, 
  Database, 
  Phone, 
  Save, 
  AlertCircle,
  Palette,
  ChevronRight,
  Plus,
  Trash2,
  Edit2,
  X,
  Search,
  Check,
  LogOut,
  TrendingUp,
  BarChart3,
  Calendar
} from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { dbService } from '../services/dbService';
import { isSupabaseConfigured } from '../lib/supabase';
import { COLORS } from '../utils/theme';
import { exportEntriesToPDFMobile, saveEntriesToPDFMobile, exportEntriesToCSVMobile } from '../utils/reportExport';
import { matchColor } from '../utils/transliterate';
import { formatDateToDDMMYYYY } from '../utils/dateFormatter';

export const SettingsScreen = ({ navigation, onLogout, userEmail }: { navigation: any; onLogout: () => void; userEmail: string }) => {
  const insets = useSafeAreaInsets();
  const { showToast, showAlert, showConfirm } = useAlert();
  const [loading, setLoading] = useState(false);

  // Form states
  const [appName, setAppName] = useState('FallTrack');
  const [managerName, setManagerName] = useState('');
  const [managerPhone, setManagerPhone] = useState('9876543210');

  // Color Management states
  const [isColorModalVisible, setIsColorModalVisible] = useState(false);
  const [colorsList, setColorsList] = useState<(any)[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [newColorName, setNewColorName] = useState('');
  const [editingColorId, setEditingColorId] = useState<string | null>(null);
  const [editingColorName, setEditingColorName] = useState('');
  const [colorLoading, setColorLoading] = useState(false);

  // Rate Management states
  const [isRateModalVisible, setIsRateModalVisible] = useState(false);
  const [ratesList, setRatesList] = useState<(any)[]>([]);
  const [newRateValue, setNewRateValue] = useState('');
  const [rateEffectiveFrom, setRateEffectiveFrom] = useState(new Date());
  const [showRateDatePicker, setShowRateDatePicker] = useState(false);
  const [rateLoading, setRateLoading] = useState(false);

  // Reports & Export states
  const [isReportsModalVisible, setIsReportsModalVisible] = useState(false);
  const [reportType, setReportType] = useState<'daily' | 'monthly' | 'yearly' | 'custom'>('custom');
  const [reportStartDate, setReportStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1); // Default to start of month
    return d;
  });
  const [reportEndDate, setReportEndDate] = useState(new Date());
  const [showReportStartPicker, setShowReportStartPicker] = useState(false);
  const [showReportEndPicker, setShowReportEndPicker] = useState(false);
  const [reportEntries, setReportEntries] = useState<(any)[]>([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    loadSettingsData();
  }, []);

  const loadSettingsData = async () => {
    setLoading(true);
    try {
      const profile = await dbService.getProfile();
      setAppName(profile.app_name);
      setManagerName(profile.manager_name);
      setManagerPhone(profile.manager_phone);
    } catch (err) {
      console.warn('Load settings error:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadColorStats = async () => {
    setColorLoading(true);
    try {
      const colors = await dbService.getColors();
      const entries = await dbService.getProductionEntries();
      
      const counts: { [colorId: string]: number } = {};
      entries.forEach(e => {
        if (e.color_id) {
          counts[e.color_id] = (counts[e.color_id] || 0) + 1;
        }
      });

      const mappedColors = colors.map(c => ({
        ...c,
        usageCount: counts[c.id] || 0
      }));

      setColorsList(mappedColors);
    } catch (err) {
      console.warn('Load color stats error:', err);
    } finally {
      setColorLoading(false);
    }
  };

  const handleCreateColor = async () => {
    const name = newColorName.trim();
    if (!name) {
      showAlert('Validation Error', 'Please enter a color name.');
      return;
    }

    const isDuplicate = colorsList.some(
      c => c.name.toLowerCase() === name.toLowerCase()
    );
    if (isDuplicate) {
      showAlert('Validation Error', 'Color is already present in the list.');
      return;
    }

    setColorLoading(true);
    try {
      await dbService.createColor(name);
      setNewColorName('');
      await loadColorStats();
      showToast(`Color "${name}" added successfully!`, 'success');
    } catch (err: any) {
      showAlert('Error', err.message || 'Failed to create color');
    } finally {
      setColorLoading(false);
    }
  };

  const handleSaveEdit = async (id: string) => {
    const name = editingColorName.trim();
    if (!name) {
      showAlert('Validation Error', 'Color name cannot be empty.');
      return;
    }

    const isDuplicate = colorsList.some(
      c => c.id !== id && c.name.toLowerCase() === name.toLowerCase()
    );
    if (isDuplicate) {
      showAlert('Validation Error', 'Color is already present in the list.');
      return;
    }

    setColorLoading(true);
    try {
      await dbService.updateColor(id, name);
      setEditingColorId(null);
      setEditingColorName('');
      await loadColorStats();
      showToast('Color updated successfully!', 'success');
    } catch (err: any) {
      showAlert('Error', err.message || 'Failed to update color');
    } finally {
      setColorLoading(false);
    }
  };

  const handleDeleteColor = async (color: any) => {
    showConfirm(
      'Delete Color',
      `Are you sure you want to delete color "${color.name}"?`,
      async () => {
        setColorLoading(true);
        try {
          await dbService.deleteColor(color.id);
          await loadColorStats();
          showToast(`Color "${color.name}" deleted successfully!`, 'success');
        } catch (err: any) {
          showAlert('Cannot Delete', err.message || 'Failed to delete color');
        } finally {
          setColorLoading(false);
        }
      },
      { isDestructive: true }
    );
  };

  // ==========================================
  // Rate Management Helpers
  // ==========================================
  const loadRatesData = async () => {
    setRateLoading(true);
    try {
      const rates = await dbService.getRates();
      setRatesList(rates);
    } catch (err) {
      console.warn('Load rates error:', err);
    } finally {
      setRateLoading(false);
    }
  };

  const handleCreateRate = async () => {
    const rateVal = parseFloat(newRateValue);
    if (isNaN(rateVal) || rateVal <= 0) {
      showAlert('Validation Error', 'Please enter a valid rate greater than 0.');
      return;
    }

    setRateLoading(true);
    try {
      const dateStr = rateEffectiveFrom.toISOString().split('T')[0];
      await dbService.createRate({
        rate_per_dozen: rateVal,
        effective_from: dateStr
      });
      setNewRateValue('');
      await loadRatesData();
      showToast('New rate set successfully!', 'success');
    } catch (err: any) {
      showAlert('Error', err.message || 'Failed to create rate');
    } finally {
      setRateLoading(false);
    }
  };

  const handleDeleteRate = async (rate: any) => {
    if (ratesList.length <= 1) {
      showAlert('Cannot Delete', 'You must keep at least one active rate card.');
      return;
    }

    showConfirm(
      'Delete Rate Card',
      `Are you sure you want to delete rate card ₹${rate.rate_per_dozen.toFixed(2)} active since ${rate.effective_from}?`,
      async () => {
        setRateLoading(true);
        try {
          await dbService.deleteRate(rate.id);
          await loadRatesData();
          showToast('Rate card deleted successfully!', 'success');
        } catch (err: any) {
          showAlert('Error', err.message || 'Failed to delete rate');
        } finally {
          setRateLoading(false);
        }
      },
      { isDestructive: true }
    );
  };

  const onRateDateChange = (event: any, selectedDate?: Date) => {
    setShowRateDatePicker(false);
    if (selectedDate) {
      setRateEffectiveFrom(selectedDate);
    }
  };

  // ==========================================
  // Reports & Export Helpers
  // ==========================================
  useEffect(() => {
    if (isReportsModalVisible) {
      loadReportsData();
    }
  }, [reportType, reportStartDate, reportEndDate, isReportsModalVisible]);

  const loadReportsData = async () => {
    setReportLoading(true);
    try {
      let entries = [];
      if (reportType === 'daily') {
        const dateStr = reportStartDate.toISOString().split('T')[0];
        entries = await dbService.getProductionEntries({
          startDate: dateStr,
          endDate: dateStr
        });
      } else if (reportType === 'monthly') {
        const year = reportStartDate.getFullYear();
        const month = String(reportStartDate.getMonth() + 1).padStart(2, '0');
        const monthStr = `${year}-${month}`;
        entries = await dbService.getProductionEntries({
          month: monthStr
        });
      } else if (reportType === 'yearly') {
        const yearStr = reportStartDate.getFullYear().toString();
        entries = await dbService.getProductionEntries({
          year: yearStr
        });
      } else { // 'custom'
        const startStr = reportStartDate.toISOString().split('T')[0];
        const endStr = reportEndDate.toISOString().split('T')[0];
        entries = await dbService.getProductionEntries({
          startDate: startStr,
          endDate: endStr
        });
      }
      setReportEntries(entries);
    } catch (err) {
      console.warn('Load reports data error:', err);
    } finally {
      setReportLoading(false);
    }
  };

  const handleExportPDF = async () => {
    if (isExporting) return;
    if (reportEntries.length === 0) {
      showAlert('No Data', 'No production records found in this range to export.');
      return;
    }
    try {
      setIsExporting(true);
      const rates = await dbService.getRates();
      const profile = await dbService.getProfile();
      
      let title = '';
      if (reportType === 'daily') {
        title = `Daily Production Report (${reportStartDate.toLocaleDateString('en-IN')})`;
      } else if (reportType === 'monthly') {
        const monthLabel = reportStartDate.toLocaleString('default', { month: 'long', year: 'numeric' });
        title = `Monthly Production Report (${monthLabel})`;
      } else if (reportType === 'yearly') {
        title = `Yearly Production Report (${reportStartDate.getFullYear()})`;
      } else {
        title = `Production Report (${reportStartDate.toLocaleDateString('en-IN')} - ${reportEndDate.toLocaleDateString('en-IN')})`;
      }
      
      await exportEntriesToPDFMobile(reportEntries, rates, title, profile);
      showToast('Report generated! Choose "Save to files" to download.', 'success');
    } catch (err: any) {
      showAlert('Export Failed', err.message || 'Failed to generate PDF');
    } finally {
      setIsExporting(false);
    }
  };

  const handleSavePDF = async () => {
    if (isExporting) return;
    if (reportEntries.length === 0) {
      showAlert('No Data', 'No production records found in this range to export.');
      return;
    }
    try {
      setIsExporting(true);
      const rates = await dbService.getRates();
      const profile = await dbService.getProfile();
      
      let title = '';
      if (reportType === 'daily') {
        title = `Daily Production Report (${reportStartDate.toLocaleDateString('en-IN')})`;
      } else if (reportType === 'monthly') {
        const monthLabel = reportStartDate.toLocaleString('default', { month: 'long', year: 'numeric' });
        title = `Monthly Production Report (${monthLabel})`;
      } else if (reportType === 'yearly') {
        title = `Yearly Production Report (${reportStartDate.getFullYear()})`;
      } else {
        title = `Production Report (${reportStartDate.toLocaleDateString('en-IN')} - ${reportEndDate.toLocaleDateString('en-IN')})`;
      }
      
      await saveEntriesToPDFMobile(reportEntries, rates, title, profile);
      showToast('PDF Saved/Printed successfully!', 'success');
    } catch (err: any) {
      showAlert('Save Failed', err.message || 'Failed to print PDF');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportCSV = async () => {
    if (isExporting) return;
    if (reportEntries.length === 0) {
      showAlert('No Data', 'No production records found in this range to export.');
      return;
    }
    try {
      setIsExporting(true);
      const rates = await dbService.getRates();
      
      let title = '';
      if (reportType === 'daily') {
        title = `Daily_Report_${reportStartDate.toISOString().split('T')[0]}`;
      } else if (reportType === 'monthly') {
        const year = reportStartDate.getFullYear();
        const month = String(reportStartDate.getMonth() + 1).padStart(2, '0');
        title = `Monthly_Report_${year}_${month}`;
      } else if (reportType === 'yearly') {
        title = `Yearly_Report_${reportStartDate.getFullYear()}`;
      } else {
        title = `Production_Report_${reportStartDate.toISOString().split('T')[0]}_to_${reportEndDate.toISOString().split('T')[0]}`;
      }
      
      await exportEntriesToCSVMobile(reportEntries, rates, title);
      showToast('CSV generated! Choose "Save to files" to download.', 'success');
    } catch (err: any) {
      showAlert('Export Failed', err.message || 'Failed to generate CSV');
    } finally {
      setIsExporting(false);
    }
  };

  const applyQuickFilter = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days);
    setReportStartDate(start);
    setReportEndDate(end);
    setTimeout(() => {
      loadReportsData();
    }, 50);
  };

  const onReportStartDateChange = (event: any, selectedDate?: Date) => {
    setShowReportStartPicker(false);
    if (selectedDate) {
      setReportStartDate(selectedDate);
      setTimeout(() => {
        loadReportsData();
      }, 50);
    }
  };

  const onReportEndDateChange = (event: any, selectedDate?: Date) => {
    setShowReportEndPicker(false);
    if (selectedDate) {
      setReportEndDate(selectedDate);
      setTimeout(() => {
        loadReportsData();
      }, 50);
    }
  };

  const handleSaveProfile = async () => {
    const name = managerName.trim();
    const phone = managerPhone.trim();
    const app = appName.trim();

    if (!name) {
      showAlert('Validation Error', 'Name cannot be empty.');
      return;
    }
    if (!phone) {
      showAlert('Validation Error', 'Phone number cannot be empty.');
      return;
    }

    // Phone number validation: Must be exactly 10 digits
    if (!/^[6-9]\d{9}$/.test(phone)) {
      showAlert('Validation Error', 'Please enter a valid 10-digit Indian phone number.');
      return;
    }

    if (!app) {
      showAlert('Validation Error', 'Application Name cannot be empty.');
      return;
    }

    setLoading(true);
    try {
      await dbService.updateProfile(name, phone, app);
      showToast('Profile settings updated successfully!', 'success');
      
      // Navigate to Dashboard to refresh details
      navigation.navigate('Dashboard');
    } catch (err: any) {
      showAlert('Error', 'Failed to update settings: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>System Settings</Text>
          <Text style={styles.headerSubtitle}>Configure application parameters</Text>
        </View>
        <Settings size={22} color={COLORS.primary} />
      </View>

      {loading && !appName ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          
          {/* Profile Card Summary */}
          <View style={styles.profileSummaryCard}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {managerName ? managerName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'M'}
              </Text>
            </View>
            <Text style={styles.profileNameText}>{managerName}</Text>
            <Text style={styles.profileRoleText}>{userEmail || 'Production Manager'}</Text>
          </View>

          {/* Settings Form */}
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Application Profile</Text>
            
            {/* App Name */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Application Name</Text>
              <View style={styles.inputField}>
                <Settings size={16} color={COLORS.textMuted} style={{ marginRight: 8 }} />
                <TextInput
                  value={appName}
                  onChangeText={setAppName}
                  style={styles.textInput}
                />
              </View>
            </View>

            {/* Manager Name */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Manager Name</Text>
              <View style={styles.inputField}>
                <User size={16} color={COLORS.textMuted} style={{ marginRight: 8 }} />
                <TextInput
                  value={managerName}
                  onChangeText={setManagerName}
                  style={styles.textInput}
                />
              </View>
            </View>

            {/* Phone Number */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Phone Number (10 Digits)</Text>
              <View style={styles.inputField}>
                <Phone size={16} color={COLORS.textMuted} style={{ marginRight: 8 }} />
                <TextInput
                  value={managerPhone}
                  onChangeText={setManagerPhone}
                  keyboardType="phone-pad"
                  maxLength={10}
                  style={styles.textInput}
                />
              </View>
            </View>

            <TouchableOpacity 
              style={styles.saveBtn} 
              onPress={handleSaveProfile}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Save size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.saveBtnText}>Save Settings</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Saree Color Management */}
          <View style={[styles.formSection, { marginTop: 16 }]}>
            <Text style={styles.sectionTitle}>System Management</Text>
            
            {/* Color Management */}
            <TouchableOpacity 
              activeOpacity={0.7}
              style={styles.menuItemCard} 
              onPress={() => {
                loadColorStats();
                setIsColorModalVisible(true);
              }}
            >
              <View style={styles.menuItemLeft}>
                <View style={[styles.menuIconWrapper, { backgroundColor: COLORS.lavender }]}>
                  <Palette size={20} color={COLORS.primary} />
                </View>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={styles.menuItemTitle}>Color Management</Text>
                  <Text style={styles.menuItemDesc}>Manage saree colors and view usage statistics</Text>
                </View>
              </View>
              <ChevronRight size={20} color={COLORS.textMuted} />
            </TouchableOpacity>

            {/* Rate Management */}
            <TouchableOpacity 
              activeOpacity={0.7}
              style={[styles.menuItemCard, { marginTop: 10 }]} 
              onPress={() => {
                loadRatesData();
                setIsRateModalVisible(true);
              }}
            >
              <View style={styles.menuItemLeft}>
                <View style={[styles.menuIconWrapper, { backgroundColor: COLORS.lavender }]}>
                  <TrendingUp size={20} color={COLORS.primary} />
                </View>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={styles.menuItemTitle}>Rate Management</Text>
                  <Text style={styles.menuItemDesc}>Set active production rates and view rate history</Text>
                </View>
              </View>
              <ChevronRight size={20} color={COLORS.textMuted} />
            </TouchableOpacity>

            {/* Reports & Export */}
            <TouchableOpacity 
              activeOpacity={0.7}
              style={[styles.menuItemCard, { marginTop: 10 }]} 
              onPress={() => {
                loadReportsData();
                setIsReportsModalVisible(true);
              }}
            >
              <View style={styles.menuItemLeft}>
                <View style={[styles.menuIconWrapper, { backgroundColor: '#EFF6FF' }]}>
                  <BarChart3 size={20} color="#2563EB" />
                </View>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={styles.menuItemTitle}>Reports & Export</Text>
                  <Text style={styles.menuItemDesc}>Generate summaries and export PDF/CSV data</Text>
                </View>
              </View>
              <ChevronRight size={20} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Database Integration Panel */}
          <View style={[styles.formSection, { marginTop: 16 }]}>
            <Text style={styles.sectionTitle}>Database Status</Text>
            
            <View style={styles.dbStatusCard}>
              <View style={styles.dbStatusHeader}>
                <Database size={20} color={isSupabaseConfigured ? COLORS.success : COLORS.warning} />
                <Text style={[
                  styles.dbStatusTitle,
                  { color: isSupabaseConfigured ? COLORS.success : COLORS.warning }
                ]}>
                  {isSupabaseConfigured ? 'Supabase Sync Mode' : 'Local Offline Mode'}
                </Text>
              </View>

              <Text style={styles.dbStatusDesc}>
                {isSupabaseConfigured 
                  ? 'The app is successfully synced with the cloud database. Your production logs and income periods are securely backed up.'
                  : 'The app is running offline in Local Storage. To connect to Supabase, add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your environment variables.'}
              </Text>
            </View>
          </View>

          {/* Account Management (Logout) */}
          <View style={[styles.formSection, { marginTop: 16 }]}>
            <Text style={styles.sectionTitle}>Account Settings</Text>
            <TouchableOpacity 
              activeOpacity={0.7}
              style={[styles.menuItemCard, { backgroundColor: '#FFF5F5', borderColor: '#FEE2E2' }]} 
              onPress={() => {
                showConfirm(
                  'Sign Out',
                  'Are you sure you want to sign out?',
                  onLogout,
                  { isDestructive: true }
                );
              }}
            >
              <View style={styles.menuItemLeft}>
                <View style={[styles.menuIconWrapper, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
                  <LogOut size={20} color={COLORS.danger} />
                </View>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={[styles.menuItemTitle, { color: COLORS.danger }]}>Sign Out</Text>
                  <Text style={styles.menuItemDesc}>Sign out of your FallTrack account</Text>
                </View>
              </View>
              <ChevronRight size={20} color={COLORS.danger} />
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {/* Saree Color Management Modal */}
      <Modal
        visible={isColorModalVisible}
        animationType="slide"
        onRequestClose={() => setIsColorModalVisible(false)}
      >
        <View style={[styles.modalContainer, { paddingTop: insets.top, flex: 1, backgroundColor: COLORS.background }]}>
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderTitleRow}>
              <Palette size={20} color={COLORS.primary} style={{ marginRight: 8 }} />
              <Text style={styles.modalHeaderTitle}>Color Management</Text>
            </View>
            <TouchableOpacity onPress={() => setIsColorModalVisible(false)} style={styles.closeModalBtn}>
              <X size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          {colorLoading && colorsList.length === 0 ? (
            <View style={styles.modalLoading}>
              <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
          ) : (
            <View style={{ flex: 1, padding: 16 }}>
              {/* Add New Color Form */}
              <View style={styles.addColorCard}>
                <Text style={styles.addColorTitle}>Add New Color</Text>
                <View style={styles.addColorRow}>
                  <TextInput
                    value={newColorName}
                    onChangeText={setNewColorName}
                    placeholder="Enter color name e.g. गुलाबी, काळा"
                    style={[styles.addColorInput, { flex: 1 }]}
                  />
                  <TouchableOpacity 
                    style={styles.addColorBtn} 
                    onPress={handleCreateColor}
                    disabled={colorLoading}
                  >
                    <Plus size={18} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Search Bar */}
              <View style={styles.modalSearchBox}>
                <Search size={16} color={COLORS.textMuted} style={{ marginRight: 8 }} />
                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Search color name..."
                  style={styles.modalSearchInput}
                />
              </View>

              {/* Colors List */}
              <FlatList
                data={colorsList.filter(c => matchColor(c.name, searchQuery))}
                keyExtractor={(item) => item.id}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 32 }}
                renderItem={({ item }) => {
                  const isEditing = editingColorId === item.id;

                  return (
                    <View style={styles.colorItemCard}>
                      {isEditing ? (
                        <View style={styles.inlineEditRow}>
                          <TextInput
                            value={editingColorName}
                            onChangeText={setEditingColorName}
                            style={styles.inlineEditInput}
                            autoFocus
                          />
                          <View style={styles.inlineEditActions}>
                            <TouchableOpacity 
                              style={[styles.inlineActionBtn, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]} 
                              onPress={() => handleSaveEdit(item.id)}
                            >
                              <Check size={18} color={COLORS.success} />
                            </TouchableOpacity>
                            <TouchableOpacity 
                              style={[styles.inlineActionBtn, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]} 
                              onPress={() => setEditingColorId(null)}
                            >
                              <X size={18} color={COLORS.danger} />
                            </TouchableOpacity>
                          </View>
                        </View>
                      ) : (
                        <View style={styles.colorCardRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.colorNameLabel}>{item.name}</Text>
                            <Text style={styles.colorUsageLabel}>
                              {item.usageCount} {item.usageCount === 1 ? 'log' : 'logs'}
                            </Text>
                          </View>
                          <View style={styles.colorCardActions}>
                            <TouchableOpacity 
                              style={[styles.actionBtn, { backgroundColor: COLORS.lavender }]}
                              onPress={() => {
                                setEditingColorId(item.id);
                                setEditingColorName(item.name);
                              }}
                            >
                              <Edit2 size={16} color={COLORS.primary} />
                            </TouchableOpacity>
                            <TouchableOpacity 
                              style={[styles.actionBtn, { backgroundColor: '#FEF2F2' }]}
                              onPress={() => handleDeleteColor(item)}
                            >
                              <Trash2 size={16} color={COLORS.danger} />
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}
                    </View>
                  );
                }}
                ListEmptyComponent={() => (
                  <View style={styles.modalEmptyList}>
                    <Palette size={32} color={COLORS.textMuted} style={{ marginBottom: 8 }} />
                    <Text style={styles.emptyListText}>No saree colors found.</Text>
                  </View>
                )}
              />
            </View>
          )}
        </View>
      </Modal>

      {/* Rate Management Modal */}
      <Modal
        visible={isRateModalVisible}
        animationType="slide"
        onRequestClose={() => setIsRateModalVisible(false)}
      >
        <View style={[styles.modalContainer, { paddingTop: insets.top, flex: 1, backgroundColor: COLORS.background }]}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderTitleRow}>
              <TrendingUp size={20} color={COLORS.primary} style={{ marginRight: 8 }} />
              <Text style={styles.modalHeaderTitle}>Rate Management</Text>
            </View>
            <TouchableOpacity onPress={() => setIsRateModalVisible(false)} style={styles.closeModalBtn}>
              <X size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          {rateLoading && ratesList.length === 0 ? (
            <View style={styles.modalLoading}>
              <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
          ) : (
            <View style={{ flex: 1, padding: 16 }}>
              {/* Form to set rate */}
              <View style={styles.addColorCard}>
                <Text style={styles.addColorTitle}>Set New Active Rate</Text>
                
                <View style={{ marginBottom: 12 }}>
                  <Text style={styles.inputLabel}>Rate Per Dozen (₹)</Text>
                  <TextInput
                    value={newRateValue}
                    onChangeText={setNewRateValue}
                    placeholder="e.g. 5.50"
                    keyboardType="numeric"
                    style={styles.addColorInput}
                  />
                </View>

                <View style={{ marginBottom: 16 }}>
                  <Text style={styles.inputLabel}>Effective From Date</Text>
                  <TouchableOpacity 
                    activeOpacity={0.7}
                    style={styles.modalSearchBox} 
                    onPress={() => setShowRateDatePicker(true)}
                  >
                    <Calendar size={16} color={COLORS.textMuted} style={{ marginRight: 8 }} />
                    <Text style={{ fontSize: 14, fontWeight: '600', color: COLORS.text }}>
                      {rateEffectiveFrom.toLocaleDateString('en-IN')}
                    </Text>
                  </TouchableOpacity>
                </View>

                {showRateDatePicker && (
                  <DateTimePicker
                    value={rateEffectiveFrom}
                    mode="date"
                    display="default"
                    onChange={onRateDateChange}
                  />
                )}

                <TouchableOpacity 
                  style={[styles.saveBtn, { backgroundColor: COLORS.primary }]} 
                  onPress={handleCreateRate}
                  disabled={rateLoading}
                >
                  {rateLoading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.saveBtnText}>Update Rate Card</Text>
                  )}
                </TouchableOpacity>
              </View>

              {/* Rates History List */}
              <FlatList
                data={ratesList}
                keyExtractor={(item) => item.id}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 32 }}
                renderItem={({ item }) => (
                  <View style={styles.colorItemCard}>
                    <View style={styles.colorCardRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.colorNameLabel, { fontSize: 16, color: COLORS.primary }]}>
                          ₹{item.rate_per_dozen.toFixed(2)} / Dozen
                        </Text>
                        <Text style={styles.colorUsageLabel}>
                          Active since: {item.effective_from}
                        </Text>
                      </View>
                      <TouchableOpacity 
                        style={[styles.actionBtn, { backgroundColor: '#FEF2F2' }]}
                        onPress={() => handleDeleteRate(item)}
                      >
                        <Trash2 size={16} color={COLORS.danger} />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
                ListEmptyComponent={() => (
                  <View style={styles.modalEmptyList}>
                    <TrendingUp size={32} color={COLORS.textMuted} style={{ marginBottom: 8 }} />
                    <Text style={styles.emptyListText}>No production rates set.</Text>
                  </View>
                )}
              />
            </View>
          )}
        </View>
      </Modal>

      {/* Reports & Export Modal */}
      <Modal
        visible={isReportsModalVisible}
        animationType="slide"
        onRequestClose={() => setIsReportsModalVisible(false)}
      >
        <View style={[styles.modalContainer, { paddingTop: insets.top, flex: 1, backgroundColor: COLORS.background }]}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderTitleRow}>
              <BarChart3 size={20} color="#2563EB" style={{ marginRight: 8 }} />
              <Text style={styles.modalHeaderTitle}>Reports & Export</Text>
            </View>
            <TouchableOpacity onPress={() => setIsReportsModalVisible(false)} style={styles.closeModalBtn}>
              <X size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          {reportLoading && reportEntries.length === 0 ? (
            <View style={styles.modalLoading}>
              <ActivityIndicator size="large" color="#2563EB" />
            </View>
          ) : (
            <View style={{ flex: 1, padding: 16 }}>
              {/* Report Type Selector */}
              <View style={styles.tabSelector}>
                <TouchableOpacity 
                  style={[styles.tabButton, reportType === 'daily' && styles.activeTabButton]}
                  onPress={() => setReportType('daily')}
                >
                  <Text style={[styles.tabButtonText, reportType === 'daily' && styles.activeTabButtonText]}>Daily</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.tabButton, reportType === 'monthly' && styles.activeTabButton]}
                  onPress={() => setReportType('monthly')}
                >
                  <Text style={[styles.tabButtonText, reportType === 'monthly' && styles.activeTabButtonText]}>Monthly</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.tabButton, reportType === 'yearly' && styles.activeTabButton]}
                  onPress={() => setReportType('yearly')}
                >
                  <Text style={[styles.tabButtonText, reportType === 'yearly' && styles.activeTabButtonText]}>Yearly</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.tabButton, reportType === 'custom' && styles.activeTabButton]}
                  onPress={() => setReportType('custom')}
                >
                  <Text style={[styles.tabButtonText, reportType === 'custom' && styles.activeTabButtonText]}>Custom</Text>
                </TouchableOpacity>
              </View>

              {/* Date Filters Card */}
              <View style={styles.addColorCard}>
                <Text style={styles.addColorTitle}>
                  {reportType === 'daily' && 'Select Date'}
                  {reportType === 'monthly' && 'Select Month'}
                  {reportType === 'yearly' && 'Select Year'}
                  {reportType === 'custom' && 'Select Date Range'}
                </Text>
                
                {reportType === 'custom' && (
                  <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.inputLabel}>Start Date</Text>
                      <TouchableOpacity 
                        activeOpacity={0.7}
                        style={[styles.modalSearchBox, { marginBottom: 0 }]} 
                        onPress={() => setShowReportStartPicker(true)}
                      >
                        <Calendar size={14} color={COLORS.textMuted} style={{ marginRight: 6 }} />
                        <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.text }}>
                          {reportStartDate.toLocaleDateString('en-IN')}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={styles.inputLabel}>End Date</Text>
                      <TouchableOpacity 
                        activeOpacity={0.7}
                        style={[styles.modalSearchBox, { marginBottom: 0 }]} 
                        onPress={() => setShowReportEndPicker(true)}
                      >
                        <Calendar size={14} color={COLORS.textMuted} style={{ marginRight: 6 }} />
                        <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.text }}>
                          {reportEndDate.toLocaleDateString('en-IN')}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {reportType === 'daily' && (
                  <View style={{ marginBottom: 16 }}>
                    <Text style={styles.inputLabel}>Date</Text>
                    <TouchableOpacity 
                      activeOpacity={0.7}
                      style={[styles.modalSearchBox, { marginBottom: 0 }]} 
                      onPress={() => setShowReportStartPicker(true)}
                    >
                      <Calendar size={16} color={COLORS.textMuted} style={{ marginRight: 8 }} />
                      <Text style={{ fontSize: 14, fontWeight: '600', color: COLORS.text }}>
                        {reportStartDate.toLocaleDateString('en-IN')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {reportType === 'monthly' && (
                  <View style={{ marginBottom: 16 }}>
                    <Text style={styles.inputLabel}>Month</Text>
                    <TouchableOpacity 
                      activeOpacity={0.7}
                      style={[styles.modalSearchBox, { marginBottom: 0 }]} 
                      onPress={() => setShowReportStartPicker(true)}
                    >
                      <Calendar size={16} color={COLORS.textMuted} style={{ marginRight: 8 }} />
                      <Text style={{ fontSize: 14, fontWeight: '600', color: COLORS.text }}>
                        {reportStartDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {reportType === 'yearly' && (
                  <View style={{ marginBottom: 16 }}>
                    <Text style={styles.inputLabel}>Year</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 12, height: 44 }}>
                      <TouchableOpacity 
                        style={{ padding: 6, backgroundColor: '#FFFFFF', borderRadius: 6, borderWidth: 1, borderColor: COLORS.border }}
                        onPress={() => {
                          const newDate = new Date(reportStartDate);
                          newDate.setFullYear(newDate.getFullYear() - 1);
                          setReportStartDate(newDate);
                        }}
                      >
                        <Text style={{ fontSize: 16, fontWeight: '800', color: COLORS.text }}> - </Text>
                      </TouchableOpacity>
                      <Text style={{ fontSize: 16, fontWeight: '800', color: COLORS.text }}>
                        {reportStartDate.getFullYear()}
                      </Text>
                      <TouchableOpacity 
                        style={{ padding: 6, backgroundColor: '#FFFFFF', borderRadius: 6, borderWidth: 1, borderColor: COLORS.border }}
                        onPress={() => {
                          const newDate = new Date(reportStartDate);
                          newDate.setFullYear(newDate.getFullYear() + 1);
                          setReportStartDate(newDate);
                        }}
                      >
                        <Text style={{ fontSize: 16, fontWeight: '800', color: COLORS.text }}> + </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {showReportStartPicker && (
                  <DateTimePicker
                    value={reportStartDate}
                    mode="date"
                    display="default"
                    onChange={onReportStartDateChange}
                  />
                )}

                {showReportEndPicker && (
                  <DateTimePicker
                    value={reportEndDate}
                    mode="date"
                    display="default"
                    onChange={onReportEndDateChange}
                  />
                )}

                {reportType === 'custom' && (
                  <View style={{ flexDirection: 'row', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
                    <TouchableOpacity 
                      style={{ backgroundColor: '#F1F5F9', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 }}
                      onPress={() => applyQuickFilter(7)}
                    >
                      <Text style={{ fontSize: 10, fontWeight: '700', color: '#475569' }}>Last 7 Days</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={{ backgroundColor: '#F1F5F9', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 }}
                      onPress={() => applyQuickFilter(30)}
                    >
                      <Text style={{ fontSize: 10, fontWeight: '700', color: '#475569' }}>Last 30 Days</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={{ backgroundColor: '#F1F5F9', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 }}
                      onPress={() => applyQuickFilter(90)}
                    >
                      <Text style={{ fontSize: 10, fontWeight: '700', color: '#475569' }}>Last 3 Months</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Export Buttons */}
                <View style={{ gap: 8 }}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity 
                      style={{ flex: 1, backgroundColor: '#2563EB', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 8, opacity: isExporting ? 0.6 : 1 }}
                      onPress={handleExportPDF}
                      disabled={isExporting}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '700', color: '#FFFFFF' }}>Share PDF</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={{ flex: 1, backgroundColor: '#475569', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 8, opacity: isExporting ? 0.6 : 1 }}
                      onPress={handleSavePDF}
                      disabled={isExporting}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '700', color: '#FFFFFF' }}>Download PDF</Text>
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity 
                    style={{ backgroundColor: '#059669', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 8, opacity: isExporting ? 0.6 : 1 }}
                    onPress={handleExportCSV}
                    disabled={isExporting}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#FFFFFF' }}>Export CSV</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Summary Stats */}
              {reportEntries.length > 0 && (
                <View style={{ backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, padding: 12, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-around' }}>
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ fontSize: 10, color: COLORS.textMuted, fontWeight: '800', textTransform: 'uppercase' }}>Records</Text>
                    <Text style={{ fontSize: 16, fontWeight: '800', color: COLORS.text, marginTop: 2 }}>{reportEntries.length}</Text>
                  </View>
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ fontSize: 10, color: COLORS.textMuted, fontWeight: '800', textTransform: 'uppercase' }}>Total Falls</Text>
                    <Text style={{ fontSize: 16, fontWeight: '800', color: '#2563EB', marginTop: 2 }}>
                      {reportEntries.reduce((sum, e) => sum + e.quantity, 0).toLocaleString()}
                    </Text>
                  </View>
                </View>
              )}

              {/* Preview List */}
              <FlatList
                data={reportEntries}
                keyExtractor={(item) => item.id}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 32 }}
                renderItem={({ item }) => (
                  <View style={styles.colorItemCard}>
                    <View style={styles.colorCardRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.colorNameLabel}>{formatDateToDDMMYYYY(item.entry_date)} &bull; {item.color?.name || 'Unspecified'}</Text>
                        <Text style={styles.colorUsageLabel}>
                          {item.quantity} Falls logged
                        </Text>
                      </View>
                    </View>
                  </View>
                )}
                ListEmptyComponent={() => (
                  <View style={styles.modalEmptyList}>
                    <BarChart3 size={32} color={COLORS.textMuted} style={{ marginBottom: 8 }} />
                    <Text style={styles.emptyListText}>No logs found in this date range.</Text>
                  </View>
                )}
              />
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text,
  },
  headerSubtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  profileSummaryCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.lavender,
    borderWidth: 2,
    borderColor: 'rgba(92, 62, 163, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.primary,
  },
  profileNameText: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
  },
  profileRoleText: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  formSection: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 14,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  inputContainer: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  inputField: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 44,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    padding: 0,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 4,
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  dbStatusCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 12,
  },
  dbStatusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  dbStatusTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  dbStatusDesc: {
    fontSize: 13,
    color: COLORS.textMuted,
    lineHeight: 18,
  },
  menuItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  menuIconWrapper: {
    width: 38,
    height: 38,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuItemTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
  },
  menuItemDesc: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  modalContainer: {
    backgroundColor: COLORS.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
  },
  closeModalBtn: {
    padding: 4,
  },
  modalLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addColorCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  addColorTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  addColorRow: {
    flexDirection: 'row',
    gap: 8,
  },
  addColorInput: {
    height: 42,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  addColorBtn: {
    width: 42,
    height: 42,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 44,
    marginBottom: 16,
  },
  modalSearchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    padding: 0,
  },
  colorItemCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  colorCardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  colorNameLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },
  colorUsageLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  colorCardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inlineEditRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  inlineEditInput: {
    flex: 1,
    height: 36,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
    paddingHorizontal: 10,
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  inlineEditActions: {
    flexDirection: 'row',
    gap: 6,
  },
  inlineActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalEmptyList: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyListText: {
    fontSize: 14,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  tabSelector: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 3,
    marginBottom: 16,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTabButton: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  tabButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  activeTabButtonText: {
    color: COLORS.primary,
  },
});
