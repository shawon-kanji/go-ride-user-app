---
phase: 01-foundation-auth
plan: 05
subsystem: auth
tags: [expo-router, zustand, react-query, jest, react-native-testing-library]

requires:
  - phase: 01-foundation-auth
    provides: session-store (status/tokenExpiresAt/hydrate) from 01-03, login/signup mutations and (auth) route group from 01-04
provides:
  - SessionExpiryBanner — 5-minute pre-expiry countdown warning, dismissible, resets on token change (AUTH-06)
  - Root layout with hydration gate (splash held until status resolves) and Stack.Protected route guard (AUTH-02, observable half)
  - (app) route group rendering the expiry banner once above the tab stack
  - Two-tab (app)/(tabs) bar: index (Home) and profile (declared, screen added in 01-06)
  - Home placeholder screen with locked "Booking a ride is coming soon" copy
affects: [01-06-profile-and-account, phase-02-booking]

tech-stack:
  added: []
  patterns:
    - "Render-time state reset (not useEffect) to clear a dismissed/ack flag when a derived prop changes — used in SessionExpiryBanner for tokenExpiresAt"
    - "Hydration gate: root layout returns null while session status is 'unknown', holding the native splash screen via expo-splash-screen until hydrate() resolves, then Stack.Protected routes to exactly one group"

key-files:
  created:
    - src/features/auth/components/SessionExpiryBanner.tsx
    - src/features/auth/components/SessionExpiryBanner.test.tsx
    - src/app/_layout.tsx
    - src/app/(app)/_layout.tsx
    - src/app/(app)/(tabs)/_layout.tsx
    - src/app/(app)/(tabs)/index.tsx
  modified: []

key-decisions:
  - "RNTL v14's fireEvent and act() are async and return thenables that must be awaited — the plan's own component spec was followed byte-for-byte, but the test file needed `await fireEvent.press(...)` and `await act(...)` (not bare calls) for assertions to observe the post-update render; without awaiting, dismiss/tick/re-login tests read stale JSON."
  - "src/app/(app)/(tabs)/_layout.tsx declares a 'profile' Tabs.Screen whose route file does not exist yet (created in plan 01-06) — Expo Router tolerates this until a dev/build run, which per the plan's own note doesn't happen until 01-08."
  - "Logged a pre-existing, unrelated console act() warning in src/features/auth/api.test.ts (from plan 01-04) to deferred-items.md rather than fixing it — out of scope per the scope-boundary rule since it's not in this plan's task files and the suite still passes 41/41."

patterns-established:
  - "Root layout hydration gate: `if (status === 'unknown') return null` behind `SplashScreen.preventAutoHideAsync()`, hidden only once status resolves — prevents any Login/Home flash on cold start."

requirements-completed: [AUTH-02, AUTH-06]

duration: 5min
completed: 2026-08-11
---

# Phase 01 Plan 05: Session-Expiry Banner & Authenticated App Shell Summary

**Root-layout hydration gate + Stack.Protected route guard behind the splash screen, a two-tab (Home/Profile) authenticated shell with a locked-copy Home placeholder, and a 7-test-covered 5-minute pre-expiry countdown banner ported byte-identical from the driver app.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-08-11T19:51:00+08:00 (approx, first commit 19:51:45)
- **Completed:** 2026-08-11T19:54:34+08:00
- **Tasks:** 2 completed
- **Files modified:** 6 created (2 test/component pair, 4 app-shell route files), plus 1 deferred-items.md log

## Accomplishments
- AUTH-06 fully implemented and tested: `SessionExpiryBanner` warns only inside the 5-minute pre-expiry window, is dismissible, and un-dismisses automatically when `tokenExpiresAt` changes (re-login case) — 7/7 tests passing.
- AUTH-02 becomes end-to-end observable: `src/app/_layout.tsx` holds the splash screen and renders nothing until `useSessionStore.getState().hydrate()` resolves `status`, then `Stack.Protected` routes to exactly one of `(auth)` or `(app)` — no flash of the wrong screen.
- Authenticated app shell exists: `(app)/_layout.tsx` renders the expiry banner once above a two-tab bar (`(app)/(tabs)/_layout.tsx`, Home + Profile only, no speculative third tab), and `(app)/(tabs)/index.tsx` carries the exact locked placeholder copy "Booking a ride is coming soon".

