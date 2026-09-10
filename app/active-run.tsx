import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, Alert, AppState, AppStateStatus,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { Pause, Play, Square, X } from 'lucide-react-native';
import { AppColors } from '@/constants/AppColors';
import { formatDistance, formatDuration, formatPace, calcDistance } from '@/utils/runUtils';
import {
  setActiveRunValue,
  getActiveRunValue,
  clearActiveRunState,
  getActiveRunPoints,
  appendActiveRunPoint,
} from '@/utils/database';
import type { RoutePoint } from '@/utils/database';
import {
  startBackgroundLocationTask,
  stopBackgroundLocationTask,
} from '@/utils/backgroundTask';
import RunMap from '@/components/RunMap';

type RunState = 'running' | 'paused';

export default function ActiveRunScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<any>(null);

  const [runState, setRunState] = useState<RunState>('running');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [distanceMeters, setDistanceMeters] = useState(0);
  const [routePoints, setRoutePoints] = useState<RoutePoint[]>([]);
  const [locationPermission, setLocationPermission] = useState<boolean | null>(null);

  // Wall-clock timer refs
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const runStateRef = useRef<RunState>('running');

  // Foreground fallback subscription ref (used when background permission is denied)
  const fgSubscriptionRef = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => { runStateRef.current = runState; }, [runState]);

  // Compute elapsed seconds from persisted start time and paused duration
  const computeElapsed = useCallback(async (): Promise<number> => {
    const startStr = await getActiveRunValue('start_time');
    const pausedStr = await getActiveRunValue('paused_duration_ms');
    const isPausedStr = await getActiveRunValue('is_paused');
    const pauseStartStr = await getActiveRunValue('pause_start_time');

    if (!startStr) return 0;

    const startTime = parseInt(startStr, 10);
    const pausedDuration = pausedStr ? parseInt(pausedStr, 10) : 0;
    const isPaused = isPausedStr === 'true';

    let now = Date.now();
    // If currently paused, don't count time since pause started
    if (isPaused && pauseStartStr) {
      now = parseInt(pauseStartStr, 10);
    }

    const totalMs = now - startTime - pausedDuration;
    return Math.max(0, Math.floor(totalMs / 1000));
  }, []);

  // Sync state from SQLite (called on foreground return and on interval)
  const syncFromStorage = useCallback(async () => {
    const [elapsed, dist, points] = await Promise.all([
      computeElapsed(),
      getActiveRunValue('distance_meters').then(v => v ? parseFloat(v) : 0),
      getActiveRunPoints(),
    ]);
    setElapsedSeconds(elapsed);
    setDistanceMeters(dist);
    setRoutePoints(points);

    // Pan map to last point
    if (points.length > 0) {
      const last = points[points.length - 1];
      mapRef.current?.animateToRegion?.({
        latitude: last.lat,
        longitude: last.lng,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      }, 500);
    }
  }, [computeElapsed]);

  // Start the UI refresh interval
  const startUITimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(async () => {
      if (runStateRef.current === 'running') {
        await syncFromStorage();
      }
    }, 1000);
  }, [syncFromStorage]);

  const stopUITimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // AppState listener — sync when returning to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextState: AppStateStatus) => {
      console.log('[ActiveRun] AppState changed to:', nextState);
      if (nextState === 'active') {
        console.log('[ActiveRun] returned to foreground — syncing state from storage');
        await syncFromStorage();
        if (runStateRef.current === 'running') startUITimer();
      } else if (nextState === 'background' || nextState === 'inactive') {
        console.log('[ActiveRun] going to background — stopping UI timer');
        stopUITimer();
      }
    });
    return () => subscription.remove();
  }, [syncFromStorage, startUITimer, stopUITimer]);

  // Initialize run on mount
  useEffect(() => {
    (async () => {
      console.log('[ActiveRun] initializing — requesting location permissions');
      const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
      if (fgStatus !== 'granted') {
        console.log('[ActiveRun] foreground location permission denied');
        setLocationPermission(false);
        return;
      }
      console.log('[ActiveRun] foreground location permission granted');

      const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
      console.log('[ActiveRun] background location permission:', bgStatus);

      setLocationPermission(true);

      // Persist run start state
      const now = Date.now();
      console.log('[ActiveRun] starting new run, timestamp:', now);
      await clearActiveRunState();
      await setActiveRunValue('start_time', String(now));
      await setActiveRunValue('paused_duration_ms', '0');
      await setActiveRunValue('is_paused', 'false');
      await setActiveRunValue('distance_meters', '0');

      if (bgStatus === 'granted') {
        // Start background location task (works even when app is minimized)
        await startBackgroundLocationTask();
      } else {
        // Fallback: foreground-only tracking via watchPositionAsync
        console.log('[ActiveRun] background permission denied — using foreground-only tracking');
        const sub = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.BestForNavigation,
            timeInterval: 5000,
            distanceInterval: 5,
          },
          async (loc) => {
            const point: RoutePoint = {
              lat: loc.coords.latitude,
              lng: loc.coords.longitude,
              timestamp: loc.timestamp,
            };

            // Filter 1: discard points with poor GPS accuracy
            const accuracy = loc.coords.accuracy ?? Infinity;
            if (accuracy > 20) {
              console.log('[ActiveRun] discarding point — accuracy too low:', accuracy.toFixed(1), 'm');
              return;
            }

            const lastPointStr = await getActiveRunValue('last_point');
            if (lastPointStr) {
              const lastPoint: RoutePoint = JSON.parse(lastPointStr);
              const d = calcDistance(lastPoint.lat, lastPoint.lng, point.lat, point.lng);
              if (d >= 3) {
                const currentDistStr = await getActiveRunValue('distance_meters');
                const currentDist = currentDistStr ? parseFloat(currentDistStr) : 0;
                await setActiveRunValue('distance_meters', String(currentDist + d));
                await appendActiveRunPoint(point);
                await setActiveRunValue('last_point', JSON.stringify(point));
              } else {
                console.log('[ActiveRun] skipping accumulation — delta too small:', d.toFixed(2), 'm');
                await appendActiveRunPoint(point);
                // do NOT update distance_meters or last_point
              }
            } else {
              // First point — always record
              await appendActiveRunPoint(point);
              await setActiveRunValue('last_point', JSON.stringify(point));
            }
          }
        );
        fgSubscriptionRef.current = sub;
      }

      // Start UI refresh
      startUITimer();
    })();

    return () => {
      stopUITimer();
      fgSubscriptionRef.current?.remove();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePauseResume = async () => {
    if (runState === 'running') {
      console.log('[ActiveRun] pause pressed');
      const pauseStart = Date.now();
      await setActiveRunValue('is_paused', 'true');
      await setActiveRunValue('pause_start_time', String(pauseStart));
      setRunState('paused');
      runStateRef.current = 'paused';
      stopUITimer();
    } else {
      console.log('[ActiveRun] resume pressed');
      const pauseStartStr = await getActiveRunValue('pause_start_time');
      const pausedDurStr = await getActiveRunValue('paused_duration_ms');
      if (pauseStartStr) {
        const additionalPause = Date.now() - parseInt(pauseStartStr, 10);
        const existing = pausedDurStr ? parseInt(pausedDurStr, 10) : 0;
        const newTotal = existing + additionalPause;
        console.log('[ActiveRun] resuming — adding', additionalPause, 'ms to paused duration, total:', newTotal, 'ms');
        await setActiveRunValue('paused_duration_ms', String(newTotal));
      }
      await setActiveRunValue('is_paused', 'false');
      await setActiveRunValue('pause_start_time', '');
      setRunState('running');
      runStateRef.current = 'running';
      startUITimer();
    }
  };

  const handleFinish = async () => {
    console.log('[ActiveRun] finish pressed');
    stopUITimer();
    fgSubscriptionRef.current?.remove();
    fgSubscriptionRef.current = null;
    await stopBackgroundLocationTask();

    // Final sync
    const [finalElapsed, finalDist, finalPoints] = await Promise.all([
      computeElapsed(),
      getActiveRunValue('distance_meters').then(v => v ? parseFloat(v) : 0),
      getActiveRunPoints(),
    ]);

    console.log('[ActiveRun] run finished — duration:', finalElapsed, 's, distance:', finalDist.toFixed(1), 'm, points:', finalPoints.length);

    await clearActiveRunState();

    const avgPace = finalDist > 0 ? (finalElapsed / (finalDist / 1000)) : 0;
    router.replace({
      pathname: '/run-detail',
      params: {
        mode: 'post-run',
        duration_seconds: String(finalElapsed),
        distance_meters: String(finalDist),
        avg_pace_seconds_per_km: String(avgPace),
        route_points: JSON.stringify(finalPoints),
        date: new Date().toISOString(),
      },
    });
  };

  const handleDiscard = () => {
    console.log('[ActiveRun] discard pressed');
    Alert.alert('Descartar corrida?', 'O trajeto não será salvo.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Descartar', style: 'destructive',
        onPress: async () => {
          console.log('[ActiveRun] discard confirmed — stopping task and going back');
          stopUITimer();
          fgSubscriptionRef.current?.remove();
          fgSubscriptionRef.current = null;
          await stopBackgroundLocationTask();
          await clearActiveRunState();
          router.back();
        },
      },
    ]);
  };

  const pace = distanceMeters > 0 ? elapsedSeconds / (distanceMeters / 1000) : 0;
  const polylineCoords = routePoints.map(p => ({ latitude: p.lat, longitude: p.lng }));
  const isPaused = runState === 'paused';

  const distanceDisplay = formatDistance(distanceMeters);
  const durationDisplay = formatDuration(elapsedSeconds);
  const paceDisplay = formatPace(pace);
  const pauseResumeLabel = isPaused ? 'Retomar' : 'Pausar';

  if (locationPermission === false) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <Text style={styles.permissionTitle}>Localização necessária</Text>
        <Text style={styles.permissionText}>
          Para rastrear sua corrida, permita o acesso à localização nas configurações do dispositivo.
        </Text>
        <Pressable style={styles.backButton} onPress={() => {
          console.log('[ActiveRun] back pressed from permission denied screen');
          router.back();
        }}>
          <Text style={styles.backButtonText}>Voltar</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Discard button */}
      <Pressable style={[styles.discardBtn, { top: insets.top + 12 }]} onPress={handleDiscard}>
        <X color={AppColors.textSecondary} size={22} />
      </Pressable>

      {/* Metrics panel */}
      <View style={styles.metricsPanel}>
        <Text style={styles.distanceLarge}>{distanceDisplay}</Text>
        <View style={styles.metricsRow}>
          <View style={styles.metricItem}>
            <Text style={styles.metricValue}>{durationDisplay}</Text>
            <Text style={styles.metricLabel}>tempo</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricItem}>
            <Text style={styles.metricValue}>{paceDisplay}</Text>
            <Text style={styles.metricLabel}>ritmo</Text>
          </View>
        </View>
        {isPaused && <Text style={styles.pausedLabel}>PAUSADO</Text>}
      </View>

      {/* Map */}
      <View style={styles.mapContainer}>
        <RunMap
          ref={mapRef}
          polylineCoords={polylineCoords}
          initialRegion={{
            latitude: routePoints[0]?.lat ?? -23.5505,
            longitude: routePoints[0]?.lng ?? -46.6333,
            latitudeDelta: 0.005,
            longitudeDelta: 0.005,
          }}
        />
      </View>

      {/* Controls */}
      <View style={[styles.controls, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable style={styles.pauseButton} onPress={handlePauseResume}>
          {isPaused
            ? <Play color={AppColors.textPrimary} size={24} />
            : <Pause color={AppColors.textPrimary} size={24} />}
          <Text style={styles.pauseLabel}>{pauseResumeLabel}</Text>
        </Pressable>
        <Pressable style={styles.finishButton} onPress={handleFinish}>
          <Square color={AppColors.background} size={22} fill={AppColors.background} />
          <Text style={styles.finishLabel}>Finalizar</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: AppColors.background },
  centered: { justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32, gap: 16 },
  discardBtn: { position: 'absolute', left: 16, zIndex: 10, padding: 8 },
  metricsPanel: { paddingTop: 48, paddingBottom: 20, paddingHorizontal: 24, alignItems: 'center', gap: 12 },
  distanceLarge: { fontSize: 64, fontFamily: 'SpaceMono', fontWeight: '500', color: AppColors.textPrimary, letterSpacing: -1 },
  metricsRow: { flexDirection: 'row', alignItems: 'center', gap: 24 },
  metricItem: { alignItems: 'center', gap: 2 },
  metricValue: { fontSize: 22, fontFamily: 'SpaceMono', fontWeight: '500', color: AppColors.textPrimary },
  metricLabel: { fontSize: 12, color: AppColors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.6 },
  metricDivider: { width: StyleSheet.hairlineWidth, height: 36, backgroundColor: AppColors.textSecondary + '66' },
  pausedLabel: { fontSize: 12, color: AppColors.accent, fontWeight: '600', letterSpacing: 1.5 },
  mapContainer: { flex: 1 },
  controls: { flexDirection: 'row', paddingHorizontal: 24, paddingTop: 16, gap: 12, backgroundColor: AppColors.background },
  pauseButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: 12, borderWidth: 1.5, borderColor: AppColors.textSecondary + '88' },
  pauseLabel: { fontSize: 16, fontWeight: '600', color: AppColors.textPrimary },
  finishButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: 12, backgroundColor: AppColors.accent },
  finishLabel: { fontSize: 16, fontWeight: '600', color: AppColors.background },
  permissionTitle: { fontSize: 20, fontWeight: '700', color: AppColors.textPrimary, textAlign: 'center' },
  permissionText: { fontSize: 15, color: AppColors.textSecondary, textAlign: 'center', lineHeight: 22 },
  backButton: { marginTop: 8, paddingVertical: 12, paddingHorizontal: 32, borderRadius: 10, borderWidth: 1, borderColor: AppColors.textSecondary },
  backButtonText: { fontSize: 15, color: AppColors.textPrimary },
});
