---
phase: 02-fare-estimate-booking
plan: 01
subsystem: testing
tags: [expo-location, expo-crypto, react-native-maps, jest, jest-expo, config-plugin]

# Dependency graph
requires:
  - phase: 01-foundation-auth
    provides: jest-expo/android test harness, createSecureStoreMock pattern in src/test-utils/expo-mocks.ts, physical-device LAN-IP env convention
provides:
  - expo-location and expo-crypto installed at SDK-57-pinned versions (~57.0.9 / 57.0.1)
  - expo-location registered as a bare-string Expo config plugin in app.config.js
  - EXPO_PUBLIC_CAB_API_BASE_URL (cab-request-handler, port 8082, /api/v1/cab) in .env, .env.example, jest.setup.js
  - createCryptoMock() and createLocationMock() in src/test-utils/expo-mocks.ts, registered globally in jest.setup.js
  - root-level __mocks__/react-native-maps.js manual mock (MapView/Marker/Polyline forward props onto View)
affects: [02-02 (native prebuild), 02-03 (cab-client.ts base URL), 02-04 (idempotency-key UUID mock), 02-06 (LocationPickerMap tests)]

# Tech tracking
tech-stack:
  added: [expo-location@57.0.9, expo-crypto@57.0.1]
  patterns:
    - "Root-level __mocks__/<package>.js manual Jest mock auto-applies with no per-test jest.mock() call"
    - "Global jest.setup.js mock registration for native modules with realistic default resolved values, overridden per-test via mockResolvedValueOnce"

key-files:
  created:
    - __mocks__/react-native-maps.js
    - src/test-utils/maps-mock.test.tsx
  modified:
    - package.json
    - app.config.js
    - .env
    - .env.example
    - jest.setup.js
    - src/test-utils/expo-mocks.ts
    - src/test-utils/smoke.test.ts

key-decisions:
  - "expo-location registered as a bare string plugin entry (default Android permission set only) — no background location, no custom rationale string, per 02-CONTEXT.md"
  - "expo-crypto has no config plugin and was NOT added to app.config.js plugins — autolinking alone suffices"
  - "npx expo install (not hand-pinned versions) used to resolve SDK-57-correct package versions"

patterns-established:
  - "Deterministic, per-test-overridable Jest mocks for expo-location and expo-crypto registered globally in jest.setup.js, mirroring the existing createSecureStoreMock pattern"
  - "react-native-maps manual mock at project root forwards all props to a plain RN View so tests read back props via screen.getByTestId(...).props.* and trigger onPress with fireEvent"

requirements-completed: [RIDE-01, RIDE-02]

# Metrics
duration: 5min
completed: 2026-08-12
---

# Phase 02 Plan 01: Native Dependencies & Test Mock Infrastructure Summary

