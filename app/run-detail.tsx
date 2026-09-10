import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, Alert, Share,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Polyline, Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { ChevronLeft, Flag, Share2 } from 'lucide-react-native';
import { AppColors } from '@/constants/AppColors';
import { saveRun, getRunById, Run } from '@/utils/database';
import { formatDistance, formatDuration, formatPace, formatDate } from '@/utils/runUtils';

export default function RunDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    mode: string;
    run_id?: string;
    duration_seconds?: string;
    distance_meters?: string;
    avg_pace_seconds_per_km?: string;
    route_points?: string;
    date?: string;
  }>();

  const [run, setRun] = useState<Run | null>(null);

  useEffect(() => {
    if (params.mode === 'history' && params.run_id) {
      console.log('[RunDetail] loading run from DB, id:', params.run_id);
      getRunById(Number(params.run_id)).then(setRun);
    } else if (params.mode === 'post-run') {
      console.log('[RunDetail] building run from post-run params');
      setRun({
        id: -1,
        date: params.date ?? new Date().toISOString(),
        duration_seconds: Number(params.duration_seconds ?? 0),
        distance_meters: Number(params.distance_meters ?? 0),
        avg_pace_seconds_per_km: Number(params.avg_pace_seconds_per_km ?? 0),
        route_points: params.route_points ? JSON.parse(params.route_points) : [],
      });
    }
  }, []);

  const handleSave = async () => {
    if (!run) return;
    console.log('[RunDetail] save pressed — saving run to DB');
    await saveRun({
      date: run.date,
      duration_seconds: run.duration_seconds,
      distance_meters: run.distance_meters,
      avg_pace_seconds_per_km: run.avg_pace_seconds_per_km,
      route_points: run.route_points,
    });
    console.log('[RunDetail] run saved — navigating to home');
    router.replace('/(tabs)/(home)');
  };

  const handleDiscard = () => {
    console.log('[RunDetail] discard pressed');
    Alert.alert('Descartar corrida?', 'O trajeto não será salvo.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Descartar', style: 'destructive',
        onPress: () => {
          console.log('[RunDetail] discard confirmed — navigating to home');
          router.replace('/(tabs)/(home)');
        },
      },
    ]);
  };

  const handleShare = async () => {
    if (!run) return;
    const distText = formatDistance(run.distance_meters);
    const durText = formatDuration(run.duration_seconds);
    const paceText = formatPace(run.avg_pace_seconds_per_km);
    const text = `Corri ${distText} em ${durText} com ritmo médio de ${paceText} — Asphalt Run`;
    console.log('[RunDetail] share pressed:', text);
    await Share.share({ message: text });
  };

  if (!run) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Text style={{ color: AppColors.textSecondary, textAlign: 'center', marginTop: 40 }}>Carregando...</Text>
      </View>
    );
  }

  const polylineCoords = run.route_points.map(p => ({ latitude: p.lat, longitude: p.lng }));
  const startPoint = run.route_points[0];
  const endPoint = run.route_points[run.route_points.length - 1];
  const hasMultiplePoints = run.route_points.length > 1;
  const isEndDifferent = endPoint && endPoint !== startPoint;

  // Compute map region to fit all points
  let region = {
    latitude: startPoint?.lat ?? -23.5505,
    longitude: startPoint?.lng ?? -46.6333,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  };
  if (run.route_points.length > 1) {
    const lats = run.route_points.map(p => p.lat);
    const lngs = run.route_points.map(p => p.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    region = {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: Math.max((maxLat - minLat) * 1.4, 0.005),
      longitudeDelta: Math.max((maxLng - minLng) * 1.4, 0.005),
    };
  }

  const isPostRun = params.mode === 'post-run';
  const headerTitle = isPostRun ? 'Corrida finalizada' : formatDate(run.date);

  const distanceDisplay = formatDistance(run.distance_meters);
  const durationDisplay = formatDuration(run.duration_seconds);
  const paceDisplay = formatPace(run.avg_pace_seconds_per_km);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        {!isPostRun && (
          <Pressable style={styles.backBtn} onPress={() => {
            console.log('[RunDetail] back pressed');
            router.back();
          }}>
            <ChevronLeft color={AppColors.textPrimary} size={26} />
          </Pressable>
        )}
        <Text style={styles.headerTitle}>{headerTitle}</Text>
      </View>

      {/* Map */}
      <View style={styles.mapContainer}>
        <MapView
          style={StyleSheet.absoluteFillObject}
          provider={PROVIDER_DEFAULT}
          userInterfaceStyle="dark"
          region={region}
          scrollEnabled={false}
          zoomEnabled={false}
          rotateEnabled={false}
          pitchEnabled={false}
        >
          {hasMultiplePoints && (
            <Polyline
              coordinates={polylineCoords}
              strokeColor={AppColors.accent}
              strokeWidth={4}
            />
          )}
          {startPoint && (
            <Marker coordinate={{ latitude: startPoint.lat, longitude: startPoint.lng }}>
              <View style={styles.startMarker} />
            </Marker>
          )}
          {isEndDifferent && (
            <Marker coordinate={{ latitude: endPoint.lat, longitude: endPoint.lng }}>
              <View style={styles.endMarkerContainer}>
                <Flag color={AppColors.accent} size={20} fill={AppColors.accent} />
              </View>
            </Marker>
          )}
        </MapView>
      </View>

      {/* Metrics */}
      <View style={styles.metricsSection}>
        <View style={styles.metricRow}>
          <View style={styles.metricBlock}>
            <Text style={styles.metricValue}>{distanceDisplay}</Text>
            <Text style={styles.metricLabel}>distância</Text>
          </View>
          <View style={styles.metricSep} />
          <View style={styles.metricBlock}>
            <Text style={styles.metricValue}>{durationDisplay}</Text>
            <Text style={styles.metricLabel}>tempo</Text>
          </View>
          <View style={styles.metricSep} />
          <View style={styles.metricBlock}>
            <Text style={styles.metricValue}>{paceDisplay}</Text>
            <Text style={styles.metricLabel}>ritmo médio</Text>
          </View>
        </View>
      </View>

      {/* Actions */}
      <View style={[styles.actions, { paddingBottom: insets.bottom + 16 }]}>
        {isPostRun ? (
          <>
            <Pressable style={styles.discardButton} onPress={handleDiscard}>
              <Text style={styles.discardLabel}>Descartar</Text>
            </Pressable>
            <Pressable style={styles.saveButton} onPress={handleSave}>
              <Text style={styles.saveLabel}>Salvar</Text>
            </Pressable>
          </>
        ) : (
          <Pressable style={styles.shareButton} onPress={handleShare}>
            <Share2 color={AppColors.background} size={20} />
            <Text style={styles.saveLabel}>Compartilhar</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 4,
  },
  backBtn: {
    padding: 4,
    marginRight: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: AppColors.textPrimary,
  },
  mapContainer: {
    height: 280,
    backgroundColor: '#2A2D30',
  },
  metricsSection: {
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metricBlock: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  metricValue: {
    fontSize: 22,
    fontFamily: 'SpaceMono',
    fontWeight: '500',
    color: AppColors.textPrimary,
  },
  metricLabel: {
    fontSize: 12,
    color: AppColors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metricSep: {
    width: StyleSheet.hairlineWidth,
    height: 40,
    backgroundColor: AppColors.textSecondary + '55',
  },
  actions: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingTop: 8,
    gap: 12,
  },
  discardButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: AppColors.textSecondary + '88',
    alignItems: 'center',
  },
  discardLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: AppColors.textSecondary,
  },
  saveButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: AppColors.accent,
    alignItems: 'center',
  },
  saveLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: AppColors.background,
  },
  shareButton: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: AppColors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  startMarker: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2.5,
    borderColor: AppColors.textPrimary,
    backgroundColor: 'transparent',
  },
  endMarkerContainer: {
    padding: 2,
  },
});
