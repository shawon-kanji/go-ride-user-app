---
phase: 01-foundation-auth
plan: 02
subsystem: testing
tags: [jest, jest-expo, react-native-testing-library, react-query, typescript, nativewind]

# Dependency graph
requires:
  - phase: 01-foundation-auth (plan 01-01)
    provides: Expo SDK 57 scaffold, locked dependency set, tailwind.config.js already wired to src/theme/colors.js
provides:
  - Jest + jest-expo/android + React Native Testing Library test infrastructure, `npm test` green
  - src/test-utils/expo-mocks.ts createSecureStoreMock() registered globally, proven by a passing round-trip test
  - src/test-utils/query-wrapper.tsx (createTestQueryClient/createQueryWrapper, gcTime 0 on queries AND mutations)
  - src/test-utils/auth-fixtures.ts (makeUser/makeJwt/makeLoginResult) plus a test proving makeJwt's base64url payload decodes correctly
  - src/api/types.ts rider DTO contracts (2-value AccountStatus, no is-email-verified field, no shared response envelope)
  - src/theme/* and src/components/* (Badge, Banner, Button, Card, ConfirmDialog, EmptyState, Select, Stepper, TextInput) copied verbatim from go-ride-driver-app
affects: [01-03, 01-04, 01-05, 01-06, 01-07, 01-08]

# Tech tracking
tech-stack:
  added: [jest@~29.7.0, jest-expo@~57.0.4, "@react-native/jest-preset@^0.86.2", "@testing-library/react-native@^14.0.1", test-renderer@^1.2.0, "@types/jest"]
  patterns: ["jest.setup.js pins EXPO_PUBLIC_API_BASE_URL and globally mocks expo-secure-store via jest.mock", "test-utils fixtures builders (makeX) mirroring driver app's KYC-fixtures style", "hand-maintained DTO mirror in src/api/types.ts kept in sync with go-ride-backend Go structs, no codegen"]

key-files:
  created:
    - jest.config.js
    - jest.setup.js
    - src/test-utils/smoke.test.ts
    - src/test-utils/expo-mocks.ts
    - src/test-utils/query-wrapper.tsx
    - src/test-utils/auth-fixtures.ts
    - src/test-utils/auth-fixtures.test.ts
    - src/api/types.ts
    - src/theme/colors.js, src/theme/radii.ts, src/theme/spacing.ts, src/theme/tokens.ts
    - src/components/Badge.tsx, Banner.tsx, Button.tsx, Card.tsx, ConfirmDialog.tsx, EmptyState.tsx, Select.tsx, Stepper.tsx, TextInput.tsx
  modified:
    - package.json (added test script, resolved jest/jest-expo devDependency pins)

key-decisions:
  - "jest-expo/android's native expo-secure-store stub does not persist values between setItemAsync/getItemAsync calls, so an explicit in-memory createSecureStoreMock() is registered globally from jest.setup.js — required for AUTH-02's session-store tests to be trustworthy"
  - "Reworded two comments in src/api/types.ts (previously containing the literal substrings 'is_email_verified' and quoted 'pending') because the plan's own acceptance-criteria grep checks forbid those substrings anywhere in the file, including comments — the plan's literal code block and its verify script were mutually inconsistent"

patterns-established:
  - "Wave 0 test infrastructure: jest.config.js -> jest.setup.js -> src/test-utils/{expo-mocks,query-wrapper,auth-fixtures}.ts is the fixed foundation every feature-logic plan (01-03+) builds test suites on top of"

requirements-completed: []

# Metrics
duration: 10min
completed: 2026-08-11
---

# Phase 01 Plan 02: Wave 0 Test Infrastructure & Theme Summary

**Jest + jest-expo/android + RNTL installed with a proven in-memory expo-secure-store mock, rider DTO type contracts written against the real go-ride-backend Go structs, and 13 theme/component files copied byte-identical from go-ride-driver-app.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-08-11T19:2x+08:00
- **Completed:** 2026-08-11T19:32:17+08:00
- **Tasks:** 3 completed
- **Files modified:** 19 created/modified (excluding package-lock.json)

## Accomplishments
- `npm test` runs green (3 tests, 2 suites) and Jest exits cleanly on its own — no `--forceExit` needed
- Proved via a failing-then-passing smoke test that `jest-expo/android`'s native `expo-secure-store` stub does NOT persist values, and shipped the explicit `createSecureStoreMock()` fix that every later session-store test depends on
- `src/api/types.ts` written as a rider-specific mirror of `go-ride-backend`'s Go DTOs, deliberately diverging from the driver app's 3-value `AccountStatus` and `is_email_verified` field
- 13 theme/component files copied byte-identical from `go-ride-driver-app`, `npx tsc --noEmit` passes

## Task Commits

Each task was committed atomically:

1. **Task 1: Install Jest + RNTL, write jest.config.js, and prove the expo-secure-store mock works** - `1486cb5` (feat)
2. **Task 2: Copy theme tokens and generic UI components verbatim from go-ride-driver-app** - `3826e2c` (feat)
3. **Task 3: Write rider API type contracts and shared test-utils** - `2530562` (feat)

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified
- `jest.config.js` - jest-expo/android preset + setupFiles wiring to jest.setup.js
- `jest.setup.js` - pins EXPO_PUBLIC_API_BASE_URL, globally mocks expo-secure-store
- `src/test-utils/smoke.test.ts` - proves the preset + SecureStore mock behavior
- `src/test-utils/expo-mocks.ts` - `createSecureStoreMock()` in-memory factory
- `src/test-utils/query-wrapper.tsx` - `createTestQueryClient`/`createQueryWrapper`, byte-identical to driver app
- `src/test-utils/auth-fixtures.ts` - `makeUser`/`makeJwt`/`makeLoginResult` rider fixtures
- `src/test-utils/auth-fixtures.test.ts` - proves `makeJwt`'s payload decodes correctly
- `src/api/types.ts` - rider DTO contracts (`AccountStatus`, `User`, `SignupPayload`, `LoginPayload`, `LoginResult`, `UpdateProfilePayload`, `ChangePasswordPayload`, `ApiErrorBody`)
- `src/theme/{colors.js,radii.ts,spacing.ts,tokens.ts}` - copied verbatim from driver app
- `src/components/{Badge,Banner,Button,Card,ConfirmDialog,EmptyState,Select,Stepper,TextInput}.tsx` - copied verbatim from driver app
- `package.json` - added `"test": "jest --watchAll=false"` script

## Decisions Made
- Kept `jest: ~29.7.0` and `jest-expo: ~57.0.4` as resolved by `npx expo install` — already on the required 29.x line, no override needed
- Registered `createSecureStoreMock()` globally via `jest.mock` in `jest.setup.js` rather than per-test, since every session-store/auth test in 01-03+ needs it and the smoke test proved the native stub is not usable as-is

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Reworded comments in src/api/types.ts to satisfy the plan's own verification script**
- **Found during:** Task 3
- **Issue:** The plan's exact code block for `src/api/types.ts` includes explanatory comments containing the literal substrings `is_email_verified` and `'pending'` (documenting what fields/values are deliberately excluded), but the plan's own acceptance criteria and automated verify command assert `! grep -q "is_email_verified"` and `! grep -q "'pending'"` against the whole file — a contradiction between the plan's literal content and its own check.
- **Fix:** Reworded the two comments to describe the same exclusions without using the literal forbidden substrings (e.g. "No email-verification flag" instead of "No is_email_verified", "three-value status union" instead of quoting `'pending' | 'active' | 'blocked'`). Type contract content (the actual `AccountStatus` union, `User` interface fields, etc.) is unchanged from the plan.
- **Files modified:** src/api/types.ts
- **Verification:** `grep -c "is_email_verified\|'pending'\|'blocked'" src/api/types.ts` returns 0; `npx tsc --noEmit` and `npm test` still pass
- **Committed in:** 2530562 (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 bug/plan-inconsistency fix)
**Impact on plan:** Cosmetic comment change only; no change to exported types or runtime behavior. No scope creep.

## Issues Encountered
- `jest-expo/android`'s bundled `expo-secure-store` native stub does not persist values between `setItemAsync`/`getItemAsync` calls (confirmed by the smoke test's second assertion failing before the fix). Resolved per the plan's own documented branch: added `src/test-utils/expo-mocks.ts` with `createSecureStoreMock()` and registered it globally via `jest.mock` in `jest.setup.js`. This is the expected/planned-for outcome, not a surprise — `01-VALIDATION.md` and the plan both anticipated this branch.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Every Wave 0 marker in `01-VALIDATION.md`'s Per-Task Verification Map for 01-02 is now satisfied; `wave_0_complete: true` set in that file's frontmatter and the Wave 0 Requirements checklist items are checked off
- `01-03` (JWT expiry decoder, secure token storage, Zustand session store, apiRequest, typed rider clients) can now write tests against a working `expo-secure-store` mock and the fixed `src/api/types.ts` contract without further infrastructure work
- No blockers or concerns carried forward

---
*Phase: 01-foundation-auth*
*Completed: 2026-08-11*

## Self-Check: PASSED

All 21 created/modified files confirmed present on disk; all 3 task commits (1486cb5, 3826e2c, 2530562) confirmed in git log.
