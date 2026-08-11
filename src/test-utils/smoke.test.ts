import * as SecureStore from 'expo-secure-store';

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
