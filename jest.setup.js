// http-client.ts reads EXPO_PUBLIC_API_BASE_URL at module scope. Pin it so tests
// assert against a known base URL regardless of the developer's local .env.
process.env.EXPO_PUBLIC_API_BASE_URL = 'http://localhost:8080/api/v1';

// cab-client.ts reads EXPO_PUBLIC_CAB_API_BASE_URL at module scope. Different service,
// different port (8082) than go-ride-backend — see 02-RESEARCH.md Pitfall 3.
process.env.EXPO_PUBLIC_CAB_API_BASE_URL = 'http://localhost:8082/api/v1/cab';

// jest-expo's own native stub for expo-secure-store does not persist values
// between get/set calls, which every session-store test depends on.
jest.mock('expo-secure-store', () => require('./src/test-utils/expo-mocks').createSecureStoreMock());

// expo-crypto has NO jest-expo auto-mock at all (02-RESEARCH.md Pitfall 5).
jest.mock('expo-crypto', () => require('./src/test-utils/expo-mocks').createCryptoMock());

// jest-expo's ExpoLocation auto-mock resolves every method to `undefined`, which reads
// as "permission denied" forever (02-RESEARCH.md Pitfall 4). Register a granted-path
// default globally; individual tests override per case with mockResolvedValueOnce.
jest.mock('expo-location', () => require('./src/test-utils/expo-mocks').createLocationMock());
