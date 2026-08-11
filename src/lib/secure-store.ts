import * as SecureStore from 'expo-secure-store';

// Sole owner of this key — no other module should touch expo-secure-store directly.
const TOKEN_KEY = 'go-ride-rider-token';

export const tokenStorage = {
  get: () => SecureStore.getItemAsync(TOKEN_KEY),
  set: (token: string) => SecureStore.setItemAsync(TOKEN_KEY, token),
  clear: () => SecureStore.deleteItemAsync(TOKEN_KEY),
};
