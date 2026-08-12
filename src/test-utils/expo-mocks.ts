/** In-memory stand-in for expo-secure-store's async API. jest-expo's own native
 *  stub does not persist values between get/set, which every session-store test
 *  depends on. Registered globally from jest.setup.js. */
export function createSecureStoreMock() {
  const store = new Map<string, string>();
  return {
    __store: store,
    setItemAsync: jest.fn(async (k: string, v: string) => { store.set(k, v); }),
    getItemAsync: jest.fn(async (k: string) => (store.has(k) ? store.get(k)! : null)),
    deleteItemAsync: jest.fn(async (k: string) => { store.delete(k); }),
  };
}

/** expo-crypto is NOT in jest-expo's auto-mock list at all (only ExpoCryptoAES is) —
 *  calling the real randomUUID() under Jest throws a native-module-resolution error.
 *  See .planning/phases/02-fare-estimate-booking/02-RESEARCH.md Pitfall 5.
 *  Counter-based so successive calls differ, which the idempotency-key tests rely on. */
export function createCryptoMock() {
  let counter = 0;
  return {
    randomUUID: jest.fn(() => {
      counter += 1;
      return `00000000-0000-4000-8000-${String(counter).padStart(12, '0')}`;
    }),
  };
}

/** jest-expo DOES auto-mock ExpoLocation, but every method resolves to `undefined`,
 *  so `const {status} = await requestForegroundPermissionsAsync()` yields
 *  `status === undefined` — falsy but never 'granted', silently exercising only the
 *  denied branch. See 02-RESEARCH.md Pitfall 4. This mock supplies realistic
 *  granted-path defaults; individual tests override with mockResolvedValueOnce. */
export const MOCK_GPS_COORDINATE = { latitude: 23.7808, longitude: 90.4074 };

export function createLocationMock() {
  return {
    requestForegroundPermissionsAsync: jest.fn(async () => ({
      status: 'granted',
      granted: true,
      canAskAgain: true,
      expires: 'never',
    })),
    getCurrentPositionAsync: jest.fn(async () => ({
      coords: {
        latitude: MOCK_GPS_COORDINATE.latitude,
        longitude: MOCK_GPS_COORDINATE.longitude,
        altitude: null,
        accuracy: 5,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
      },
      timestamp: 1_700_000_000_000,
    })),
  };
}