## Task Commits

Each task was committed atomically (Task 1 used TDD: test then feat):

1. **Task 1a: SessionExpiryBanner — failing test (RED)** - `24abd56` (test)
2. **Task 1b: SessionExpiryBanner — implementation (GREEN)** - `ae9137a` (feat)
3. **Task 2: Root layout, (app) group, two-tab bar, Home placeholder** - `e4dd690` (feat)

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified
- `src/features/auth/components/SessionExpiryBanner.tsx` - 5-min pre-expiry countdown banner, byte-identical to driver app's implementation
- `src/features/auth/components/SessionExpiryBanner.test.tsx` - 7 tests: null/outside-window/inside-window/expired/dismiss/re-login-reset/tick-reevaluation
- `src/app/_layout.tsx` - QueryClientProvider, hydrate-on-mount, splash control, Stack.Protected route guard
- `src/app/(app)/_layout.tsx` - renders SessionExpiryBanner once above the (tabs) stack
- `src/app/(app)/(tabs)/_layout.tsx` - two-tab bar: `index` (Home) and `profile` (route added in plan 01-06)
- `src/app/(app)/(tabs)/index.tsx` - Home placeholder, no query wiring (deferred to avoid cross-plan dependency)

## Decisions Made
- Component code (`SessionExpiryBanner.tsx`) copied byte-for-byte from the driver app per the plan's explicit instruction, verified via `diff -q`.
- Test file required `await` on `fireEvent.press(...)` and `act(...)` calls — RNTL v14 made both async (returning thenables); the plan's behavior spec was implemented as written, only the test mechanics needed this fix to actually observe post-update renders. Treated as Rule 3 (blocking issue preventing the RED→GREEN cycle from completing), not a deviation from the intended behavior.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Test file needed `await` on RNTL v14's async `fireEvent.press`/`act`**
- **Found during:** Task 1 (SessionExpiryBanner tests)
- **Issue:** `fireEvent.press(...)` and `act(...)` in `@testing-library/react-native@14.0.1` are both async functions returning thenables; calling them without `await` let assertions run before the state update committed, so the dismiss/re-login/tick tests read stale rendered output.
- **Fix:** Added `await` to all `fireEvent.press(...)` and `act(...)` calls in the test file.
- **Files modified:** `src/features/auth/components/SessionExpiryBanner.test.tsx`
- **Verification:** All 7 tests pass; `npx tsc --noEmit` exits 0.
- **Committed in:** `ae9137a` (Task 1 GREEN commit)

---

**Total deviations:** 1 auto-fixed (blocking, test-infrastructure only)
**Impact on plan:** No change to shipped component behavior or plan scope — the driver app's `SessionExpiryBanner.tsx` is still byte-identical. Only test mechanics adjusted for the installed RNTL version.

## Issues Encountered
- `npm test` (full 8-suite run) surfaces a pre-existing React "not wrapped in act(...)" console warning from `src/features/auth/api.test.ts` (written in plan 01-04, unrelated to this plan's files). The suite still passes 41/41; logged to `.planning/phases/01-foundation-auth/deferred-items.md` rather than fixed, per the scope-boundary rule (only issues directly caused by this task's changes are auto-fixed).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `(app)/(tabs)/_layout.tsx` declares route names `index` and `profile`; plan 01-06 must create `src/app/(app)/(tabs)/profile/` (or `profile.tsx`) to satisfy the already-declared tab — Expo Router tolerates this gap until a dev/build run, which per plan 01-08 is fine.
- `(app)/(tabs)/index.tsx` intentionally has no `useProfileQuery` wiring; 01-06 may choose to add a greeting once the profile query exists, but that is optional, not required by this plan's success criteria.
- AUTH-02 and AUTH-06 are both fully satisfied by this plan's success criteria (hydration gate + route guard, and the tested countdown banner) — both marked complete in REQUIREMENTS.md.

---
*Phase: 01-foundation-auth*
*Completed: 2026-08-11*

## Self-Check: PASSED

All created files verified present on disk; all 3 task/plan commits (`24abd56`, `ae9137a`, `e4dd690`) verified in git history.
