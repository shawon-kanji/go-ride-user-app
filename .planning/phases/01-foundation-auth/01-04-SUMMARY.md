---
phase: 01-foundation-auth
plan: 04
subsystem: auth
tags: [zod, react-hook-form, tanstack-query, expo-router, jwt]

# Dependency graph
requires:
  - phase: 01-foundation-auth (plan 01-03)
    provides: useSessionStore (setSession/clearSession/consumeSessionExpiredReason), authClient (signup/login), http-client's ApiError, createTestQueryClient/createQueryWrapper/makeUser/makeLoginResult test-utils
provides:
  - src/features/auth/schemas.ts (signupSchema, loginSchema) — zod mirrors of the backend's validate tags
  - src/features/auth/api.ts (useLoginMutation, useSignupMutation, SignupSucceededLoginFailedError) — signup-then-login chain
  - src/features/auth/components/LoginForm.tsx, SignupForm.tsx — single-banner-error forms
  - "src/app/(auth)/_layout.tsx, login.tsx, signup.tsx — the (auth) route group; route names 'login' and 'signup' are what plan 01-05's root layout guard redirects to/from"
affects: [01-05, 01-06, 01-07, 01-08]

# Tech tracking
tech-stack:
  added: []
  patterns: ["zod schemas mirror backend validate tags exactly, asserted via safeParse + result.error.issues[0].message rather than thrown exceptions", "mutation hooks call useSessionStore.getState().setSession(...) directly in onSuccess rather than returning session data for a component to store", "forms surface exactly one error banner per submit via a single errorMessage useState, fed by both react-hook-form's onInvalid handler and the mutation's onError handler — never per-field inline messages", "signup's mutationFn wraps only the chained login call in try/catch so a genuine signup failure propagates unchanged and only login failure-after-signup-success becomes SignupSucceededLoginFailedError"]

key-files:
  created:
    - src/features/auth/schemas.ts
    - src/features/auth/schemas.test.ts
    - src/features/auth/api.ts
    - src/features/auth/api.test.ts
    - src/features/auth/components/LoginForm.tsx
    - src/features/auth/components/SignupForm.tsx
    - "src/app/(auth)/_layout.tsx"
    - "src/app/(auth)/login.tsx"
    - "src/app/(auth)/signup.tsx"
  modified: []

key-decisions:
  - "No deviations from plan — driver-app files copied with driver->rider renames exactly as specified; no architectural or plan-inconsistency issues encountered this plan (unlike 01-02/01-03's comment-reword fixes)."

patterns-established:
  - "(auth) route group: src/app/(auth)/_layout.tsx declares 'login' before 'signup' in its headerless Stack — login is the logged-out landing screen, signup is reached only via its link. Route paths consumed elsewhere: '/(auth)/login' and '/(auth)/signup'."
  - "Login screen reads useSessionStore.getState().consumeSessionExpiredReason() inside a useState lazy initializer (not useEffect) so the read-and-clear happens exactly once per screen mount; this is the single surface for both AUTH-06's future expiry warning and http-client's 401-triggered 'session expired' message."

requirements-completed: [AUTH-01]

# Metrics
duration: 5min
completed: 2026-08-11
---

# Phase 01 Plan 04: Signup & Login Summary

**End-to-end rider signup and login: zod schemas mirroring the backend's validate tags, a signup-then-login TanStack Query mutation chain (since SignupResponse carries no token), and the `(auth)` route group with single-banner-error forms.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-08-11T19:44:08+08:00 (first commit after 01-03)
- **Completed:** 2026-08-11T19:48:38+08:00
- **Tasks:** 3 completed
- **Files modified:** 9 created

