import React from 'react';
import { StyleSheet } from 'react-native';
import WebView from 'react-native-webview';
import type { RoutePoint } from '@/utils/database';

interface RouteMapProps {
  routePoints: RoutePoint[];
}

function buildHtml(routePoints: RoutePoint[]): string {
  const coords = routePoints.map(p => ({ lat: p.lat, lng: p.lng }));
  const coordsJson = JSON.stringify(coords);

  const fallbackLat = -23.5505;
  const fallbackLng = -46.6333;
  const fallbackZoom = 15;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    html, body, #map { margin: 0; padding: 0; width: 100%; height: 100%; background: #1C1F22; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var routeCoords = ${coordsJson};

    var map = L.map('map', {
      dragging: false,
      zoomControl: false,
      scrollWheelZoom: false,
      attributionControl: true
    }).setView([${fallbackLat}, ${fallbackLng}], ${fallbackZoom});

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '\\u00a9 OpenStreetMap contributors \\u00a9 CARTO',
      subdomains: 'abcd',
      maxZoom: 20
    }).addTo(map);

    if (routeCoords.length === 0) {
      map.setView([${fallbackLat}, ${fallbackLng}], ${fallbackZoom});
    } else if (routeCoords.length === 1) {
      map.setView([routeCoords[0].lat, routeCoords[0].lng], ${fallbackZoom});
    } else {
      var latlngs = routeCoords.map(function(c) { return [c.lat, c.lng]; });
      var polyline = L.polyline(latlngs, { color: '#E8B923', weight: 4 }).addTo(map);
      map.fitBounds(polyline.getBounds(), { padding: [24, 24] });

      // Start marker — hollow circle
      var startIcon = L.divIcon({
        className: '',
        html: '<div style="width:14px;height:14px;border-radius:50%;background:transparent;border:2.5px solid #F5F3EF;box-sizing:border-box;"></div>',
        iconSize: [14, 14],
        iconAnchor: [7, 7]
      });
      L.marker([routeCoords[0].lat, routeCoords[0].lng], { icon: startIcon }).addTo(map);

      // End marker — filled circle (only if start !== end)
      var last = routeCoords[routeCoords.length - 1];
      var isDifferent = last.lat !== routeCoords[0].lat || last.lng !== routeCoords[0].lng;
      if (isDifferent) {
        var endIcon = L.divIcon({
          className: '',
          html: '<div style="width:14px;height:14px;border-radius:50%;background:#F5F3EF;border:2px solid #F5F3EF;box-sizing:border-box;"></div>',
          iconSize: [14, 14],
          iconAnchor: [7, 7]
        });
        L.marker([last.lat, last.lng], { icon: endIcon }).addTo(map);
      }
    }
  </script>
</body>
</html>`;
}

export default function RouteMap({ routePoints }: RouteMapProps) {
  console.log('[RouteMap.android] rendering with', routePoints.length, 'points');
  const html = buildHtml(routePoints);

  return (
    <WebView
      style={styles.map}
      originWhitelist={['*']}
      javaScriptEnabled
      source={{ html }}
      onLoad={() => {
        console.log('[RouteMap.android] WebView loaded');
      }}
    />
  );
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
});
