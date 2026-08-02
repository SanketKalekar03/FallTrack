import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  TextInput, 
  Modal, 
  FlatList, 
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView
} from 'react-native';
import { useAlert } from '../components/AlertProvider';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { 
  Plus, 
  Trash2, 
  Save, 
  Search, 
  RotateCcw,
  Sparkles,
  Calendar,
  X,
  ChevronDown
} from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { dbService } from '../services/dbService';
import { matchColor, isExactColorMatch } from '../utils/transliterate';
import { COLORS } from '../utils/theme';
import type { Color } from '../types';
import { formatDateToDDMMYYYY } from '../utils/dateFormatter';

interface EntryRow {
  key: string;
  colorId: string;
  colorName: string;
  quantityStr: string;
}

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

export const DailyEntryScreen = ({ navigation }: { navigation: any }) => {
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef<ScrollView>(null);
  const { showToast, showAlert, showConfirm } = useAlert();
  const [loading, setLoading] = useState(false);
  const [colors, setColors] = useState<Color[]>([]);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [entryDate, setEntryDate] = useState(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });

  const [rows, setRows] = useState<EntryRow[]>([
    { key: 'row-0', colorId: '', colorName: '', quantityStr: '0' }
  ]);

  // Search Modal states
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [activeRowKey, setActiveRowKey] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredColors, setFilteredColors] = useState<Color[]>([]);
  const [recentColors, setRecentColors] = useState<Color[]>([]);

  useEffect(() => {
    // 1. Load local cache instantly to show data immediately
    loadColors(true).then(() => {
      // 2. Perform online sync update in the background silently
      loadColors(false);
    });
    loadDraft();
  }, []);

  useEffect(() => {
    saveDraft();
  }, [rows, entryDate]);

  const loadColors = async (forceLocal = false) => {
    try {
      const fetchedColors = await dbService.getColors(forceLocal);
      setColors(fetchedColors);
      setFilteredColors(fetchedColors);

      // Load recently used colors from production logs
      const recentEntries = await dbService.getProductionEntries(undefined, forceLocal);
      const uniqueRecents: Color[] = [];
      const seenIds = new Set<string>();

      for (const entry of recentEntries) {
        if (entry.color && !seenIds.has(entry.color.id)) {
          seenIds.add(entry.color.id);
          uniqueRecents.push(entry.color);
          if (uniqueRecents.length >= 10) break; // Limit to top 10 most recent colors
        }
      }

      // Fallback: If no recent entries, show the first 10 default colors
      if (uniqueRecents.length === 0) {
        setRecentColors(fetchedColors.slice(0, 10));
      } else {
        setRecentColors(uniqueRecents);
      }
    } catch (err) {
      console.warn('Load colors and recents error:', err);
    }
  };

  const loadDraft = async () => {
    try {
      const draftObj = await dbService.getDraft();
      if (draftObj.rows) setRows(draftObj.rows);
      
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      const todayStr = `${yyyy}-${mm}-${dd}`;

      if (draftObj.date && draftObj.date === todayStr) {
        setEntryDate(draftObj.date);
      }
    } catch (err) {
      // Ignored
    }
  };

  const saveDraft = async () => {
    try {
      await dbService.saveDraft(rows, entryDate);
    } catch (err) {
      // Ignored
    }
  };

  const handleAddRow = () => {
    const newKey = `row-${Date.now()}`;
    setRows(prev => [
      ...prev,
      { key: newKey, colorId: '', colorName: '', quantityStr: '0' }
    ]);
    // Auto-scroll to the bottom after adding a row
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 150);
  };

  const handleRemoveRow = (key: string) => {
    if (rows.length === 1) {
      setRows([{ key: 'row-0', colorId: '', colorName: '', quantityStr: '0' }]);
      return;
    }
    setRows(prev => prev.filter(r => r.key !== key));
  };

  const handleQuantityChange = (key: string, val: string) => {
    // Keep only numeric characters
    const cleanVal = val.replace(/[^0-9]/g, '');
    setRows(prev => prev.map(r => {
      if (r.key === key) {
        return { ...r, quantityStr: cleanVal };
      }
      return r;
    }));
  };

  // Trigger search modal opening for a row
  const openColorPicker = (rowKey: string) => {
    setActiveRowKey(rowKey);
    setSearchQuery('');
    setFilteredColors(colors);
    setIsModalVisible(true);
  };

  // Handle Search Input Change
  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setFilteredColors(colors);
      return;
    }
    const filtered = colors.filter(c => matchColor(c.name, query));
    setFilteredColors(filtered);
  };

  // Select Color
  const selectColor = (color: Color) => {
    if (activeRowKey) {
      setRows(prev => prev.map(r => {
        if (r.key === activeRowKey) {
          return { ...r, colorId: color.id, colorName: color.name };
        }
        return r;
      }));
    }
    setIsModalVisible(false);
    setActiveRowKey(null);
  };

  // Create Inline Color
  const handleCreateColor = async () => {
    const query = searchQuery.trim();
    if (!query) return;

    // Check if color matches exactly
    const match = colors.find(c => isExactColorMatch(c.name, query));
    if (match) {
      selectColor(match);
      return;
    }

    setLoading(true);
    try {
      const newColor = await dbService.createColor(query);
      
      // Reload local color catalog and recents list
      await loadColors();

      // Select newly created color
      selectColor(newColor);
      toastMessage('Color created successfully!');
    } catch (err: any) {
      showAlert('Error', err.message || 'Failed to create color');
    } finally {
      setLoading(false);
    }
  };

  const handleResetDraft = () => {
    showConfirm(
      'Clear Draft',
      'Are you sure you want to delete current draft?',
      async () => {
        setRows([{ key: 'row-0', colorId: '', colorName: '', quantityStr: '0' }]);
        await dbService.clearDraft();
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        setEntryDate(`${yyyy}-${mm}-${dd}`);
        toastMessage('Draft cleared!');
      },
      { isDestructive: true }
    );
  };

  const handleSave = async () => {
    // Validation
    const formatted: any[] = [];
    let hasEmptyColor = false;
    let hasInvalidQty = false;

    rows.forEach(r => {
      const qty = parseInt(r.quantityStr, 10);
      if (!r.colorId) {
        hasEmptyColor = true;
      }
      if (isNaN(qty) || qty <= 0) {
        hasInvalidQty = true;
      } else {
        formatted.push({
          entry_date: entryDate,
          color_id: r.colorId,
          quantity: qty
        });
      }
    });

    if (hasEmptyColor) {
      showAlert('Validation Error', 'Please select a color for all rows.');
      return;
    }
    if (hasInvalidQty) {
      showAlert('Validation Error', 'Please enter a valid quantity of falls for all rows.');
      return;
    }

    setLoading(true);
    try {
      await dbService.saveProductionEntries(formatted);
      toastMessage('Production logged successfully!');
      
      // Reset form
      setRows([{ key: 'row-0', colorId: '', colorName: '', quantityStr: '0' }]);
      await dbService.clearDraft();
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      setEntryDate(`${yyyy}-${mm}-${dd}`);
      
      navigation.navigate('Dashboard');
    } catch (err: any) {
      showAlert('Error', 'Failed to save production: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const toastMessage = (msg: string) => {
    showToast(msg, 'success');
  };

  // Check if search query matches exactly to hide Create option
  const exactMatchExists = searchQuery.trim() 
    ? colors.some(c => isExactColorMatch(c.name, searchQuery)) 
    : true;

  // Live Stats calculations
  const totalFalls = rows.reduce((sum, r) => {
    const qty = parseInt(r.quantityStr, 10);
    return sum + (isNaN(qty) || qty < 0 ? 0 : qty);
  }, 0);

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Date selector header */}
      <View style={styles.dateHeader}>
        <View style={styles.dateHeaderLeft}>
          <Sparkles size={20} color={COLORS.primary} />
          <Text style={styles.dateHeaderTitle}>Log Production</Text>
        </View>
        <View 
          style={[styles.datePickerWrapper, { backgroundColor: '#F1F5F9', borderColor: '#E2E8F0' }]}
        >
          <Calendar size={16} color="#94A3B8" style={{ marginRight: 4 }} />
          <TextInput
            value={formatDateToDDMMYYYY(entryDate)}
            editable={false}
            pointerEvents="none"
            placeholder="DD-MM-YYYY"
            style={[styles.dateInput, { color: '#64748B' }]}
          />
        </View>
      </View>

      {/* Entry Rows List */}
      <ScrollView 
        ref={scrollViewRef}
        contentContainerStyle={styles.scrollContent} 
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.sectionTitle}>Entry Rows ({rows.length})</Text>
        
        {rows.map((row, index) => (
          <View key={row.key} style={styles.rowCard}>
            <View style={styles.rowIndex}>
              <Text style={styles.rowIndexText}>{String(index + 1).padStart(2, '0')}</Text>
            </View>

            {/* Color select input */}
            <TouchableOpacity 
              style={styles.colorSelector}
              onPress={() => openColorPicker(row.key)}
              activeOpacity={0.7}
            >
              <View style={styles.colorSelectorContent}>
                <Text 
                  numberOfLines={1}
                  style={[
                    styles.colorSelectorText,
                    !row.colorName && { color: '#94A3B8' }
                  ]}
                >
                  {row.colorName || 'Select Color...'}
                </Text>
                <ChevronDown size={14} color="#94A3B8" />
              </View>
            </TouchableOpacity>

            {/* Quantity Input */}
            <TextInput
              keyboardType="number-pad"
              value={row.quantityStr === '0' ? '' : row.quantityStr}
              placeholder="Falls"
              placeholderTextColor="#94A3B8"
              onChangeText={(val) => handleQuantityChange(row.key, val)}
              onBlur={() => {
                if (row.quantityStr === '') {
                  handleQuantityChange(row.key, '0');
                }
              }}
              onFocus={() => {
                setTimeout(() => {
                  scrollViewRef.current?.scrollToEnd({ animated: true });
                }, 150);
              }}
              style={styles.quantityInput}
            />

            {/* Remove Row */}
            <TouchableOpacity 
              style={styles.deleteButton}
              onPress={() => handleRemoveRow(row.key)}
              activeOpacity={0.6}
            >
              <Trash2 size={16} color="#EF4444" />
            </TouchableOpacity>
          </View>
        ))}

        <TouchableOpacity 
          style={styles.addRowButton} 
          onPress={handleAddRow}
          activeOpacity={0.7}
        >
          <Plus size={16} color="#0284C7" />
          <Text style={styles.addRowButtonText}>Add Entry Row</Text>
        </TouchableOpacity>

        {/* Live total */}
        <View style={styles.summaryBox}>
          <Text style={styles.summaryLabel}>Total Volume Preview</Text>
          <Text style={styles.summaryValue}>{totalFalls.toLocaleString()} Falls</Text>
        </View>
      </ScrollView>

      {/* Bottom Action Footer */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <TouchableOpacity 
          style={styles.clearButton} 
          onPress={handleResetDraft}
          activeOpacity={0.7}
        >
          <RotateCcw size={15} color="#475569" style={{ marginRight: 6 }} />
          <Text style={styles.clearButtonText}>Clear Draft</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.saveButton} 
          onPress={handleSave} 
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Save size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.saveButtonText}>Save Logs</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Phonetic Color Search Modal */}
      <Modal
        visible={isModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalHeaderTitle}>Search Marathi Color</Text>
              <TouchableOpacity onPress={() => setIsModalVisible(false)}>
                <X size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            {/* Modal Search Bar */}
            <View style={styles.modalSearchBar}>
              <Search size={16} color="#94A3B8" style={{ marginRight: 8 }} />
              <TextInput
                value={searchQuery}
                placeholder="Type spelling e.g. keshari, rani, लाल"
                placeholderTextColor="#94A3B8"
                onChangeText={handleSearchChange}
                autoFocus
                style={styles.modalSearchInput}
              />
            </View>

            {/* Recent Colors */}
            {!searchQuery.trim() && recentColors.length > 0 && (
              <View style={styles.quickSelectSection}>
                <Text style={styles.quickSelectTitle}>Recent Colors</Text>
                <View style={styles.quickSelectGrid}>
                  {recentColors.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.quickColorPill}
                      onPress={() => selectColor(item)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.quickColorPillText}>{item.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Create Color option */}
            {!exactMatchExists && searchQuery.trim().length > 0 && (
              <TouchableOpacity 
                style={styles.createColorOption}
                onPress={handleCreateColor}
                disabled={loading}
              >
                <Plus size={16} color={COLORS.primary} style={{ marginRight: 6 }} />
                <Text style={styles.createColorText}>
                  Create Color "{searchQuery.trim()}"
                </Text>
              </TouchableOpacity>
            )}

            {/* Colors list */}
            <FlatList
              data={filteredColors}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 20 }}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={styles.colorListItem}
                  onPress={() => selectColor(item)}
                >
                  <Text style={styles.colorListItemText}>{item.name}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={() => (
                <View style={styles.modalEmpty}>
                  <Text style={styles.modalEmptyText}>No matching colors found.</Text>
                  <Text style={styles.modalEmptySubtext}>Type a new color name above to create it.</Text>
                </View>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Date Picker Modal / Native Trigger */}
      {showDatePicker && (
        Platform.OS === 'ios' ? (
          <Modal
            transparent={true}
            animationType="slide"
            visible={showDatePicker}
            onRequestClose={() => setShowDatePicker(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.iosPickerContainer}>
                <View style={styles.iosPickerHeader}>
                  <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                    <Text style={styles.iosPickerCloseText}>Done</Text>
                  </TouchableOpacity>
                </View>
                <DateTimePicker
                  value={parseDateString(entryDate)}
                  mode="date"
                  display="spinner"
                  textColor={COLORS.text}
                  onChange={(event, selectedDate) => {
                    if (selectedDate) {
                      const yyyy = selectedDate.getFullYear();
                      const mm = String(selectedDate.getMonth() + 1).padStart(2, '0');
                      const dd = String(selectedDate.getDate()).padStart(2, '0');
                      setEntryDate(`${yyyy}-${mm}-${dd}`);
                    }
                  }}
                />
              </View>
            </View>
          </Modal>
        ) : (
          <DateTimePicker
            value={parseDateString(entryDate)}
            mode="date"
            display="default"
            onChange={(event, selectedDate) => {
              setShowDatePicker(false);
              if (event.type === 'set' && selectedDate) {
                const yyyy = selectedDate.getFullYear();
                const mm = String(selectedDate.getMonth() + 1).padStart(2, '0');
                const dd = String(selectedDate.getDate()).padStart(2, '0');
                setEntryDate(`${yyyy}-${mm}-${dd}`);
              }
            }}
          />
        )
      )}
    </View>
  </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  dateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  dateHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  datePickerWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  dateInput: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    width: 95,
    padding: 0,
    textAlign: 'center',
  },
  scrollContent: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    padding: 10,
    marginBottom: 10,
    gap: 10,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  rowIndex: {
    width: 28,
    height: 28,
    backgroundColor: 'rgba(2, 132, 199, 0.06)',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowIndexText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0284C7',
  },
  colorSelector: {
    flex: 1,
    height: 44,
    justifyContent: 'center',
    paddingHorizontal: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
  },
  colorSelectorContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  colorSelectorText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  quantityInput: {
    width: 85,
    height: 44,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    textAlign: 'right',
    paddingHorizontal: 10,
    fontSize: 15,
    fontWeight: '700',
    color: '#0284C7',
  },
  deleteButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addRowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: '#0284C7',
    borderStyle: 'dashed',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 8,
    backgroundColor: 'rgba(2, 132, 199, 0.03)',
  },
  addRowButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0284C7',
  },
  summaryBox: {
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#E0F2FE',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    marginTop: 22,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0369A1',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  summaryValue: {
    fontSize: 26,
    fontWeight: '900',
    color: '#0284C7',
    marginTop: 4,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: 12,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  clearButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
  saveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    backgroundColor: '#0284C7',
    borderRadius: 12,
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '72%',
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalHeaderTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  modalSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 46,
    marginBottom: 14,
  },
  modalSearchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    padding: 0,
  },
  createColorOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(92, 62, 163, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(92, 62, 163, 0.1)',
    borderRadius: 8,
    marginBottom: 12,
  },
  createColorText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
  },
  colorListItem: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
    paddingHorizontal: 4,
  },
  colorListItemText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },
  modalEmpty: {
    alignItems: 'center',
    paddingVertical: 36,
  },
  modalEmptyText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  modalEmptySubtext: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 4,
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
  quickSelectSection: {
    marginBottom: 16,
  },
  quickSelectTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  quickSelectGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  quickColorPill: {
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  quickColorPillText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
});
