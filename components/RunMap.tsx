import React, { forwardRef } from 'react';
import { StyleSheet } from 'react-native';
import MapView, { Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import { AppColors } from '@/constants/AppColors';

export interface RunMapProps {
  polylineCoords: { latitude: number; longitude: number }[];
  initialRegion: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };
}

const RunMap = forwardRef<MapView, RunMapProps>(({ polylineCoords, initialRegion }, ref) => {
  return (
    <MapView
      ref={ref}
      style={StyleSheet.absoluteFillObject}
      provider={PROVIDER_DEFAULT}
      userInterfaceStyle="dark"
      showsUserLocation
      followsUserLocation={false}
      initialRegion={initialRegion}
    >
      {polylineCoords.length > 1 && (
        <Polyline
          coordinates={polylineCoords}
          strokeColor={AppColors.accent}
          strokeWidth={4}
        />
      )}
    </MapView>
  );
});

RunMap.displayName = 'RunMap';
export default RunMap;
