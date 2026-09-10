import React from 'react';
import { View, StyleSheet } from 'react-native';
import MapView, { Polyline, Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { Flag } from 'lucide-react-native';
import { AppColors } from '@/constants/AppColors';
import type { RoutePoint } from '@/utils/database';

interface RouteMapProps {
  routePoints: RoutePoint[];
}

export default function RouteMap({ routePoints }: RouteMapProps) {
  const polylineCoords = routePoints.map(p => ({ latitude: p.lat, longitude: p.lng }));
  const startPoint = routePoints[0];
  const endPoint = routePoints[routePoints.length - 1];
  const hasMultiplePoints = routePoints.length > 1;
  const isEndDifferent = endPoint && endPoint !== startPoint;

  let region = {
    latitude: startPoint?.lat ?? -23.5505,
    longitude: startPoint?.lng ?? -46.6333,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  };
  if (routePoints.length > 1) {
    const lats = routePoints.map(p => p.lat);
    const lngs = routePoints.map(p => p.lng);
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

  return (
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
  );
}

const styles = StyleSheet.create({
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
