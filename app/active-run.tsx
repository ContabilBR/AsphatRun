import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import RunMap from '@/components/RunMap';
import * as Location from 'expo-location';
import { Pause, Play, Square, X } from 'lucide-react-native';
import { AppColors } from '@/constants/AppColors';
import { formatDistance, formatDuration, formatPace, calcDistance } from '@/utils/runUtils';
import type { RoutePoint } from '@/utils/database';

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

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const locationSubRef = useRef<Location.LocationSubscription | null>(null);
  const lastPointRef = useRef<RoutePoint | null>(null);
  const runStateRef = useRef<RunState>('running');

  // Keep ref in sync with state
  useEffect(() => {
    runStateRef.current = runState;
  }, [runState]);

  const stopTracking = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (locationSubRef.current) locationSubRef.current.remove();
  }, []);

  const startTracking = useCallback(async () => {
    console.log('[ActiveRun] startTracking — starting timer and location watch');

    // Timer
    timerRef.current = setInterval(() => {
      if (runStateRef.current === 'running') {
        setElapsedSeconds(s => s + 1);
      }
    }, 1000);

    // Location
    locationSubRef.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 5000,
        distanceInterval: 5,
      },
      (loc) => {
        if (runStateRef.current !== 'running') return;
        const point: RoutePoint = {
          lat: loc.coords.latitude,
          lng: loc.coords.longitude,
          timestamp: loc.timestamp,
        };
        console.log('[ActiveRun] location update', { lat: point.lat, lng: point.lng });
        setRoutePoints(prev => [...prev, point]);
        if (lastPointRef.current) {
          const d = calcDistance(
            lastPointRef.current.lat, lastPointRef.current.lng,
            point.lat, point.lng
          );
          console.log('[ActiveRun] distance delta', d.toFixed(1), 'm');
          setDistanceMeters(prev => prev + d);
        }
        lastPointRef.current = point;

        // Pan map to current position
        mapRef.current?.animateToRegion({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        }, 500);
      }
    );
  }, []);

  // Request permissions and start tracking
  useEffect(() => {
    (async () => {
      console.log('[ActiveRun] requesting foreground location permission');
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.log('[ActiveRun] location permission denied');
        setLocationPermission(false);
        return;
      }
      console.log('[ActiveRun] location permission granted');
      setLocationPermission(true);
      startTracking();
    })();

    return () => {
      stopTracking();
    };
  }, []);

  const handlePauseResume = () => {
    const next = runState === 'running' ? 'paused' : 'running';
    console.log('[ActiveRun] pause/resume pressed — new state:', next);
    setRunState(next);
  };

  const handleFinish = () => {
    console.log('[ActiveRun] finish pressed — duration:', elapsedSeconds, 's, distance:', distanceMeters.toFixed(1), 'm');
    stopTracking();
    const avgPace = distanceMeters > 0 ? (elapsedSeconds / (distanceMeters / 1000)) : 0;
    router.replace({
      pathname: '/run-detail',
      params: {
        mode: 'post-run',
        duration_seconds: String(elapsedSeconds),
        distance_meters: String(distanceMeters),
        avg_pace_seconds_per_km: String(avgPace),
        route_points: JSON.stringify(routePoints),
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
        onPress: () => {
          console.log('[ActiveRun] discard confirmed — going back');
          stopTracking();
          router.back();
        },
      },
    ]);
  };

  const pace = distanceMeters > 0 ? elapsedSeconds / (distanceMeters / 1000) : 0;
  const polylineCoords = routePoints.map(p => ({ latitude: p.lat, longitude: p.lng }));

  const distanceDisplay = formatDistance(distanceMeters);
  const durationDisplay = formatDuration(elapsedSeconds);
  const paceDisplay = formatPace(pace);
  const isPaused = runState === 'paused';

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
      {/* Discard button top-left */}
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
        {isPaused && (
          <Text style={styles.pausedLabel}>PAUSADO</Text>
        )}
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
          <Text style={styles.pauseLabel}>{isPaused ? 'Retomar' : 'Pausar'}</Text>
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
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  discardBtn: {
    position: 'absolute',
    left: 16,
    zIndex: 10,
    padding: 8,
  },
  metricsPanel: {
    paddingTop: 48,
    paddingBottom: 20,
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 12,
  },
  distanceLarge: {
    fontSize: 64,
    fontFamily: 'SpaceMono',
    fontWeight: '500',
    color: AppColors.textPrimary,
    letterSpacing: -1,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
  },
  metricItem: {
    alignItems: 'center',
    gap: 2,
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
    letterSpacing: 0.6,
  },
  metricDivider: {
    width: StyleSheet.hairlineWidth,
    height: 36,
    backgroundColor: AppColors.textSecondary + '66',
  },
  pausedLabel: {
    fontSize: 12,
    color: AppColors.accent,
    fontWeight: '600',
    letterSpacing: 1.5,
  },
  mapContainer: {
    flex: 1,
  },
  controls: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingTop: 16,
    gap: 12,
    backgroundColor: AppColors.background,
  },
  pauseButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: AppColors.textSecondary + '88',
  },
  pauseLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: AppColors.textPrimary,
  },
  finishButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: AppColors.accent,
  },
  finishLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: AppColors.background,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: AppColors.textPrimary,
    textAlign: 'center',
  },
  permissionText: {
    fontSize: 15,
    color: AppColors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  backButton: {
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: AppColors.textSecondary,
  },
  backButtonText: {
    fontSize: 15,
    color: AppColors.textPrimary,
  },
});