**Installed expo-location@57.0.9 and expo-crypto@57.0.1, registered expo-location as a config plugin, added the cab-service base URL, and closed all three test-infrastructure pitfalls (jest-expo's silent expo-location undefined auto-mock, expo-crypto's total absence from jest-expo, and react-native-maps' unmocked native components) with deterministic, proven mocks.**

## Performance

- **Duration:** ~5 min
- **Completed:** 2026-08-12
- **Tasks:** 3
- **Files modified:** 9 (7 modified, 2 created)

## Accomplishments
- `expo-location` (~57.0.9) and `expo-crypto` (57.0.1) installed via `npx expo install`, both resolving cleanly with no `UNMET DEPENDENCY`
- `expo-location` registered in `app.config.js`'s `plugins` array (bare string form); `expo-crypto` deliberately excluded (no config plugin)
- `EXPO_PUBLIC_CAB_API_BASE_URL` added to `.env` (`http://192.168.100.136:8082/api/v1/cab`), `.env.example` (`http://10.0.2.2:8082/api/v1/cab`), and `jest.setup.js` (`http://localhost:8082/api/v1/cab`)
- `createCryptoMock()` (counter-based `randomUUID()`, distinct string per call) and `createLocationMock()` (granted-path `requestForegroundPermissionsAsync`/`getCurrentPositionAsync` defaults, per-test overridable) added to `src/test-utils/expo-mocks.ts` and registered globally in `jest.setup.js`
- Root-level `__mocks__/react-native-maps.js` manual mock created — `MapView`/`Marker`/`Polyline` forward all props onto a plain RN `View`, `PROVIDER_GOOGLE` exported as `'google'`
- Five new smoke tests in `src/test-utils/smoke.test.ts` prove the crypto and location mocks; four new tests in `src/test-utils/maps-mock.test.tsx` prove the maps mock (prop readback, children, `onPress` dispatch, `PROVIDER_GOOGLE` export)

## Task Commits

Each task was committed atomically:

1. **Task 1: Install expo-location + expo-crypto, register config plugin, add cab-service base URL** - `a99f673` (feat)
2. **Task 2: Deterministic expo-crypto and expo-location Jest mocks** - `2901a5a` (test, RED) → `f49f82a` (feat, GREEN)
3. **Task 3: Hand-written react-native-maps Jest mock** - `c550c44` (test, RED) → `7ba8d23` (feat, GREEN)

**Plan metadata:** pending (this commit)

_Note: TDD tasks (2, 3) each have a RED test commit followed by a GREEN implementation commit._

## Files Created/Modified
- `package.json` / `package-lock.json` - added `expo-location`, `expo-crypto` dependencies
- `app.config.js` - `expo-location` added to `plugins` array
- `.env` - added `EXPO_PUBLIC_CAB_API_BASE_URL` (gitignored, not committed)
- `.env.example` - added `EXPO_PUBLIC_CAB_API_BASE_URL` with explanatory comment
- `jest.setup.js` - pinned `EXPO_PUBLIC_CAB_API_BASE_URL`, registered `jest.mock('expo-crypto', ...)` and `jest.mock('expo-location', ...)`
- `src/test-utils/expo-mocks.ts` - added `createCryptoMock`, `createLocationMock`, `MOCK_GPS_COORDINATE` (kept `createSecureStoreMock` unchanged)
- `src/test-utils/smoke.test.ts` - added `expo-crypto mock` and `expo-location mock` describe blocks (5 new tests)
- `__mocks__/react-native-maps.js` (new) - manual Jest mock for `react-native-maps`
- `src/test-utils/maps-mock.test.tsx` (new) - 4 tests proving the maps mock works

## Decisions Made
- Let `npx expo install` resolve exact SDK-57-compatible versions rather than hand-pinning, per plan instructions — resolved to `expo-location@57.0.9`, `expo-crypto@57.0.1`
- `expo-crypto` intentionally excluded from `app.config.js` `plugins` (ships no config plugin; autolinking is sufficient)
- Cab-service base URL reuses the existing LAN host from `EXPO_PUBLIC_API_BASE_URL`, differing only in port (8082) and path suffix (`/api/v1/cab`)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. Both TDD tasks followed RED→GREEN exactly as specified: new tests were run and confirmed failing (crypto mock: `Cannot read properties of undefined`; location mock: `result.status` reads `undefined`; maps mock: `TurboModuleRegistry.getEnforcing(...): 'RNMapsAirModule' could not be found`) before the corresponding implementation was added.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Full suite baseline after 02-01: 14 suites / 81 tests** (`npm test` exit 0), up from Phase 1's baseline of 13 suites / 72 tests. `npx tsc --noEmit` exits 0.
- Registering `jest.mock('expo-location', ...)` as a global default in `jest.setup.js` caused **no change** to any pre-existing Phase 1 test — the full 72-test Phase 1 baseline still passes unmodified, confirming nothing in Phase 1 imports `expo-location`.
- All three of `02-RESEARCH.md`'s test-infrastructure pitfalls (4: expo-location silent undefined, 5: expo-crypto not mocked at all, 6: react-native-maps unmocked) are closed with passing proof tests, not assumptions.
- No native rebuild (`expo prebuild` / `expo run:android`) was attempted in this plan, as specified — that risk is isolated to plan 02-02.
- Plan 02-02 can now proceed to the native prebuild step with both new native modules already JS-installed and plugin-registered.
- Plan 02-03 (`cab-client.ts`) can rely on `EXPO_PUBLIC_CAB_API_BASE_URL` being defined in `.env`/`.env.example`/`jest.setup.js`.

---
*Phase: 02-fare-estimate-booking*
*Completed: 2026-08-12*

## Self-Check: PASSED

All created/modified files verified present on disk; all 5 task commits (`a99f673`, `2901a5a`, `f49f82a`, `c550c44`, `7ba8d23`) verified present in git history.
