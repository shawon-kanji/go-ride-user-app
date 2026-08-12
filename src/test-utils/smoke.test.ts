import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import * as Location from 'expo-location';

describe('test infrastructure', () => {
  it('runs under the jest-expo/android preset', () => {
    expect(1 + 1).toBe(2);
  });

  it('exposes an expo-secure-store async API that round-trips a value', async () => {
    await SecureStore.setItemAsync('smoke-key', 'smoke-value');
    await expect(SecureStore.getItemAsync('smoke-key')).resolves.toBe('smoke-value');
    await SecureStore.deleteItemAsync('smoke-key');
    await expect(SecureStore.getItemAsync('smoke-key')).resolves.toBeNull();
  });
});

describe('expo-crypto mock', () => {
  it('randomUUID() returns a non-empty string matching the UUID shape', () => {
    const id = Crypto.randomUUID();
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('two successive randomUUID() calls return different strings', () => {
    const first = Crypto.randomUUID();
    const second = Crypto.randomUUID();
    expect(first).not.toBe(second);
  });
});

describe('expo-location mock', () => {
  it('requestForegroundPermissionsAsync() resolves to status "granted", not undefined', async () => {
    const result = await Location.requestForegroundPermissionsAsync();
    expect(result.status).not.toBeUndefined();
    expect(result.status).toBe('granted');
  });

  it('getCurrentPositionAsync({}) resolves to numeric coords', async () => {
    const result = await Location.getCurrentPositionAsync({});
    expect(typeof result.coords.latitude).toBe('number');
    expect(typeof result.coords.longitude).toBe('number');
  });

  it('allows a per-test mockResolvedValueOnce override that reverts on the next call', async () => {
    const first = await Location.requestForegroundPermissionsAsync();
    expect(first.status).toBe('granted');

    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValueOnce({
      status: 'denied',
      canAskAgain: false,
      granted: false,
    });
    const second = await Location.requestForegroundPermissionsAsync();
    expect(second.status).toBe('denied');

    const third = await Location.requestForegroundPermissionsAsync();
    expect(third.status).toBe('granted');
  });
});
