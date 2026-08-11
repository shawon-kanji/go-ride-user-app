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
