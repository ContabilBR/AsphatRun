import React, { useCallback, useState } from 'react';
import {
  View, Text, FlatList, Pressable, StyleSheet, StatusBar,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Play } from 'lucide-react-native';
import { AppColors } from '@/constants/AppColors';
import { getAllRuns, Run } from '@/utils/database';
import { formatDistance, formatPace, formatDate } from '@/utils/runUtils';

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [runs, setRuns] = useState<Run[]>([]);

  useFocusEffect(
    useCallback(() => {
      console.log('[HomeScreen] focused — loading runs');
      getAllRuns().then(data => {
        console.log('[HomeScreen] loaded', data.length, 'runs');
        setRuns(data);
      });
    }, [])
  );

  const maxDistance = runs.length > 0 ? Math.max(...runs.map(r => r.distance_meters)) : 0;

  const renderItem = ({ item, index }: { item: Run; index: number }) => {
    const isRecord = item.distance_meters === maxDistance && maxDistance > 0;
    const isLast = index === runs.length - 1;
    return (
      <View>
        <View style={styles.runRow}>
          <Text style={styles.runDate}>{formatDate(item.date)}</Text>
          <View style={styles.runRight}>
            <Text style={styles.runDistance}>{formatDistance(item.distance_meters)}</Text>
            {isRecord ? (
              <Text style={styles.recordBadge}>recorde pessoal</Text>
            ) : (
              <Text style={styles.runPace}>{formatPace(item.avg_pace_seconds_per_km)}</Text>
            )}
          </View>
        </View>
        {!isLast && <View style={styles.divider} />}
      </View>
    );
  };

  const handleStartPress = () => {
    console.log('[HomeScreen] Start button pressed — navigating to active-run');
    router.push('/active-run');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={AppColors.background} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.appTitle}>Asphalt Run</Text>
      </View>

      {/* Start button */}
      <View style={styles.startSection}>
        <Pressable
          style={({ pressed }) => [styles.startButton, pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] }]}
          onPress={handleStartPress}
        >
          <Play color={AppColors.background} size={32} fill={AppColors.background} />
          <Text style={styles.startLabel}>Iniciar</Text>
        </Pressable>
      </View>

      {/* Recent runs */}
      {runs.length > 0 && (
        <View style={styles.listSection}>
          <Text style={styles.sectionTitle}>Últimas corridas</Text>
          <FlatList
            data={runs.slice(0, 10)}
            keyExtractor={item => String(item.id)}
            renderItem={renderItem}
            scrollEnabled={false}
          />
        </View>
      )}

      {runs.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Nenhuma corrida ainda.</Text>
          <Text style={styles.emptySubtext}>Toque em Iniciar para começar.</Text>
        </View>
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
    paddingBottom: 4,
  },
  appTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: AppColors.textPrimary,
    letterSpacing: 0.5,
  },
  startSection: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  startButton: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: AppColors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  startLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: AppColors.background,
    letterSpacing: 0.3,
  },
  listSection: {
    flex: 1,
    paddingHorizontal: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '500',
    color: AppColors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  runRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
  },
  runDate: {
    fontSize: 15,
    color: AppColors.textPrimary,
  },
  runRight: {
    alignItems: 'flex-end',
    gap: 2,
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
  recordBadge: {
    fontSize: 12,
    color: AppColors.record,
    fontWeight: '500',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: AppColors.textSecondary + '44',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 16,
    gap: 6,
  },
  emptyText: {
    fontSize: 16,
    color: AppColors.textSecondary,
  },
  emptySubtext: {
    fontSize: 14,
    color: AppColors.textSecondary + '88',
  },
});
