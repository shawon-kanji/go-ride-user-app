// http-client.ts reads EXPO_PUBLIC_API_BASE_URL at module scope. Pin it so tests
// assert against a known base URL regardless of the developer's local .env.
process.env.EXPO_PUBLIC_API_BASE_URL = 'http://localhost:8080/api/v1';

// jest-expo's own native stub for expo-secure-store does not persist values
// between get/set calls, which every session-store test depends on.
jest.mock('expo-secure-store', () => require('./src/test-utils/expo-mocks').createSecureStoreMock());
