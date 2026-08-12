import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import * as Crypto from 'expo-crypto';

/**
 * TEMPORARY Wave 0 smoke screen — deleted in plan 02-07.
 * Answers three questions on real hardware in one render:
 *   1. Does react-native-maps@1.27.2 render under RN 0.86.2's New Architecture (Fabric)?
 *      -> 02-RESEARCH.md Pitfall 2 / Open Question 1
 *   2. Is expo-crypto's native module linked after the prebuild? -> Pitfall 1
 *   3. Is expo-location's native module linked and does the permission dialog appear? -> Pitfall 1
 * initialRegion (not region) per 02-RESEARCH.md Pattern 1 — uncontrolled viewport so pan/zoom works.
 */
const SMOKE_REGION = {
  latitude: 23.7808,
  longitude: 90.4074,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

export function MapSmokeTest() {
  const [uuid, setUuid] = useState<string>('(not run)');
  const [permission, setPermission] = useState<string>('(not run)');
  const [gps, setGps] = useState<string>('(not run)');

  useEffect(() => {
    try {
      setUuid(Crypto.randomUUID());
    } catch (e) {
      setUuid(`CRYPTO FAILED: ${String(e)}`);
    }

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        setPermission(status);
        if (status !== 'granted') {
          setGps('(skipped — not granted)');
          return;
        }
        const loc = await Location.getCurrentPositionAsync({});
        setGps(`${loc.coords.latitude.toFixed(4)}, ${loc.coords.longitude.toFixed(4)}`);
      } catch (e) {
        setPermission(`LOCATION FAILED: ${String(e)}`);
      }
    })();
  }, []);

  return (
    <View className="flex-1">
      <MapView
        provider={PROVIDER_GOOGLE}
        style={{ flex: 1 }}
        initialRegion={SMOKE_REGION}
        testID="smoke-map"
      >
        <Marker
          coordinate={{ latitude: SMOKE_REGION.latitude, longitude: SMOKE_REGION.longitude }}
          testID="smoke-marker"
        />
      </MapView>

      <View className="bg-white px-4 py-3">
        <Text className="text-sm font-semibold text-neutral-900">Wave 0 native smoke test</Text>
        <Text className="mt-1 text-xs text-neutral-700">expo-crypto randomUUID: {uuid}</Text>
        <Text className="text-xs text-neutral-700">location permission: {permission}</Text>
        <Text className="text-xs text-neutral-700">GPS coords: {gps}</Text>
      </View>
    </View>
  );
}
