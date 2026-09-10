import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { StyleSheet } from 'react-native';
import WebView, { type WebViewProps } from 'react-native-webview';

export interface RunMapProps {
  polylineCoords: { latitude: number; longitude: number }[];
  initialRegion: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };
}

export interface RunMapHandle {
  animateToRegion: (
    region: { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number },
    duration?: number
  ) => void;
}

function buildHtml(
  lat: number,
  lng: number,
  zoom: number
): string {
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
    var map = L.map('map', { zoomControl: false, attributionControl: true }).setView([${lat}, ${lng}], ${zoom});
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '\\u00a9 OpenStreetMap contributors \\u00a9 CARTO',
      subdomains: 'abcd',
      maxZoom: 20
    }).addTo(map);

    var polyline = L.polyline([], { color: '#E8B923', weight: 4 }).addTo(map);

    var posMarkerIcon = L.divIcon({
      className: '',
      html: '<div style="width:12px;height:12px;border-radius:50%;background:#F5F3EF;border:2px solid #F5F3EF;"></div>',
      iconSize: [12, 12],
      iconAnchor: [6, 6]
    });
    var posMarker = null;

    window.updateRoute = function(coords) {
      var latlngs = coords.map(function(c) { return [c.latitude, c.longitude]; });
      polyline.setLatLngs(latlngs);
      if (latlngs.length > 0) {
        var last = latlngs[latlngs.length - 1];
        if (posMarker) {
          posMarker.setLatLng(last);
        } else {
          posMarker = L.marker(last, { icon: posMarkerIcon }).addTo(map);
        }
      }
    };

    window.panTo = function(lat, lng, zoom) {
      if (zoom !== undefined) {
        map.setView([lat, lng], zoom);
      } else {
        map.panTo([lat, lng]);
      }
    };
  </script>
</body>
</html>`;
}

function deltaToZoom(latitudeDelta: number): number {
  return Math.round(Math.log2(360 / latitudeDelta));
}

const RunMap = forwardRef<RunMapHandle, RunMapProps>(
  ({ polylineCoords, initialRegion }, ref) => {
    const webViewRef = useRef<WebView<WebViewProps>>(null);
    const mountedRef = useRef(false);

    useImperativeHandle(ref, () => ({
      animateToRegion(region, _duration) {
        console.log('[RunMap.android] animateToRegion called', region);
        const zoom = deltaToZoom(region.latitudeDelta);
        webViewRef.current?.injectJavaScript(
          `window.panTo(${region.latitude}, ${region.longitude}, ${zoom}); true;`
        );
      },
    }));

    // Update polyline whenever coords change (after mount)
    useEffect(() => {
      if (!mountedRef.current) return;
      console.log('[RunMap.android] polylineCoords updated, count:', polylineCoords.length);
      const coordsJson = JSON.stringify(polylineCoords);
      webViewRef.current?.injectJavaScript(
        `window.updateRoute(${coordsJson}); true;`
      );
    }, [polylineCoords]);

    const initialLat = initialRegion.latitude;
    const initialLng = initialRegion.longitude;
    const initialZoom = deltaToZoom(initialRegion.latitudeDelta);
    const html = buildHtml(initialLat, initialLng, initialZoom);

    return (
      <WebView<WebViewProps>
        ref={webViewRef}
        style={styles.map}
        originWhitelist={['*']}
        javaScriptEnabled
        source={{ html }}
        onLoad={() => {
          console.log('[RunMap.android] WebView loaded');
          mountedRef.current = true;
          if (polylineCoords.length > 0) {
            const coordsJson = JSON.stringify(polylineCoords);
            webViewRef.current?.injectJavaScript(
              `window.updateRoute(${coordsJson}); true;`
            );
          }
        }}
      />
    );
  }
);

RunMap.displayName = 'RunMap';
export default RunMap;

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
});
