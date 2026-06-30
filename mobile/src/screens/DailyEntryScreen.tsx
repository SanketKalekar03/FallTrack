import React, { useState, useEffect } from 'react';
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
  Platform
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
  X
} from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { dbService } from '../services/dbService';
import { matchColor, isExactColorMatch } from '../utils/transliterate';
import { COLORS } from '../utils/theme';
import type { Color } from '../types';

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

  useEffect(() => {
    loadColors();
    loadDraft();
  }, []);

  useEffect(() => {
    saveDraft();
  }, [rows, entryDate]);

  const loadColors = async () => {
    try {
      const fetchedColors = await dbService.getColors();
      setColors(fetchedColors);
      setFilteredColors(fetchedColors);
    } catch (err) {
      console.warn('Load colors error:', err);
    }
  };

  const loadDraft = async () => {
    try {
      const draftObj = await dbService.getDraft();
      if (draftObj.rows) setRows(draftObj.rows);
      if (draftObj.date) setEntryDate(draftObj.date);
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
      
      // Reload local color catalog
      const updatedColors = await dbService.getColors();
      setColors(updatedColors);

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
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Date selector header */}
      <View style={styles.dateHeader}>
        <View style={styles.dateHeaderLeft}>
          <Sparkles size={20} color={COLORS.primary} />
          <Text style={styles.dateHeaderTitle}>Log Production</Text>
        </View>
        <TouchableOpacity 
          activeOpacity={0.7}
          onPress={() => setShowDatePicker(true)}
          style={styles.datePickerWrapper}
        >
          <Calendar size={16} color={COLORS.primary} style={{ marginRight: 4 }} />
          <TextInput
            value={entryDate}
            editable={false}
            pointerEvents="none"
            placeholder="YYYY-MM-DD"
            style={styles.dateInput}
          />
        </TouchableOpacity>
      </View>

      {/* Entry Rows List */}
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Text style={styles.sectionTitle}>Entry Rows ({rows.length})</Text>
        
        {rows.map((row, index) => (
          <View key={row.key} style={styles.rowCard}>
            <View style={styles.rowIndex}>
              <Text style={styles.rowIndexText}>{index + 1}</Text>
            </View>

            {/* Color select input */}
            <TouchableOpacity 
              style={styles.colorSelector}
              onPress={() => openColorPicker(row.key)}
            >
              <Text style={[
                styles.colorSelectorText,
                !row.colorName && { color: COLORS.textMuted }
              ]}>
                {row.colorName || 'Select Color...'}
              </Text>
            </TouchableOpacity>

            {/* Quantity Input */}
            <TextInput
              keyboardType="number-pad"
              value={row.quantityStr === '0' ? '' : row.quantityStr}
              placeholder="Falls"
              onChangeText={(val) => handleQuantityChange(row.key, val)}
              onBlur={() => {
                if (row.quantityStr === '') {
                  handleQuantityChange(row.key, '0');
                }
              }}
              style={styles.quantityInput}
            />

            {/* Remove Row */}
            <TouchableOpacity 
              style={styles.deleteButton}
              onPress={() => handleRemoveRow(row.key)}
            >
              <Trash2 size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>
        ))}

        <TouchableOpacity style={styles.addRowButton} onPress={handleAddRow}>
          <Plus size={18} color={COLORS.primary} />
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
        <TouchableOpacity style={styles.clearButton} onPress={handleResetDraft}>
          <RotateCcw size={16} color={COLORS.text} style={{ marginRight: 4 }} />
          <Text style={styles.clearButtonText}>Clear Draft</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={loading}>
          {loading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Save size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
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
              <Search size={16} color={COLORS.textMuted} style={{ marginRight: 8 }} />
              <TextInput
                value={searchQuery}
                placeholder="Type spelling e.g. keshari, rani, लाल"
                onChangeText={handleSearchChange}
                autoFocus
                style={styles.modalSearchInput}
              />
            </View>

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
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 8,
    marginBottom: 8,
    gap: 8,
  },
  rowIndex: {
    width: 26,
    height: 26,
    backgroundColor: '#F1F5F9',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowIndexText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.textMuted,
  },
  colorSelector: {
    flex: 1,
    height: 42,
    justifyContent: 'center',
    paddingHorizontal: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
  },
  colorSelectorText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  quantityInput: {
    width: 85,
    height: 42,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
    textAlign: 'right',
    paddingHorizontal: 8,
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
  },
  deleteButton: {
    padding: 6,
  },
  addRowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderStyle: 'dashed',
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 6,
    backgroundColor: 'rgba(92, 62, 163, 0.02)',
  },
  addRowButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
  },
  summaryBox: {
    backgroundColor: COLORS.lavender,
    borderWidth: 1,
    borderColor: 'rgba(92, 62, 163, 0.05)',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    marginTop: 18,
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
    textTransform: 'uppercase',
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.primary,
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
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
  clearButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  saveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    shadowColor: COLORS.primary,
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
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '60%',
    padding: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
    textTransform: 'uppercase',
  },
  modalSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 44,
    marginBottom: 10,
  },
  modalSearchInput: {
    flex: 1,
    fontSize: 15,
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
});