## Accomplishments
- AUTH-01 is functionally complete: a rider submitting email/password/first_name/last_name on Signup ends up with an authenticated session via the signup→login chain, since the backend's `SignupResponse` never returns a token
- The signup-succeeded-but-chained-login-failed case is distinguished from a genuine signup failure: only the login half is wrapped in try/catch, so a real signup error (e.g. duplicate email) propagates unchanged, while a login-only failure throws `SignupSucceededLoginFailedError` and `SignupForm` routes to `/(auth)/login` with the email prefilled instead of showing a misleading generic error
- AUTH-02's token-acquisition half is complete (login mutation calls `setSession`); the persistence half already existed from 01-03; the still-missing piece is 01-05's app-shell hydration gate, so AUTH-02 is intentionally left unmarked in REQUIREMENTS.md
- Both forms surface exactly one error banner per submit (zod validation failures via `onInvalid`, API errors via the mutation's `onError`), never inline per-field messages — matches `01-CONTEXT.md`'s locked decision
- Login is the logged-out landing screen; Signup is reached only via its link — enforced by `(auth)/_layout.tsx` declaring `login` before `signup`
- 14 new tests (8 schema + 6 mutation) green, full suite 34/34, `tsc --noEmit` clean

## Task Commits

Each task was committed atomically (TDD RED then GREEN for Tasks 1-2):

1. **Task 1: Auth zod schemas mirroring the backend validate tags (AUTH-01)**
   - `5d86bca` (test) — failing tests for signupSchema/loginSchema
   - `079b454` (feat) — schemas.ts implementation, 8/8 passing
2. **Task 2: Login and signup mutations, including the signup-then-login chain (AUTH-01, AUTH-02)**
   - `8cdc206` (test) — failing tests for useLoginMutation/useSignupMutation
   - `931f22c` (feat) — api.ts implementation, 14/14 passing (8 + 6)
3. **Task 3: Login/Signup forms and the (auth) route group**
   - `db239e1` (feat) — LoginForm, SignupForm, `(auth)/_layout.tsx`, `login.tsx`, `signup.tsx`; full suite 34/34, tsc clean

**Plan metadata:** (this commit, docs: complete plan)

_Note: Task 3 has no separate test file per the plan — its correctness is exercised by the plan's grep-based structural verification plus the full existing suite staying green._

## Files Created/Modified
- `src/features/auth/schemas.ts` - `signupSchema`, `loginSchema` (zod), `.trim().email(...)` on email, `.min(8, ...)` on password (both schemas), `.min(2).max(100)` on first/last name
- `src/features/auth/schemas.test.ts` - 8 tests: accept/reject email, password length, name length bounds, whitespace trimming
- `src/features/auth/api.ts` - `useLoginMutation`, `useSignupMutation`, `SignupSucceededLoginFailedError`; both mutations call `useSessionStore.getState().setSession(access_token, user)` in `onSuccess`
- `src/features/auth/api.test.ts` - 6 tests: login success/failure, signup→login call order, full signup success, signup-succeeded-login-failed error identity/email/session-not-authenticated, signup-itself-failed propagation with no login call
- `src/features/auth/components/LoginForm.tsx` - `zodResolver(loginSchema)`, single `errorMessage` state driving one `<Banner variant="error">`, accepts optional `initialEmail` prop
- `src/features/auth/components/SignupForm.tsx` - `zodResolver(signupSchema)`, field order first_name/last_name/email/password, `SignupSucceededLoginFailedError` branch does `router.replace({ pathname: '/(auth)/login', params: { email: error.email } })`
- `src/app/(auth)/_layout.tsx` - headerless `Stack` with `login` then `signup`
- `src/app/(auth)/login.tsx` - heading "Log in"; lazy-initializer reads `consumeSessionExpiredReason()` once at mount, also shows "Account created — please log in." when arriving with an `?email=` param from Signup; link to `/(auth)/signup`
- `src/app/(auth)/signup.tsx` - heading "Create your account"; link to `/(auth)/login`

## Decisions Made
None beyond following the plan exactly — all four screen/form files were copied from `go-ride-driver-app` with only the planned `driver`→`user`/"driver account"→"account" edits; no comment-substring or acceptance-criteria contradictions like 01-02/01-03 encountered this plan.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None. `useMutation`/`renderHook` in `api.test.ts` produce a handful of harmless "not wrapped in act(...)" console warnings from TanStack Query's internal `notifyManager` setTimeout batching (a known RNTL/react-query testing interaction, not a functional issue) — all 6 tests still pass deterministically and Jest exits cleanly without `--forceExit`.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The `(auth)` route group's exact screen names (`login`, `signup`) are ready for 01-05's root layout to reference for its logged-in/logged-out redirect guard
- `LoginForm`'s `initialEmail` prop and `(auth)/login.tsx`'s `?email=` param handling are the mechanism 01-05 (or any future flow) can reuse to land a rider on a prefilled Login screen
- AUTH-02 remains intentionally NOT marked complete — it still needs 01-05's app-shell hydration gate calling `useSessionStore.getState().hydrate()` on boot before the "stay logged in across restarts" claim is fully true end-to-end
- No blockers or concerns carried forward

---
*Phase: 01-foundation-auth*
*Completed: 2026-08-11*

## Self-Check: PASSED

All 9 created files confirmed present on disk; all 5 task commits (5d86bca, 079b454, 8cdc206, 931f22c, db239e1) confirmed in git log.
