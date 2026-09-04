import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator, 
  Dimensions,
  Image
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { 
  TrendingUp, 
  Calendar, 
  IndianRupee, 
  Sparkles, 
  Layers, 
  ChevronRight 
} from 'lucide-react-native';
import { dbService } from '../services/dbService';
import { COLORS } from '../utils/theme';
import type { ProductionEntry, Rate } from '../types';
import { formatDateToDDMMYYYY } from '../utils/dateFormatter';

export const DashboardScreen = ({ navigation }: { navigation: any }) => {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [appName, setAppName] = useState('FallTrack');
  const [managerName, setManagerName] = useState('');
  
  // KPI states
  const [todayFalls, setTodayFalls] = useState(0);
  const [monthlyFalls, setMonthlyFalls] = useState(0);
  const [currentRate, setCurrentRate] = useState(5.0);
  const [estMonthlyIncome, setEstMonthlyIncome] = useState(0);
  
  const [recentEntries, setRecentEntries] = useState<ProductionEntry[]>([]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      // 1. Load local cache instantly to show layout immediately
      loadDashboardData(true).then(() => {
        // 2. Perform online sync update in the background silently
        loadDashboardData(false);
      });
    });
    return unsubscribe;
  }, [navigation]);

  const loadDashboardData = async (forceLocal = false) => {
    if (forceLocal) {
      setLoading(true);
    }
    try {
      // 1. Load Profile
      const profile = await dbService.getProfile(forceLocal);
      setAppName(profile.app_name);
      setManagerName(profile.manager_name);

      // 2. Load Rates & Resolve Current active rate
      const rates = await dbService.getRates(forceLocal);
      const todayObj = new Date();
      const todayStr = `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, '0')}-${String(todayObj.getDate()).padStart(2, '0')}`;
      const activeRate = resolveRateForDate(rates, todayStr);
      setCurrentRate(activeRate);

      // 3. Load Entries and Custom Income Periods
      const allEntries = await dbService.getProductionEntries(undefined, forceLocal);
      const periods = await dbService.getIncomePeriods(forceLocal);

      // Today's total
      const todayEntries = allEntries.filter(e => e.entry_date === todayStr);
      const todaySum = todayEntries.reduce((sum, e) => sum + e.quantity, 0);
      setTodayFalls(todaySum);

      // Active cycle start date
      let cycleStartDate = '';
      if (periods.length > 0) {
        const sorted = [...periods].sort((a, b) => b.end_date.localeCompare(a.end_date));
        const latest = sorted[0];
        const [year, month, day] = latest.end_date.split('-').map(Number);
        const d = new Date(year, month - 1, day);
        d.setDate(d.getDate() + 1);
        cycleStartDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      } else if (allEntries.length > 0) {
        const sorted = [...allEntries].sort((a, b) => a.entry_date.localeCompare(b.entry_date));
        cycleStartDate = sorted[0].entry_date;
      } else {
        const d = new Date();
        cycleStartDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      }

      // Cycle total
      const cycleEntries = allEntries.filter(e => e.entry_date >= cycleStartDate);
      const cycleSum = cycleEntries.reduce((sum, e) => sum + e.quantity, 0);
      setMonthlyFalls(cycleSum);

      // Estimate income on cycle volume
      const estimatedIncome = (cycleSum / 12) * activeRate;
      setEstMonthlyIncome(estimatedIncome);

      // 4. Get recent entries
      setRecentEntries(allEntries.slice(0, 5));
    } catch (err) {
      console.warn('Dashboard load error:', err);
    } finally {
      if (forceLocal) {
        setLoading(false);
      }
    }
  };

  const resolveRateForDate = (rates: Rate[], dateStr: string): number => {
    if (rates.length === 0) return 5.0;
    const sorted = [...rates].sort((a, b) => b.effective_from.localeCompare(a.effective_from));
    const active = sorted.find(r => dateStr >= r.effective_from);
    return active ? active.rate_per_dozen : sorted[sorted.length - 1].rate_per_dozen;
  };

  const getGroupedRecentEntries = () => {
    const groups: { [dateStr: string]: ProductionEntry[] } = {};
    recentEntries.forEach(item => {
      if (!groups[item.entry_date]) {
        groups[item.entry_date] = [];
      }
      groups[item.entry_date].push(item);
    });
    return Object.keys(groups)
      .map(date => {
        const data = groups[date];
        const totalQty = data.reduce((sum, e) => sum + e.quantity, 0);
        return {
          date,
          totalQty,
          data
        };
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <View style={styles.logoBadgeContainer}>
            <Image 
              source={require('../../assets/icon.png')} 
              style={{ width: 26, height: 26, borderRadius: 6 }} 
              resizeMode="contain"
            />
            <Text style={styles.headerTitle}>{appName}</Text>
          </View>
          <Text style={styles.headerSubtitle}>Manager: {managerName || '...'}</Text>
        </View>
        <View style={styles.managerControl}>
          <Text style={styles.managerControlText}>Manager Panel</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Main stats grid */}
          <View style={styles.statsGrid}>
            {/* Stat Card 1: Today's Production */}
            <View style={styles.statCard}>
              <Sparkles size={80} color="#0284C7" style={styles.cardWatermark} />
              
              <View style={styles.cardHeaderRow}>
                <View style={styles.cardTextContent}>
                  <Text style={styles.statLabel}>Today's Falls</Text>
                  <Text style={styles.statValue}>{todayFalls.toLocaleString()}</Text>
                </View>
                <View style={[styles.iconWrapper, { backgroundColor: 'rgba(2, 132, 199, 0.08)' }]}>
                  <Sparkles size={20} color="#0284C7" />
                </View>
              </View>
            </View>

            {/* Stat Card 2: Active Rate */}
            <View style={styles.statCard}>
              <IndianRupee size={80} color="#10B981" style={styles.cardWatermark} />
              
              <View style={styles.cardHeaderRow}>
                <View style={styles.cardTextContent}>
                  <Text style={styles.statLabel}>Rate per Dozen</Text>
                  <Text style={styles.statValue}>₹{currentRate.toFixed(2)}</Text>
                </View>
                <View style={[styles.iconWrapper, { backgroundColor: 'rgba(16, 185, 129, 0.08)' }]}>
                  <IndianRupee size={20} color="#10B981" />
                </View>
              </View>
            </View>

            {/* Stat Card 3: Cycle Production */}
            <View style={styles.statCard}>
               <Calendar size={80} color="#F59E0B" style={styles.cardWatermark} />
               
               <View style={styles.cardHeaderRow}>
                 <View style={styles.cardTextContent}>
                   <Text style={styles.statLabel}>Total Monthly Falls</Text>
                   <Text style={styles.statValue}>{monthlyFalls.toLocaleString()}</Text>
                 </View>
                 <View style={[styles.iconWrapper, { backgroundColor: 'rgba(245, 158, 11, 0.08)' }]}>
                   <Calendar size={20} color="#F59E0B" />
                 </View>
               </View>
             </View>
 
             {/* Stat Card 4: Estimated Cycle Income */}
             <View style={[styles.statCard, styles.accentCard]}>
               <TrendingUp size={80} color="#8B5CF6" style={[styles.cardWatermark, { opacity: 0.08 }]} />
               
               <View style={styles.cardHeaderRow}>
                 <View style={styles.cardTextContent}>
                   <Text style={styles.statLabel}>Est. Monthly Income</Text>
                   <Text style={styles.statValue}>₹{Math.round(estMonthlyIncome).toLocaleString()}</Text>
                 </View>
                 <View style={[styles.iconWrapper, { backgroundColor: 'rgba(139, 92, 246, 0.08)' }]}>
                   <TrendingUp size={20} color="#8B5CF6" />
                 </View>
               </View>
             </View>
          </View>

          {/* Quick Actions */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
          </View>
          <View style={styles.actionsContainer}>
            <TouchableOpacity 
              style={styles.actionButton} 
              onPress={() => navigation.navigate('Daily Entry')}
            >
              <Layers size={20} color={COLORS.primary} />
              <Text style={styles.actionButtonText}>Log Production</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.actionButton} 
              onPress={() => navigation.navigate('Income Tracker')}
            >
              <TrendingUp size={20} color={COLORS.primary} />
              <Text style={styles.actionButtonText}>Income Cycles</Text>
            </TouchableOpacity>
          </View>

          {/* Recent entries */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Logs</Text>
            <TouchableOpacity onPress={() => navigation.navigate('History')}>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>

          {recentEntries.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No production logs recorded yet.</Text>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              {getGroupedRecentEntries().map((group) => (
                <View key={group.date} style={styles.recentGroupCard}>
                  {/* Group Header */}
                  <View style={styles.recentGroupHeader}>
                    <Text style={styles.recentGroupDate}>{formatDateToDDMMYYYY(group.date)}</Text>
                    <View style={styles.recentGroupBadge}>
                      <Text style={styles.recentGroupBadgeText}>{group.totalQty} Falls</Text>
                    </View>
                  </View>
                  
                  {/* Group Items */}
                  <View style={styles.recentGroupItems}>
                    {group.data.map((item, idx) => (
                      <View key={item.id || String(idx)} style={styles.recentItemRow}>
                        <Text style={styles.recentItemColor}>{item.color?.name || 'Unspecified'}</Text>
                        <Text style={styles.recentItemQty}>{item.quantity} Falls</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
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
  logoBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoBadge: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  logoBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.primary,
  },
  headerSubtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  managerControl: {
    backgroundColor: COLORS.lavender,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(92, 62, 163, 0.1)',
  },
  managerControlText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  scrollContent: {
    padding: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    backgroundColor: '#FFFFFF',
    width: (Dimensions.get('window').width - 44) / 2,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 2,
    overflow: 'hidden',
  },
  accentCard: {
    borderColor: 'rgba(139, 92, 246, 0.2)',
    shadowColor: COLORS.primary,
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 3,
  },
  cardWatermark: {
    position: 'absolute',
    right: -15,
    bottom: -15,
    opacity: 0.04,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  cardTextContent: {
    flex: 1,
  },
  badgeRow: {
    marginTop: 10,
    alignItems: 'flex-start',
    width: '100%',
  },
  badgePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  iconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 0,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.text,
    marginTop: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 12,
    borderRadius: 10,
    elevation: 1,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  emptyContainer: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontWeight: '500',
  },
  recentGroupCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  recentGroupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  recentGroupDate: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.text,
  },
  recentGroupBadge: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  recentGroupBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0284C7',
  },
  recentGroupItems: {
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  recentItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  recentItemColor: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  recentItemQty: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.textMuted,
  },
});
