import * as SecureStore from 'expo-secure-store';

import { tokenStorage } from './secure-store';

describe('tokenStorage', () => {
  it('set() then get() round-trips the token', async () => {
    await tokenStorage.set('abc');
    await expect(tokenStorage.get()).resolves.toBe('abc');
  });

  it('clear() then get() resolves to null', async () => {
    await tokenStorage.set('abc');
    await tokenStorage.clear();
    await expect(tokenStorage.get()).resolves.toBeNull();
  });

  it('uses the exact rider-specific SecureStore key', async () => {
    await tokenStorage.set('abc');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockSetItemAsync = SecureStore.setItemAsync as unknown as jest.Mock;
    expect(mockSetItemAsync).toHaveBeenCalledWith('go-ride-rider-token', 'abc');
    expect(mockSetItemAsync).not.toHaveBeenCalledWith('go-ride-driver-token', expect.anything());
  });
});
