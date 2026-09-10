import React, { useCallback, useState, useMemo } from 'react';
import {
  View, Text, FlatList, Pressable, StyleSheet,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppColors } from '@/constants/AppColors';
import { getAllRuns, Run } from '@/utils/database';
import { formatDistance, formatPace, formatDate, formatDuration } from '@/utils/runUtils';

const MONTHS_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export default function HistoricoScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [runs, setRuns] = useState<Run[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      console.log('[Historico] focused — loading runs');
      getAllRuns().then(data => {
        console.log('[Historico] loaded', data.length, 'runs');
        setRuns(data);
      });
    }, [])
  );

  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    runs.forEach(r => {
      const d = new Date(r.date);
      months.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    });
    return Array.from(months).sort().reverse();
  }, [runs]);

  const filteredRuns = useMemo(() => {
    if (!selectedMonth) return runs;
    return runs.filter(r => {
      const d = new Date(r.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      return key === selectedMonth;
    });
  }, [runs, selectedMonth]);

  const formatMonthLabel = (key: string) => {
    const [year, month] = key.split('-');
    return `${MONTHS_PT[Number(month) - 1]} ${year}`;
  };

  const handleRunPress = (item: Run) => {
    console.log('[Historico] run pressed, id:', item.id, 'date:', item.date);
    router.push({ pathname: '/run-detail', params: { mode: 'history', run_id: String(item.id) } });
  };

  const handleMonthFilter = (month: string | null) => {
    console.log('[Historico] month filter selected:', month ?? 'all');
    setSelectedMonth(month);
  };

  const renderItem = ({ item, index }: { item: Run; index: number }) => {
    const isLast = index === filteredRuns.length - 1;
    const dateDisplay = formatDate(item.date);
    const durationDisplay = formatDuration(item.duration_seconds);
    const distanceDisplay = formatDistance(item.distance_meters);
    const paceDisplay = formatPace(item.avg_pace_seconds_per_km);
    return (
      <View>
        <Pressable
          style={({ pressed }) => [styles.runRow, pressed && { opacity: 0.7 }]}
          onPress={() => handleRunPress(item)}
        >
          <View style={styles.runLeft}>
            <Text style={styles.runDate}>{dateDisplay}</Text>
            <Text style={styles.runDuration}>{durationDisplay}</Text>
          </View>
          <View style={styles.runRight}>
            <Text style={styles.runDistance}>{distanceDisplay}</Text>
            <Text style={styles.runPace}>{paceDisplay}</Text>
          </View>
        </Pressable>
        {!isLast && <View style={styles.divider} />}
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Histórico</Text>
      </View>

      {/* Month filter */}
      {availableMonths.length > 1 && (
        <View style={styles.filterSection}>
          <FlatList
            horizontal
            data={[null, ...availableMonths] as (string | null)[]}
            keyExtractor={item => item ?? 'all'}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 24, gap: 8 }}
            renderItem={({ item }) => {
              const isActive = item === selectedMonth;
              const label = item === null ? 'Todos' : formatMonthLabel(item);
              return (
                <Pressable
                  style={[styles.filterChip, isActive && styles.filterChipActive]}
                  onPress={() => handleMonthFilter(item)}
                >
                  <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                    {label}
                  </Text>
                </Pressable>
              );
            }}
          />
        </View>
      )}

      {filteredRuns.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Nenhuma corrida encontrada.</Text>
        </View>
      ) : (
        <FlatList
          data={filteredRuns}
          keyExtractor={item => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 80 }}
          contentInsetAdjustmentBehavior="automatic"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: AppColors.textPrimary,
    letterSpacing: 0.5,
  },
  filterSection: {
    marginBottom: 16,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: AppColors.textSecondary + '55',
  },
  filterChipActive: {
    backgroundColor: AppColors.accent,
    borderColor: AppColors.accent,
  },
  filterChipText: {
    fontSize: 13,
    color: AppColors.textSecondary,
  },
  filterChipTextActive: {
    color: AppColors.background,
    fontWeight: '600',
  },
  runRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
  },
  runLeft: {
    gap: 3,
  },
  runDate: {
    fontSize: 15,
    color: AppColors.textPrimary,
  },
  runDuration: {
    fontSize: 13,
    fontFamily: 'SpaceMono',
    color: AppColors.textSecondary,
  },
  runRight: {
    alignItems: 'flex-end',
    gap: 3,
  },
  runDistance: {
    fontSize: 17,
    fontFamily: 'SpaceMono',
    fontWeight: '500',
    color: AppColors.textPrimary,
  },
  runPace: {
    fontSize: 13,
    fontFamily: 'SpaceMono',
    color: AppColors.textSecondary,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: AppColors.textSecondary + '44',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: AppColors.textSecondary,
  },
});
