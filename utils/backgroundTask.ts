import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { appendActiveRunPoint, getActiveRunValue, setActiveRunValue } from './database';
import { calcDistance } from './runUtils';
import type { RoutePoint } from './database';

export const BACKGROUND_LOCATION_TASK = 'ASPHALT_RUN_BACKGROUND_LOCATION';

TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }: any) => {
  if (error) {
    console.log('[BGTask] error:', error.message);
    return;
  }
  if (!data) return;

  const { locations } = data as { locations: Location.LocationObject[] };
  if (!locations || locations.length === 0) return;

  console.log('[BGTask] received', locations.length, 'location(s)');

  // Check if run is paused — don't record points while paused
  const pausedVal = await getActiveRunValue('is_paused');
  if (pausedVal === 'true') {
    console.log('[BGTask] run is paused, skipping location update');
    return;
  }

  for (const loc of locations) {
    const point: RoutePoint = {
      lat: loc.coords.latitude,
      lng: loc.coords.longitude,
      timestamp: loc.timestamp,
    };

    console.log('[BGTask] recording point', { lat: point.lat, lng: point.lng });

    // Get last point to accumulate distance
    const lastPointStr = await getActiveRunValue('last_point');
    if (lastPointStr) {
      const lastPoint: RoutePoint = JSON.parse(lastPointStr);
      const d = calcDistance(lastPoint.lat, lastPoint.lng, point.lat, point.lng);
      const currentDistStr = await getActiveRunValue('distance_meters');
      const currentDist = currentDistStr ? parseFloat(currentDistStr) : 0;
      const newDist = currentDist + d;
      console.log('[BGTask] distance delta', d.toFixed(1), 'm, total', newDist.toFixed(1), 'm');
      await setActiveRunValue('distance_meters', String(newDist));
    }

    await appendActiveRunPoint(point);
    await setActiveRunValue('last_point', JSON.stringify(point));
  }
});

export async function startBackgroundLocationTask(): Promise<void> {
  console.log('[BGTask] startBackgroundLocationTask called');
  const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
  if (isRegistered) {
    console.log('[BGTask] task already registered, skipping start');
    return;
  }

  await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
    accuracy: Location.Accuracy.BestForNavigation,
    timeInterval: 5000,
    distanceInterval: 5,
    showsBackgroundLocationIndicator: true, // iOS blue bar
    foregroundService: {
      notificationTitle: 'Asphalt Run',
      notificationBody: 'Rastreando sua corrida...',
      notificationColor: '#E8B923',
    },
    pausesUpdatesAutomatically: false,
  });
  console.log('[BGTask] background location task started');
}

export async function stopBackgroundLocationTask(): Promise<void> {
  console.log('[BGTask] stopBackgroundLocationTask called');
  const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
  if (isRegistered) {
    await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    console.log('[BGTask] background location task stopped');
  } else {
    console.log('[BGTask] task was not registered, nothing to stop');
  }
}
