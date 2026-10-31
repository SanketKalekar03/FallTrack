import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  TextInput, 
  ActivityIndicator, 
  Platform,
  Modal
} from 'react-native';
import { useAlert } from '../components/AlertProvider';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { 
  Coins, 
  Calendar, 
  Lock, 
  TrendingUp, 
  Sparkles, 
  Trash2, 
  AlertCircle,
  CheckCircle2,
  Printer
} from 'lucide-react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { dbService } from '../services/dbService';
import { COLORS } from '../utils/theme';
import type { IncomePeriod, ProductionEntry, Rate } from '../types';
import { formatDateToDDMMYYYY } from '../utils/dateFormatter';

const addOneDay = (dateStr: string): string => {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const parseDateString = (dateStr: string): Date => {
  if (!dateStr) return new Date();
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    return new Date(year, month, day);
  }
  return new Date();
};

export const IncomeTrackerScreen = ({ navigation }: { navigation: any }) => {
  const insets = useSafeAreaInsets();
  const { showToast, showAlert, showConfirm } = useAlert();
  
  const [loading, setLoading] = useState(true);
  const [periods, setPeriods] = useState<IncomePeriod[]>([]);
  const [entries, setEntries] = useState<ProductionEntry[]>([]);
  const [rates, setRates] = useState<Rate[]>([]);

  // Form states
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [periodName, setPeriodName] = useState('');
  const [isStartDateLocked, setIsStartDateLocked] = useState(false);
  const [pickerMode, setPickerMode] = useState<'start' | 'end' | null>(null);

  useEffect(() => {
    // 1. Initial direct load immediately on screen mount
    loadTrackerData(true).then(() => {
      loadTrackerData(false);
    });

    // 2. Also reload whenever returning to this tab
    const unsubscribe = navigation.addListener('focus', () => {
      loadTrackerData(true).then(() => {
        loadTrackerData(false);
      });
    });
    return unsubscribe;
  }, [navigation]);

  const loadTrackerData = async (forceLocal = false) => {
    if (forceLocal) {
      setLoading(true);
    }
    try {
      const fetchedRates = await dbService.getRates(forceLocal);
      setRates(fetchedRates);

      const fetchedPeriods = await dbService.getIncomePeriods(forceLocal);
      const sortedPeriods = fetchedPeriods.sort(
        (a, b) => b.end_date.localeCompare(a.end_date)
      );
      setPeriods(sortedPeriods);

      const allEntries = await dbService.getProductionEntries(undefined, forceLocal);
      setEntries(allEntries);

      // Determine next start date
      if (sortedPeriods.length > 0) {
        const latestPeriod = sortedPeriods[0];
        const nextStart = addOneDay(latestPeriod.end_date);
        setStartDate(nextStart);
        setIsStartDateLocked(true);
        
        const todayObj = new Date();
        const today = `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, '0')}-${String(todayObj.getDate()).padStart(2, '0')}`;
        setEndDate(nextStart > today ? nextStart : today);
      } else {
        setIsStartDateLocked(false);
        if (allEntries.length > 0) {
          const sortedEntries = [...allEntries].sort(
            (a, b) => a.entry_date.localeCompare(b.entry_date)
          );
          setStartDate(sortedEntries[0].entry_date);
          const todayObj = new Date();
          setEndDate(`${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, '0')}-${String(todayObj.getDate()).padStart(2, '0')}`);
        } else {
          const todayObj = new Date();
          const today = `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, '0')}-${String(todayObj.getDate()).padStart(2, '0')}`;
          setStartDate(today);
          setEndDate(today);
        }
      }
    } catch (err) {
      console.warn('Tracker data load error:', err);
    } finally {
      if (forceLocal) {
        setLoading(false);
      }
    }
  };

  // Auto-generate name based on start date
  useEffect(() => {
    if (startDate) {
      const parts = startDate.split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const monthIdx = parseInt(parts[1], 10) - 1;
        const monthNames = [
          'January', 'February', 'March', 'April', 'May', 'June',
          'July', 'August', 'September', 'October', 'November', 'December'
        ];
        if (monthIdx >= 0 && monthIdx < 12) {
          const monthName = monthNames[monthIdx];
          setPeriodName(`${monthName} ${year}`);
        }
      }
    }
  }, [startDate]);

  // Live Calculations
  const filteredEntries = entries.filter(
    (e) => e.entry_date >= startDate && e.entry_date <= endDate
  );

  const totalFalls = filteredEntries.reduce((sum, e) => sum + e.quantity, 0);

  const resolveRateForDate = (dateStr: string): number => {
    if (rates.length === 0) return 5.0;
    const sorted = [...rates].sort((a, b) => b.effective_from.localeCompare(a.effective_from));
    const active = sorted.find(r => dateStr >= r.effective_from);
    return active ? active.rate_per_dozen : sorted[sorted.length - 1].rate_per_dozen;
  };

  const totalIncome = filteredEntries.reduce((sum, e) => {
    const rate = resolveRateForDate(e.entry_date);
    return sum + (e.quantity / 12) * rate;
  }, 0);

  const handleFinalize = async () => {
    const name = periodName.trim();
    if (!name) {
      showAlert('Validation Error', 'Please enter a name for this period.');
      return;
    }
    if (!startDate || !endDate) {
      showAlert('Validation Error', 'Please select a date range.');
      return;
    }
    if (endDate < startDate) {
      showAlert('Validation Error', 'End date cannot be earlier than start date.');
      return;
    }

    // Overlap checks
    const isOverlap = periods.some(
      (p) =>
        (startDate >= p.start_date && startDate <= p.end_date) ||
        (endDate >= p.start_date && endDate <= p.end_date) ||
        (startDate <= p.start_date && endDate >= p.end_date)
    );

    if (isOverlap) {
      showAlert('Overlap Error', 'Date range overlaps with a previously finalized period.');
      return;
    }

    if (filteredEntries.length === 0) {
      showConfirm(
        'Empty Period',
        'There are no production entries in this range. Do you still want to lock this cycle?',
        savePeriod,
        {
          confirmText: 'Finalize',
          cancelText: 'Cancel'
        }
      );
    } else {
      savePeriod();
    }
  };

  const savePeriod = async () => {
    setLoading(true);
    try {
      await dbService.createIncomePeriod({
        period_name: periodName.trim(),
        start_date: startDate,
        end_date: endDate,
        total_falls: totalFalls,
        total_income: Number(totalIncome.toFixed(2))
      });
      showToast('Income cycle finalized and locked!', 'success');
      loadTrackerData();
    } catch (err: any) {
      showAlert('Error', 'Failed to lock period: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    showConfirm(
      'Rollback Period',
      'Are you sure you want to delete this period? This will make these dates editable again.',
      async () => {
        setLoading(true);
        try {
          await dbService.deleteIncomePeriod(id);
          showToast('Period rolled back successfully!', 'success');
          loadTrackerData();
        } catch (err: any) {
          showAlert('Error', 'Failed to delete period: ' + err.message);
        } finally {
          setLoading(false);
        }
      },
      {
        confirmText: 'Rollback',
        cancelText: 'Cancel',
        isDestructive: true
      }
    );
  };

  const handlePrintPeriod = async (period: IncomePeriod) => {
    setLoading(true);
    try {
      // Filter entries that fall inside the period dates (inclusive)
      const periodEntries = entries
        .filter(e => e.entry_date >= period.start_date && e.entry_date <= period.end_date)
        .sort((a, b) => b.entry_date.localeCompare(a.entry_date)); // Sort descending by date

      if (periodEntries.length === 0) {
        showAlert('Export Alert', 'No records found for this period.');
        return;
      }

      let profile = { app_name: 'FallTrack', manager_name: '', manager_phone: '' };
      try {
        profile = await dbService.getProfile();
      } catch (e) {
        console.warn('Failed to load profile for PDF report', e);
      }

      const formatDateToSlash = (dateStr: string): string => {
        if (!dateStr) return '';
        const parts = dateStr.split('-');
        if (parts.length === 3 && parts[0].length === 4) {
          return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
        return dateStr.replace(/-/g, '/');
      };

      const dateRange = `${formatDateToSlash(period.start_date)} to ${formatDateToSlash(period.end_date)}`;

      const getActiveRateForDate = (dateStr: string): number => {
        const sortedRates = [...rates].sort((a, b) => b.effective_from.localeCompare(a.effective_from));
        const matched = sortedRates.find(r => dateStr >= r.effective_from);
        return matched ? matched.rate_per_dozen : 5.0;
      };

      const uniqueRates = Array.from(new Set(periodEntries.map(e => getActiveRateForDate(e.entry_date))));
      const rateText = uniqueRates.length === 1 
        ? `${uniqueRates[0].toFixed(2)}` 
        : uniqueRates.length > 1
          ? `${Math.min(...uniqueRates).toFixed(2)} - ${Math.max(...uniqueRates).toFixed(2)}`
          : '5.00';

      let totalFallsVal = 0;
      let totalIncomeVal = 0;
      let lastPrintedDate = '';

      const rows = periodEntries.map((e, index) => {
        const rate = getActiveRateForDate(e.entry_date);
        const income = (e.quantity / 12) * rate;
        totalFallsVal += e.quantity;
        totalIncomeVal += income;

        const dateToPrint = e.entry_date === lastPrintedDate ? '' : formatDateToDDMMYYYY(e.entry_date);
        lastPrintedDate = e.entry_date;

        return `
          <tr style="background-color: ${index % 2 === 1 ? '#F8FAFC' : '#FFFFFF'};">
            <td style="padding: 10px 8px; border-bottom: 1px solid #F1F5F9; font-size: 12px; color: #475569;">${dateToPrint}</td>
            <td style="padding: 10px 8px; border-bottom: 1px solid #F1F5F9; font-size: 12px; font-weight: 600; color: #334155;">${e.color?.name || 'Unspecified'}</td>
            <td style="padding: 10px 8px; border-bottom: 1px solid #F1F5F9; font-size: 12px; text-align: right; color: #334155; font-weight: bold; padding-right: 12px;">${e.quantity.toLocaleString()}</td>
          </tr>
        `;
      }).join('');

      const now = new Date();
      const generatedTime = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()} ${now.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase()}`;

      const managerMeta = profile.manager_name || profile.manager_phone 
        ? `Name: ${profile.manager_name} | Phone: ${profile.manager_phone}`
        : '';

      const htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <title>${period.period_name} Production Report</title>
            <style>
              @page {
                margin: 0;
              }
              body {
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                margin: 0;
                padding: 0;
                color: #334155;
                background-color: #FFFFFF;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              .header-container {
                background-color: #0F172A;
                padding: 24px 30px;
                border-bottom: 4px solid #EA580C;
                color: #FFFFFF;
              }
              .header-flex {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
              }
              .header-left h1 {
                font-size: 24px;
                font-weight: 800;
                margin: 0;
                letter-spacing: 0.5px;
              }
              .header-left p {
                font-size: 8px;
                color: #BAE6FD;
                margin: 4px 0 0 0;
                font-weight: 600;
                letter-spacing: 0.5px;
              }
              .header-right {
                text-align: right;
              }
              .header-right h2 {
                font-size: 12px;
                font-weight: 800;
                margin: 0;
                letter-spacing: 0.5px;
              }
              .header-right p {
                font-size: 10px;
                color: #E0F2FE;
                margin: 4px 0 0 0;
              }
              .content {
                padding: 30px;
                padding-bottom: 60px;
              }
              .report-metadata {
                margin-bottom: 24px;
                border-bottom: 1px solid #E2E8F0;
                padding-bottom: 12px;
              }
              .report-metadata-title {
                font-size: 11px;
                font-weight: 800;
                color: #1E293B;
                margin: 0 0 8px 0;
                letter-spacing: 0.5px;
              }
              .metadata-flex {
                display: flex;
                justify-content: space-between;
                font-size: 11px;
                color: #64748B;
                font-weight: 500;
              }
              .metadata-col {
                line-height: 1.6;
              }
              table {
                width: 100%;
                border-collapse: collapse;
                margin-top: 10px;
              }
              th {
                background-color: #0F172A;
                color: #FFFFFF;
                padding: 10px 8px;
                font-size: 11px;
                font-weight: 700;
                text-align: left;
              }
              th.text-right {
                text-align: right;
                padding-right: 12px;
              }
              .totals-row td {
                border-top: 2px solid #CBD5E1;
                padding: 16px 8px;
                font-size: 12px;
                font-weight: 800;
                color: #0F172A;
              }
              .footer {
                position: fixed;
                bottom: 20px;
                left: 30px;
                right: 30px;
                display: flex;
                justify-content: space-between;
                font-size: 9px;
                color: #94A3B8;
                border-top: 1px solid #F1F5F9;
                padding-top: 8px;
              }
            </style>
          </head>
          <body>
            <div class="header-container">
              <div class="header-flex">
                <div class="header-left">
                  <h1>${(profile.app_name || 'FALLTRACK').toUpperCase()}</h1>
                  <p>THE ULTIMATE SAREE FALL LEDGER PLATFORM</p>
                </div>
                <div class="header-right">
                  <h2>PRODUCTION REPORT</h2>
                  ${managerMeta ? `<p>${managerMeta}</p>` : ''}
                  <p style="font-size: 9px; opacity: 0.85; margin: 4px 0 0 0;">Generated: ${generatedTime}</p>
                </div>
              </div>
            </div>

            <div class="content">
              <div class="report-metadata">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; position: relative;">
                  <h3 class="report-metadata-title" style="margin: 0;">REPORT METADATA</h3>
                  <div style="position: absolute; left: 50%; transform: translateX(-50%); font-size: 11px; font-weight: 800; color: #1E293B; letter-spacing: 0.5px;">${period.period_name}</div>
                  <div style="width: 100px;"></div>
                </div>
                <div class="metadata-flex">
                  <div class="metadata-col">
                    <div>${dateRange}</div>
                    <div>Rate Card: Rs. ${rateText} per Dozen</div>
                  </div>
                  <div class="metadata-col" style="text-align: right;">
                    <div>Total Log Records: ${periodEntries.length}</div>
                    <div>Export Source: Mobile App</div>
                  </div>
                </div>
              </div>

              <table>
                <thead>
                  <tr>
                    <th style="border-top-left-radius: 4px; border-bottom-left-radius: 4px;">Date</th>
                    <th>Color</th>
                    <th class="text-right" style="border-top-right-radius: 4px; border-bottom-right-radius: 4px;">Falls Count</th>
                  </tr>
                </thead>
                <tbody>
                  ${rows}
                  <tr class="totals-row">
                    <td>Total Summary:</td>
                    <td style="font-weight: 800; color: #0F172A;">${totalFallsVal.toLocaleString()} Falls</td>
                    <td style="text-align: right; padding-right: 12px; font-weight: 800; color: #0F172A;">Total Income: Rs. ${totalIncomeVal.toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="footer">
              <div>&copy; ${now.getFullYear()} ${(profile.app_name || 'FallTrack')} Technologies. All rights reserved.</div>
              <div>Page 1 of 1</div>
            </div>
          </body>
        </html>
      `;

      // Clean period name to make it a safe filename (e.g. "August 2026")
      const cleanFileName = period.period_name.replace(/[^a-zA-Z0-9\s-]/g, '').trim();

      // Print to PDF
      const { uri } = await Print.printToFileAsync({ html: htmlContent });
      const newUri = `${FileSystem.cacheDirectory}${cleanFileName}.pdf`;

      // Clean up previous file if exists to prevent copy errors
      await FileSystem.deleteAsync(newUri, { idempotent: true });
      await FileSystem.copyAsync({
        from: uri,
        to: newUri
      });

      // Share PDF document
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(newUri, {
          dialogTitle: `${cleanFileName} Report`,
          mimeType: 'application/pdf'
        });
      } else {
        showToast('PDF report generated!', 'success');
      }
    } catch (err: any) {
      showAlert('Error', 'Failed to generate PDF: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Income Tracker</Text>
          <Text style={styles.headerSubtitle}>Manage custom payment/billing cycles</Text>
        </View>
        <Coins size={22} color={COLORS.primary} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          
          {/* Ranges Finalize Card */}
          <View style={styles.formCard}>
            <View style={styles.cardHeader}>
              <Sparkles size={18} color={COLORS.primary} style={{ marginRight: 6 }} />
              <Text style={styles.cardTitle}>Finalize Billing Cycle</Text>
            </View>

            <View style={styles.dateInputsRow}>
              {/* Start Date */}
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>
                  Start Date {isStartDateLocked && <Lock size={11} color={COLORS.textMuted} />}
                </Text>
                <TouchableOpacity
                  activeOpacity={isStartDateLocked ? 1 : 0.7}
                  onPress={() => {
                    if (!isStartDateLocked) {
                      setPickerMode('start');
                    }
                  }}
                  style={[styles.inputWrapper, isStartDateLocked && styles.disabledInput]}
                >
                  <Calendar size={15} color={COLORS.textMuted} style={{ marginRight: 6 }} />
                  <TextInput
                    value={formatDateToDDMMYYYY(startDate)}
                    editable={false}
                    pointerEvents="none"
                    style={styles.textInput}
                  />
                </TouchableOpacity>
              </View>

              {/* End Date */}
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>End Date</Text>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => setPickerMode('end')}
                  style={styles.inputWrapper}
                >
                  <Calendar size={15} color={COLORS.textMuted} style={{ marginRight: 6 }} />
                  <TextInput
                    value={formatDateToDDMMYYYY(endDate)}
                    editable={false}
                    pointerEvents="none"
                    style={styles.textInput}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Cycle Name */}
            <View style={{ marginTop: 10 }}>
              <Text style={styles.inputLabel}>Period Name</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  value={periodName}
                  onChangeText={setPeriodName}
                  placeholder="e.g. February 2026"
                  style={[styles.textInput, { paddingLeft: 4 }]}
                />
              </View>
            </View>

            {/* Live calculations preview box */}
            <View style={styles.previewBox}>
              <Text style={styles.previewTitle}>Live Cycle Preview</Text>
              
              <View style={styles.previewGrid}>
                <View style={styles.previewStat}>
                  <Text style={styles.previewStatLabel}>Production Volume</Text>
                  <Text style={styles.previewStatVal}>{totalFalls.toLocaleString()} Falls</Text>
                </View>
                <View style={[styles.previewStat, { backgroundColor: COLORS.primary }]}>
                  <Text style={[styles.previewStatLabel, { color: 'rgba(255,255,255,0.8)' }]}>Billed Income</Text>
                  <Text style={[styles.previewStatVal, { color: '#FFFFFF' }]}>₹{Math.round(totalIncome).toLocaleString()}</Text>
                </View>
              </View>

              {/* Logs included inside preview */}
              <Text style={styles.previewLogLabel}>Includes {filteredEntries.length} production entries:</Text>
              {filteredEntries.length === 0 ? (
                <Text style={styles.noLogsText}>No production logs found in this date range.</Text>
              ) : (
                <View style={styles.logPreviewList}>
                  {filteredEntries.slice(0, 3).map((e, idx) => (
                    <Text key={e.id || idx} style={styles.logPreviewItem}>
                      • {formatDateToDDMMYYYY(e.entry_date)} - {e.color?.name || 'Unspecified'} ({e.quantity} Falls)
                    </Text>
                  ))}
                  {filteredEntries.length > 3 && (
                    <Text style={styles.moreLogsText}>+ {filteredEntries.length - 3} more logs...</Text>
                  )}
                </View>
              )}
            </View>

            <TouchableOpacity style={styles.finalizeBtn} onPress={handleFinalize}>
              <CheckCircle2 size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.finalizeBtnText}>Finalize & Lock Period</Text>
            </TouchableOpacity>
          </View>

          {/* Ledger History List */}
          <Text style={[styles.sectionTitle, { marginTop: 18 }]}>Finalized Ledger ({periods.length})</Text>

          {periods.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No custom periods finalized yet.</Text>
            </View>
          ) : (
            <View style={styles.periodsList}>
              {periods.map((p, idx) => {
                const isLatest = idx === 0;

                return (
                  <View key={p.id} style={styles.periodCard}>
                    <View style={styles.periodHeader}>
                      <View>
                        <Text style={styles.periodName}>{p.period_name}</Text>
                        <Text style={styles.periodDates}>
                          {formatDateToDDMMYYYY(p.start_date)} to {formatDateToDDMMYYYY(p.end_date)}
                        </Text>
                      </View>
                      
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <TouchableOpacity 
                          style={styles.printCardBtn}
                          onPress={() => handlePrintPeriod(p)}
                        >
                          <Printer size={15} color={COLORS.primary} />
                        </TouchableOpacity>

                        {isLatest ? (
                          <TouchableOpacity 
                            style={styles.rollbackBtn}
                            onPress={() => handleDelete(p.id)}
                          >
                            <Trash2 size={16} color={COLORS.danger} />
                          </TouchableOpacity>
                        ) : (
                          <Lock size={15} color="#CBD5E1" />
                        )}
                      </View>
                    </View>

                    <View style={styles.periodStats}>
                      <View>
                        <Text style={styles.pStatLabel}>Production</Text>
                        <Text style={styles.pStatVal}>{p.total_falls.toLocaleString()} Falls</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.pStatLabel}>Payout Amount</Text>
                        <Text style={[styles.pStatVal, { color: COLORS.primary }]}>₹{Math.round(p.total_income).toLocaleString()}</Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* Info Banner */}
          <View style={styles.infoBanner}>
            <AlertCircle size={18} color={COLORS.warning} style={{ marginRight: 8, marginTop: 1 }} />
            <Text style={styles.infoBannerText}>
              Subsequent billing periods are sequentially locked. You can only rollback (delete) the latest finalized period.
            </Text>
          </View>
        </ScrollView>
      )}

      {/* Date Picker Modal / Native Trigger */}
      {pickerMode && (
        Platform.OS === 'ios' ? (
          <Modal
            transparent={true}
            animationType="slide"
            visible={!!pickerMode}
            onRequestClose={() => setPickerMode(null)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.iosPickerContainer}>
                <View style={styles.iosPickerHeader}>
                  <TouchableOpacity onPress={() => setPickerMode(null)}>
                    <Text style={styles.iosPickerCloseText}>Done</Text>
                  </TouchableOpacity>
                </View>
                <DateTimePicker
                  value={parseDateString(pickerMode === 'start' ? startDate : endDate)}
                  mode="date"
                  display="spinner"
                  textColor={COLORS.text}
                  onChange={(event, selectedDate) => {
                    if (selectedDate) {
                      const yyyy = selectedDate.getFullYear();
                      const mm = String(selectedDate.getMonth() + 1).padStart(2, '0');
                      const dd = String(selectedDate.getDate()).padStart(2, '0');
                      const dateStr = `${yyyy}-${mm}-${dd}`;
                      if (pickerMode === 'start') {
                        setStartDate(dateStr);
                      } else {
                        setEndDate(dateStr);
                      }
                    }
                  }}
                />
              </View>
            </View>
          </Modal>
        ) : (
          <DateTimePicker
            value={parseDateString(pickerMode === 'start' ? startDate : endDate)}
            mode="date"
            display="default"
            onChange={(event, selectedDate) => {
              setPickerMode(null);
              if (event.type === 'set' && selectedDate) {
                const yyyy = selectedDate.getFullYear();
                const mm = String(selectedDate.getMonth() + 1).padStart(2, '0');
                const dd = String(selectedDate.getDate()).padStart(2, '0');
                const dateStr = `${yyyy}-${mm}-${dd}`;
                if (pickerMode === 'start') {
                  setStartDate(dateStr);
                } else {
                  setEndDate(dateStr);
                }
              }
            }}
          />
        )
      )}
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
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text,
  },
  dateInputsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 8,
    height: 42,
  },
  disabledInput: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    padding: 0,
  },
  previewBox: {
    backgroundColor: COLORS.lavender,
    borderRadius: 10,
    padding: 10,
    marginTop: 14,
    borderWidth: 1,
    borderColor: 'rgba(92, 62, 163, 0.05)',
  },
  previewTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.primary,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  previewGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  previewStat: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(92, 62, 163, 0.05)',
  },
  previewStatLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
  },
  previewStatVal: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
    marginTop: 2,
  },
  previewLogLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  noLogsText: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontStyle: 'italic',
  },
  logPreviewList: {
    gap: 2,
  },
  logPreviewItem: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
  },
  moreLogsText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
    marginTop: 2,
  },
  finalizeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 14,
  },
  finalizeBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  emptyContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  periodsList: {
    gap: 8,
  },
  periodCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 12,
  },
  periodHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  periodName: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text,
  },
  periodDates: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
    marginTop: 2,
  },
  rollbackBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#FEF2F2',
  },
  printCardBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#F0F9FF',
  },
  periodStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
    marginTop: 8,
  },
  pStatLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
  },
  pStatVal: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
    marginTop: 2,
  },
  infoBanner: {
    flexDirection: 'row',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FEF3C7',
    borderRadius: 10,
    padding: 10,
    marginTop: 16,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#D97706',
    lineHeight: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  iosPickerContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    paddingBottom: 32,
  },
  iosPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 10,
  },
  iosPickerCloseText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primary,
  },
});
