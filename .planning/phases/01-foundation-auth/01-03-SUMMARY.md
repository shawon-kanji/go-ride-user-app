---
phase: 01-foundation-auth
plan: 03
subsystem: auth
tags: [jwt, zustand, expo-secure-store, fetch, react-query, session-management]

# Dependency graph
requires:
  - phase: 01-foundation-auth (plan 01-02)
    provides: Jest/RNTL test infra, createSecureStoreMock() global mock, src/api/types.ts rider DTOs, auth-fixtures test-utils
provides:
  - src/lib/jwt.ts (decodeJwtExpiryMs) — hand-rolled base64url JWT expiry decoder, no library
  - src/lib/secure-store.ts (tokenStorage) — sole owner of the 'go-ride-rider-token' expo-secure-store key
  - src/stores/session-store.ts (useSessionStore) — Zustand in-memory session mirror with hydrate/setSession/clearSession/consumeSessionExpiredReason
  - src/api/http-client.ts (apiRequest, ApiError) — fetch wrapper with centralized 401 handling
  - src/api/query-client.ts (queryClient) — shared TanStack Query client, retry:1 on queries
  - src/api/auth-client.ts (authClient) — signup/login against /auth/signup, /auth/login
  - src/api/profile-client.ts (profileClient) — getProfile/updateProfile/changePassword against /me, /profile, /change-password
affects: [01-04, 01-05, 01-06, 01-07]

# Tech tracking
tech-stack:
  added: []
  patterns: ["zustand store with no persist middleware — token lives solely in expo-secure-store, store is a synchronous in-memory mirror hydrated once at boot via hydrate()", "centralized 401 handling inside apiRequest so no screen/component handles session expiry itself", "per-endpoint response envelope typed inline at the call site rather than a shared ApiResponse<T> generic"]

key-files:
  created:
    - src/lib/jwt.ts
    - src/lib/secure-store.ts
    - src/lib/secure-store.test.ts
    - src/stores/session-store.ts
    - src/stores/session-store.test.ts
    - src/api/http-client.ts
    - src/api/http-client.test.ts
    - src/api/query-client.ts
    - src/api/auth-client.ts
    - src/api/profile-client.ts
  modified: []

key-decisions:
  - "Reworded session-store.ts's 'No zustand/persist here' comment to 'No persistence middleware here' — the plan's own literal driver-app-derived comment text contained the substring 'zustand/persist', which its own acceptance-criteria grep explicitly forbids anywhere in the file. Same class of plan/verify-script self-contradiction as 01-02's types.ts fix; only the comment wording changed, no behavioral difference."

patterns-established:
  - "Session store exported surface (consumed directly by 01-04 through 01-07): useSessionStore state = { status: 'unknown'|'authenticated'|'unauthenticated', token: string|null, tokenExpiresAt: number|null, user: UserSummary|null, sessionExpiredReason: string|null }; actions = hydrate(): Promise<void>, setSession(token: string, user: UserSummary): Promise<void>, clearSession(reason?: string): Promise<void>, consumeSessionExpiredReason(): string|null (read-and-clear, returns null on second call)"

requirements-completed: []

# Metrics
duration: 5min
completed: 2026-08-11
---

# Phase 01 Plan 03: Session & Networking Foundation Summary

**JWT expiry decoding, expo-secure-store-backed token persistence, a Zustand session-store mirror, and a centralized-401 `apiRequest` wrapper feeding three typed rider API clients (auth, profile, change-password).**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-08-11T19:38:00+08:00
- **Completed:** 2026-08-11T19:40:24+08:00
- **Tasks:** 2 completed
- **Files modified:** 10 created

## Accomplishments
- AUTH-02's storage/hydration half proven end-to-end: a valid stored token restores an authenticated session on `hydrate()`; an expired or undecodable one is deleted from storage and never resurrects a session
- Single centralized 401 path exists in `apiRequest` and is tested in both directions — clears the session (with the exact user-facing message) on an authenticated 401, leaves an existing session untouched on a `skipAuth` 401 (e.g. a wrong-password login attempt)
- All five rider REST endpoints (`/auth/signup`, `/auth/login`, `/me`, `/profile`, `/change-password`) have typed client functions with correct paths and per-endpoint response envelopes, with no shared/invented envelope type
- 17 new tests green (9 session/storage + 8 http-client), full suite 20/20, `tsc --noEmit` clean

## Task Commits

Each task was committed atomically (TDD RED then GREEN):

1. **Task 1: JWT decoder, secure token storage, and the session store (AUTH-02)**
   - `9bef594` (test) — failing tests for secure-store and session-store
   - `3f3cdda` (feat) — jwt.ts, secure-store.ts, session-store.ts implementation, 9/9 passing
