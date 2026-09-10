import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AppColors } from '@/constants/AppColors';
import type { RoutePoint } from '@/utils/database';

interface RouteMapProps {
  routePoints: RoutePoint[];
}

export default function RouteMap({ routePoints: _routePoints }: RouteMapProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Mapa disponível apenas no dispositivo</Text>
    </View>
  );
}

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
