import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
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

const RunMap = React.forwardRef<any, RunMapProps>((_props, _ref) => {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Mapa disponível apenas no dispositivo</Text>
    </View>
  );
});

RunMap.displayName = 'RunMap';
export default RunMap;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#2A2D30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: AppColors.textSecondary,
    fontSize: 14,
  },
});
