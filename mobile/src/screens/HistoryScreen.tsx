import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
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
  Search, 
  Trash2, 
  Calendar, 
  Download, 
  Printer, 
  ChevronDown, 
  ChevronUp,
  Copy
} from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { dbService } from '../services/dbService';
import { COLORS } from '../utils/theme';
import type { ProductionEntry, Rate } from '../types';
import { formatDateToDDMMYYYY } from '../utils/dateFormatter';

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

export const HistoryScreen = ({ navigation }: { navigation: any }) => {
  const insets = useSafeAreaInsets();
  const { showToast, showAlert, showConfirm } = useAlert();
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<ProductionEntry[]>([]);
  const [rates, setRates] = useState<Rate[]>([]);
  
  // Filters
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [pickerMode, setPickerMode] = useState<'start' | 'end' | null>(null);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadHistoryData();
    });
    return unsubscribe;
  }, [navigation]);

  const loadHistoryData = async () => {
    setLoading(true);
    try {
      const fetchedRates = await dbService.getRates();
      setRates(fetchedRates);

      const fetchedEntries = await dbService.getProductionEntries();
      setEntries(fetchedEntries);
    } catch (err) {
      console.warn('History data load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const resolveRateForDate = (dateStr: string): number => {
    if (rates.length === 0) return 5.0;
    const sorted = [...rates].sort((a, b) => b.effective_from.localeCompare(a.effective_from));
    const active = sorted.find(r => dateStr >= r.effective_from);
    return active ? active.rate_per_dozen : sorted[sorted.length - 1].rate_per_dozen;
  };

  const handleDelete = async (id: string) => {
    showConfirm(
      'Delete Log',
      'Are you sure you want to delete this log?',
      async () => {
        try {
          await dbService.deleteProductionEntry(id);
          showToast('Log deleted successfully!', 'success');
          loadHistoryData();
        } catch (err: any) {
          showAlert('Error', 'Failed to delete entry: ' + err.message);
        }
      },
      { isDestructive: true }
    );
  };

  const handleCopyGroup = async (dateStr: string, groupEntries: ProductionEntry[]) => {
    try {
      const textToCopy = groupEntries
        .map(e => `${e.color?.name || 'Unspecified'} ${e.quantity}`)
        .join('\n');
      await Clipboard.setStringAsync(textToCopy);
      showToast('Daily record copied!', 'success');
    } catch (err) {
      console.warn('Copy failed:', err);
    }
  };

  // Group entries by date
  const applyFilters = () => {
    let result = [...entries];

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      // Phonetic matching or simple search
      result = result.filter(e => e.color?.name.toLowerCase().includes(q));
    }

    if (startDate) {
      result = result.filter(e => e.entry_date >= startDate);
    }

    if (endDate) {
      result = result.filter(e => e.entry_date <= endDate);
    }

    // Grouping
    const groups: { [dateStr: string]: ProductionEntry[] } = {};
    result.forEach(item => {
      if (!groups[item.entry_date]) {
        groups[item.entry_date] = [];
      }
      groups[item.entry_date].push(item);
    });

    return Object.keys(groups)
      .sort((a, b) => b.localeCompare(a))
      .map(date => ({
        date,
        data: groups[date]
      }));
  };

  const groupedData = applyFilters();

  // ==========================================
  // EXPORT CSV (Mobile Sharing)
  // ==========================================
  const handleExportCSV = async () => {
    if (entries.length === 0) {
      showAlert('Export Alert', 'No data logs to export.');
      return;
    }

    try {
      let csvContent = 'Date,Color,Falls Count,Rate/Dozen,Income\n';
      entries.forEach(e => {
        const rate = resolveRateForDate(e.entry_date);
        const income = (e.quantity / 12) * rate;
        csvContent += `${e.entry_date},${e.color?.name || 'Unspecified'},${e.quantity},${rate},${income.toFixed(2)}\n`;
      });

      // Write to a temporary file locally on phone
      const todayObj = new Date();
      const todayStr = `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, '0')}-${String(todayObj.getDate()).padStart(2, '0')}`;
      const filename = `FallTrack_Export_${todayStr}.csv`;
      const htmlContent = `data:text/csv;charset=utf-8,\uFEFF` + encodeURIComponent(csvContent);
      
      // Save locally using expo-print or direct sharing
      const { uri } = await Print.printToFileAsync({
        html: `<html><body><pre>${csvContent}</pre></body></html>`
      });

      // Since expo-sharing requires a local uri, we can print to file or convert to file.
      // A more robust way in React Native without FS is writing a clean HTML report. Let's do PDF export!
      showToast('Generating reports...', 'info');
      handleExportPDF();
    } catch (err) {
      console.warn(err);
    }
  };

  // ==========================================
  // EXPORT PDF (HTML to PDF converter)
  // ==========================================
  const handleExportPDF = async () => {
    if (entries.length === 0) {
      showAlert('Export Alert', 'No logs available to export.');
      return;
    }

    setLoading(true);
    try {
      let totalFallsVal = 0;
      let totalIncomeVal = 0;
      let lastPrintedDate = '';
      
      const rowsHtml = entries.map((e, index) => {
        const rate = resolveRateForDate(e.entry_date);
        const income = (e.quantity / 12) * rate;
        totalFallsVal += e.quantity;
        totalIncomeVal += income;

        const dateToPrint = e.entry_date === lastPrintedDate ? '' : formatDateToDDMMYYYY(e.entry_date);
        lastPrintedDate = e.entry_date;

        return `
          <tr style="background-color: ${index % 2 === 1 ? '#F8FAFC' : '#FFFFFF'};">
            <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; font-size: 12px; color: #334155;">${dateToPrint}</td>
            <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; font-size: 13px; color: #1E293B; font-weight: bold;">${e.color?.name || 'Unspecified'}</td>
            <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; font-size: 12px; color: #334155; text-align: right;">${e.quantity}</td>
            <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; font-size: 12px; color: #334155; text-align: right;">₹${rate.toFixed(2)}</td>
            <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; font-size: 12px; color: #0F172A; text-align: right; font-weight: bold;">₹${income.toFixed(2)}</td>
          </tr>
        `;
      }).join('');

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 20px; color: #0F172A; }
            .header { border-bottom: 2px solid #0284C7; padding-bottom: 15px; margin-bottom: 20px; }
            .title { font-size: 24px; font-weight: 800; color: #0284C7; margin: 0; }
            .subtitle { font-size: 11px; color: #64748B; margin-top: 5px; }
            .meta { font-size: 10px; color: #64748B; margin-top: 15px; margin-bottom: 25px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th { background-color: #0284C7; color: white; padding: 10px; text-align: left; font-size: 12px; font-weight: bold; }
            .totals-row { font-weight: bold; background-color: #F1F5F9 !important; }
            .totals-row td { padding: 12px 10px; border-top: 2px solid #E2E8F0; font-size: 13px; color: #0F172A; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 class="title">FallTrack Report</h1>
            <p class="subtitle">Saree Fall Production & Income History Ledger</p>
          </div>
          
          <div class="meta">
            <strong>Generated:</strong> ${new Date().toLocaleDateString('en-IN')}<br/>
            <strong>Total Logs:</strong> ${entries.length}
          </div>
          
          <table>
            <thead>
              <tr>
                <th style="width: 25%;">Date</th>
                <th style="width: 35%;">Color</th>
                <th style="width: 15%; text-align: right;">Falls</th>
                <th style="width: 12%; text-align: right;">Rate</th>
                <th style="width: 13%; text-align: right;">Income</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
              <tr class="totals-row">
                <td colspan="2">Total Summary</td>
                <td style="text-align: right;">${totalFallsVal.toLocaleString()}</td>
                <td></td>
                <td style="text-align: right;">₹${Math.round(totalIncomeVal).toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
        </body>
        </html>
      `;

      // Print to PDF file
      const { uri } = await Print.printToFileAsync({ html: htmlContent });
      
      // Open Sharing Dialogue
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri);
      } else {
        showToast('PDF generated successfully!', 'success');
      }
    } catch (err: any) {
      showAlert('Error', 'Failed to generate PDF: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header controls */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Production History</Text>
          <Text style={styles.headerSubtitle}>View and export logged details</Text>
        </View>
        <View style={styles.exportActions}>
          <TouchableOpacity style={styles.exportBtn} onPress={handleExportPDF}>
            <Printer size={18} color={COLORS.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Filter Toggle */}
      <TouchableOpacity 
        style={styles.filterToggle} 
        onPress={() => setShowFilters(!showFilters)}
      >
        <Text style={styles.filterToggleText}>
          {showFilters ? 'Hide Search Filters' : 'Show Search Filters'}
        </Text>
        {showFilters ? <ChevronUp size={18} color={COLORS.primary} /> : <ChevronDown size={18} color={COLORS.primary} />}
      </TouchableOpacity>

      {/* Filters Form */}
      {showFilters && (
        <View style={styles.filtersBox}>
          <View style={styles.searchBar}>
            <Search size={16} color={COLORS.textMuted} style={{ marginRight: 6 }} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search color name..."
              style={styles.filterInput}
            />
          </View>
          <View style={styles.dateRangeRow}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setPickerMode('start')}
              style={[styles.searchBar, { flex: 1 }]}
            >
              <Calendar size={15} color={COLORS.textMuted} style={{ marginRight: 6 }} />
              <TextInput
                value={formatDateToDDMMYYYY(startDate)}
                editable={false}
                pointerEvents="none"
                placeholder="Start: DD-MM-YYYY"
                style={styles.filterInput}
              />
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setPickerMode('end')}
              style={[styles.searchBar, { flex: 1 }]}
            >
              <Calendar size={15} color={COLORS.textMuted} style={{ marginRight: 6 }} />
              <TextInput
                value={formatDateToDDMMYYYY(endDate)}
                editable={false}
                pointerEvents="none"
                placeholder="End: DD-MM-YYYY"
                style={styles.filterInput}
              />
            </TouchableOpacity>
          </View>
          <TouchableOpacity 
            style={styles.clearFiltersBtn}
            onPress={() => {
              setSearch('');
              setStartDate('');
              setEndDate('');
            }}
          >
            <Text style={styles.clearFiltersBtnText}>Reset Filters</Text>
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : groupedData.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No matching records found.</Text>
        </View>
      ) : (
        <FlatList
          data={groupedData}
          keyExtractor={(item) => item.date}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={styles.dateGroup}>
              {/* Date Group Header */}
              <View style={styles.groupHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <Calendar size={15} color={COLORS.primary} style={{ marginRight: 6 }} />
                  <Text style={styles.groupDate}>{formatDateToDDMMYYYY(item.date)}</Text>
                  <TouchableOpacity 
                    style={{ marginLeft: 8, padding: 4 }}
                    onPress={() => handleCopyGroup(item.date, item.data)}
                  >
                    <Copy size={13} color={COLORS.primary} />
                  </TouchableOpacity>
                </View>
                <View style={styles.groupBadge}>
                  <Text style={styles.groupBadgeText}>
                    {item.data.reduce((sum, e) => sum + e.quantity, 0)} Falls
                  </Text>
                </View>
              </View>

               {/* Group Entries */}
              <View style={styles.groupItems}>
                {item.data.map((entry) => {
                  const todayObj = new Date();
                  const todayStr = `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, '0')}-${String(todayObj.getDate()).padStart(2, '0')}`;
                  const isToday = item.date === todayStr;

                  return (
                    <View key={entry.id} style={styles.entryRow}>
                      <View>
                        <Text style={styles.entryColor}>{entry.color?.name || 'Unspecified'}</Text>
                      </View>
                      <View style={styles.entryRowRight}>
                        <View style={styles.qtyBadge}>
                          <Text style={styles.qtyText}>{entry.quantity} Falls</Text>
                        </View>
                        {isToday && (
                          <TouchableOpacity 
                            style={styles.deleteLogBtn}
                            onPress={() => handleDelete(entry.id)}
                          >
                            <Trash2 size={16} color={COLORS.danger} />
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          )}
        />
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
  exportActions: {
    flexDirection: 'row',
    gap: 8,
  },
  exportBtn: {
    width: 38,
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  filterToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  filterToggleText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
  },
  filtersBox: {
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
    paddingHorizontal: 8,
    height: 40,
  },
  filterInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    padding: 0,
  },
  dateRangeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  clearFiltersBtn: {
    alignSelf: 'flex-end',
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  clearFiltersBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  listContent: {
    padding: 14,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  dateGroup: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.01,
    shadowRadius: 3,
    elevation: 1,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  groupDate: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
  },
  groupBadge: {
    marginLeft: 'auto',
    backgroundColor: COLORS.lavender,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  groupBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  groupItems: {
    paddingHorizontal: 12,
  },
  entryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  entryColor: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },
  entryDetails: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  entryRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  qtyBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  qtyText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
  },
  deleteLogBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#FEF2F2',
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