2. **Task 2: apiRequest wrapper with centralized 401 handling, plus the three typed rider clients**
   - `1c217ac` (test) — failing tests for apiRequest/ApiError/401 handling
   - `f810eef` (feat) — http-client.ts, query-client.ts, auth-client.ts, profile-client.ts, 8/8 passing

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified
- `src/lib/jwt.ts` - `decodeJwtExpiryMs(token)`, byte-identical copy from go-ride-driver-app
- `src/lib/secure-store.ts` - `tokenStorage` (get/set/clear), key `'go-ride-rider-token'` (no collision with the driver app's `'go-ride-driver-token'`)
- `src/lib/secure-store.test.ts` - round-trip, clear, and key-identity assertions (3 tests)
- `src/stores/session-store.ts` - `useSessionStore`: `status`/`token`/`tokenExpiresAt`/`user`/`sessionExpiredReason` state, `hydrate`/`setSession`/`clearSession`/`consumeSessionExpiredReason` actions, no persist middleware
- `src/stores/session-store.test.ts` - hydrate (empty/valid/expired/garbage token), setSession, clearSession + reason-consumption (6 tests)
- `src/api/http-client.ts` - `apiRequest<T>`, `ApiError`; centralized `response.status === 401 && !skipAuth` handling
- `src/api/http-client.test.ts` - 200 passthrough, auth header presence/absence, 401-clears vs 401-skipAuth-does-not-clear, ApiError shapes, base-URL path composition (8 tests)
- `src/api/query-client.ts` - shared `queryClient` (`retry: 1` on queries), byte-identical copy
- `src/api/auth-client.ts` - `authClient.signup`/`authClient.login`, both `skipAuth: true`, no `/driver` prefix
- `src/api/profile-client.ts` - `profileClient.getProfile`/`updateProfile`/`changePassword`, distinct per-endpoint envelopes

## Decisions Made
- Reworded one comment in `session-store.ts` (see key-decisions above) to satisfy the plan's own acceptance-criteria grep without changing any runtime behavior.
- Followed the plan's driver-app-mirroring instructions exactly otherwise: `jwt.ts` and `http-client.ts`/`query-client.ts` are byte-identical to `go-ride-driver-app`; `secure-store.ts` differs only in `TOKEN_KEY`; `session-store.ts` differs only in the `driver`→`user`/`DriverSummary`→`UserSummary` rename plus the one comment reword.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug/plan-inconsistency] Reworded a session-store.ts comment to satisfy the plan's own verification script**
- **Found during:** Task 1
- **Issue:** The plan's action block copies the driver app's comment `// No zustand/persist here on purpose — ...` verbatim, but the same plan's acceptance criteria assert `src/stores/session-store.ts contains NO occurrence of zustand/persist or persist(` — the literal instructed content and its own check directly contradict, identical in kind to 01-02's `types.ts` comment issue.
- **Fix:** Reworded to `// No persistence middleware here on purpose — ...`, preserving the exact same meaning. No change to the `SessionState` interface, store logic, or the `create<SessionState>()` call.
- **Files modified:** src/stores/session-store.ts
- **Verification:** `grep -c "zustand/persist\|persist(" src/stores/session-store.ts` returns 0; all 6 session-store tests and `tsc --noEmit` still pass.
- **Committed in:** 3f3cdda (Task 1 GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 bug/plan-inconsistency fix)
**Impact on plan:** Cosmetic comment wording only; no change to exported API, types, or runtime behavior. No scope creep.

## Issues Encountered
None beyond the deviation documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `useSessionStore`'s exported surface (state fields and action signatures, recorded in this summary's `patterns-established` and frontmatter) is stable and ready for 01-04 (auth screens/mutations) through 01-07 to consume directly.
- `apiRequest`'s centralized 401 handling means 01-04 through 01-07 screens never need their own 401/session-expiry logic — they only need to react to `useSessionStore`'s `status` and `sessionExpiredReason`.
- `authClient` and `profileClient` are ready for 01-04 (login/signup mutations) and 01-06/01-07 (profile view/edit, change-password) to wrap in React Query hooks.
- AUTH-02 is NOT marked complete from this plan — it also requires 01-04's login-mutation call to `setSession` and 01-05's app-shell hydration gate calling `hydrate()` on boot. This plan only supplies the storage/store/network foundation those later plans build on.
- No blockers or concerns carried forward.

---
*Phase: 01-foundation-auth*
*Completed: 2026-08-11*

## Self-Check: PASSED

All 10 created files confirmed present on disk; all 4 task commits (9bef594, 3f3cdda, 1c217ac, f810eef) confirmed in git log.
