---
phase: 01-foundation-auth
plan: 06
subsystem: auth
tags: [tanstack-query, expo-router, react-hook-form, zod, zustand, jest, react-native-testing-library]

requires:
  - phase: 01-foundation-auth
    provides: profileClient ({user}-wrapped GET /me and PATCH /profile) from 01-03, User/AccountStatus types from 01-02, session-store clearSession from 01-03, two-tab (app)/(tabs) shell with a declared-but-unfilled profile route from 01-05
provides:
  - "src/features/profile/api.ts — profileKeys, useProfileQuery, useUpdateProfileMutation over the wrapped {user} envelope (AUTH-03)"
  - "src/features/profile/components/AccountStatusBadge.tsx — 2-value (active/deactivated) neutral status badge, freshly written (not the driver app's 3-value union)"
  - "src/features/profile/components/ProfileView.tsx — read-only profile (name/email/status) with Edit profile, Change password, and Log out actions (AUTH-03)"
  - "src/features/profile/components/EditProfileForm.tsx — two-field (first/last name) edit screen, no email field"
  - "src/features/profile/logout.ts — useLogout: clearSession (no reason) + queryClient.clear() + redirect to /(auth)/login, no online-status call (AUTH-04)"
  - "src/app/(app)/(tabs)/profile/{_layout,index,edit}.tsx — the profile route subtree the tab bar already pointed at"
affects: [01-07-change-password, phase-02-booking]

tech-stack:
  added: []
  patterns:
    - "Component-boundary envelope unwrap: query/mutation hooks cache the raw {user} (or {driver}) API envelope verbatim; only the component destructures const { user } = data — keeps the wrapped-response contract visible at the type level all the way to the render layer"
    - "gcTime:0 test-client GC race: writing to the query cache via setQueryData/mutation onSuccess with no active query observer is eligible for immediate removal on a real setTimeout(0); tests asserting post-mutation cache state must keep an active useProfileQuery observer alongside the mutation (mirrors real component usage) rather than asserting on an unobserved client.getQueryData()"

key-files:
  created:
    - src/features/profile/schemas.ts
    - src/features/profile/api.ts
    - src/features/profile/api.test.ts
    - src/features/profile/components/AccountStatusBadge.tsx
    - src/features/profile/components/AccountStatusBadge.test.tsx
    - src/features/profile/components/ProfileView.tsx
    - src/features/profile/components/ProfileView.test.tsx
    - src/features/profile/components/EditProfileForm.tsx
    - src/features/profile/logout.ts
    - src/features/profile/logout.test.ts
    - src/app/(app)/(tabs)/profile/_layout.tsx
    - src/app/(app)/(tabs)/profile/index.tsx
    - src/app/(app)/(tabs)/profile/edit.tsx
  modified: []

key-decisions:
  - "AccountStatusBadge written fresh with a 2-value LABELS/VARIANTS map (active/deactivated->inactive) rather than adapted from the driver app's 3-value pending/active/blocked map — 01-RESEARCH.md Pitfall 2's exact trap, avoided by design rather than copy-then-fix."
  - "logout.ts omits the driver app's best-effort online-status PATCH entirely (not adapted/guarded) — riders have no online/offline concept, so there is nothing to best-effort."
  - "ProfileView.tsx already renders a 'Change password' button routing to /(app)/(tabs)/profile/change-password, which does not exist yet — plan 01-07 creates that screen and appends the change-password entry to profile/_layout.tsx's Stack."
  - "logout.ts was created during Task 2 (not Task 3) as a Rule-3 blocking-issue fix: ProfileView.tsx's real import of '../logout' must resolve to an actual file for Jest to accept jest.mock('../logout', ...) in ProfileView.test.tsx, even though the module's own test/TDD cycle belongs to Task 3. The implementation written in Task 2 was byte-identical to Task 3's planned action block, so Task 3's logout.test.ts (5 tests) passed immediately on first run rather than going through a literal RED phase — documented here rather than silently reordering the plan's task boundaries."

patterns-established:
  - "Profile screen structure: read-only view screen + separate edit screen navigated to via router.push, matching the driver app's established pattern for distinct-action screens (also the template plan 01-07's change-password screen follows)."

requirements-completed: [AUTH-03, AUTH-04]

duration: 8min
completed: 2026-08-11
---

# Phase 01 Plan 06: Profile View, Edit, and Logout Summary

**Rider Profile tab (view/edit name, read-only email, 2-value factual account-status badge) and logout wired end-to-end over the `{user}`-wrapped GET /me / PATCH /profile envelope, with 18/18 profile-suite tests and the full 59-test suite green.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-08-11T19:56:29+08:00 (approx, immediately after 01-05's completion commit)
- **Completed:** 2026-08-11T20:04:20+08:00
- **Tasks:** 3 completed
- **Files modified:** 13 created (schemas/api/hooks/components/tests + 3 route files)

## Accomplishments
- AUTH-03 fully implemented and tested: a rider can view first name, last name, email, and account status on the Profile tab, and edit first/last name on a separate Edit-profile screen; email has no editable control anywhere and no email-verification concept was invented (rider `User` has no such field).
- 01-RESEARCH.md's two named highest-risk pitfalls for this plan were both avoided by construction: the `{user}` envelope is cached verbatim by the query/mutation hooks and only unwrapped at the `ProfileView`/`EditProfileForm` component boundary (`const { user } = data`), and `AccountStatusBadge` was written fresh against the rider's real 2-value `AccountStatus` union rather than adapted from the driver app's 3-value one.
- AUTH-04 fully implemented and tested: `useLogout` clears the session store (no expiry-reason banner triggered), clears the entire TanStack Query cache, and redirects to `/(auth)/login`, making zero network calls — an explicit, tested divergence from the driver app's best-effort online-status PATCH before logout.
- Profile tab route subtree (`_layout.tsx`, `index.tsx`, `edit.tsx`) now fills the `profile` screen that 01-05's tab bar already declared.

## Task Commits

Each task was committed atomically (TDD: test then feat, plus one stabilization fix):

1. **Task 1: Profile query/mutation hooks and edit schema (RED)** - `138e81a` (test)
2. **Task 1: Profile query/mutation hooks and edit schema (GREEN)** - `a86b3b9` (feat)
3. **Task 2: AccountStatusBadge, ProfileView, EditProfileForm (RED)** - `b7f79cd` (test)
4. **Task 2: AccountStatusBadge, ProfileView, EditProfileForm (GREEN)** - `252e51f` (feat)
5. **Full-suite stabilization: gcTime:0 GC race in api.test.ts** - `1eca020` (fix)
6. **Task 3: useLogout tests** - `f6dff86` (test)
7. **Task 3: useLogout + profile route subtree (GREEN)** - `8370da4` (feat)

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified
- `src/features/profile/schemas.ts` - `editProfileSchema` (first_name/last_name, 2-100 chars, no email)
- `src/features/profile/api.ts` - `profileKeys`, `useProfileQuery`, `useUpdateProfileMutation` caching the full `{user}` envelope
- `src/features/profile/api.test.ts` - 5 tests: envelope survives unwrapped, query key, exact PATCH body keys, cache write on success, cache untouched on rejection
- `src/features/profile/components/AccountStatusBadge.tsx` - fresh 2-value (active/deactivated) badge, deactivated -> `inactive` variant (not `blocked`)
- `src/features/profile/components/AccountStatusBadge.test.tsx` - 2 tests: both status values render their label
- `src/features/profile/components/ProfileView.tsx` - unwraps `{user}` at the component boundary; renders name/email/status; Edit profile / Change password / Log out actions
- `src/features/profile/components/ProfileView.test.tsx` - 6 tests: loading branch, active render, deactivated render with no extra copy, no verification text, single logout call, no editable email control
- `src/features/profile/components/EditProfileForm.tsx` - two-`TextInput` name-edit form, zod-validated, single Banner error surface
- `src/features/profile/logout.ts` - `useLogout`: clearSession (no reason) + queryClient.clear() + redirect
- `src/features/profile/logout.test.ts` - 5 tests: session cleared, token removed, cache cleared, single redirect, zero network calls
- `src/app/(app)/(tabs)/profile/_layout.tsx` - Stack with `index` and `edit` screens
- `src/app/(app)/(tabs)/profile/index.tsx` - renders `ProfileView`
- `src/app/(app)/(tabs)/profile/edit.tsx` - renders `EditProfileForm`

## Decisions Made
- `logout.ts` was written during Task 2 rather than Task 3 (see key-decisions above) — a Rule 3 blocking-issue fix, since `ProfileView.tsx`'s real `import { useLogout } from '../logout'` needed to resolve to an actual file before `jest.mock('../logout', ...)` in `ProfileView.test.tsx` could run. The content matches Task 3's action block exactly; Task 3's own `logout.test.ts` (written afterward, per the plan's task order) passed immediately rather than failing red-first, since the implementation already existed.
- `ProfileView.tsx` renders the `Change password` button now (plan's explicit instruction) even though its target screen doesn't exist until plan 01-07 — noted per the plan's own `<output>` instruction.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created `logout.ts` one task early so Task 2's component test could resolve the module**
- **Found during:** Task 2 (`ProfileView.test.tsx`)
- **Issue:** `ProfileView.tsx` imports `useLogout` from `'../logout'`; Jest's `jest.mock('../logout', () => ...)` requires the real module path to resolve even when mocked, and `logout.ts` didn't exist yet (it's nominally Task 3's deliverable).
- **Fix:** Implemented `src/features/profile/logout.ts` during Task 2, using the exact content specified in Task 3's `<action>` block (no online-status call, `clearSession()` with no reason, `queryClient.clear()`, redirect to `/(auth)/login`).
- **Files modified:** `src/features/profile/logout.ts`
- **Verification:** `ProfileView.test.tsx`'s 6 tests pass; Task 3's later `logout.test.ts` (5 tests) also passed unmodified against this same file.
- **Committed in:** `8370da4` (Task 3 GREEN commit, alongside the route files — kept with its own test/task pairing rather than Task 2's, to preserve the plan's file-ownership boundaries in the commit history).

**2. [Rule 3 - Blocking] Fixed a flaky `gcTime:0` cache-write assertion race in `api.test.ts`**
- **Found during:** Task 3's own required verification step (`npm test`, full suite)
- **Issue:** `createTestQueryClient()` sets `queries.gcTime: 0`. Two `useUpdateProfileMutation` tests wrote to (or read) the `['profile']` cache entry with no active `useProfileQuery` observer mounted; an unobserved cache entry with `gcTime: 0` is eligible for removal on a real `setTimeout(0)`, which occasionally fired before the assertion ran under the full suite's timing (not reproducible in isolated single-file runs, but reproducible across 3 consecutive full-suite runs before the fix, and stable across 3 more after).
- **Fix:** Both affected tests now mount `useProfileQuery` alongside `useUpdateProfileMutation` in the same `renderHook`, mirroring real `ProfileView` usage where a query observer is always active during a mutation, which keeps the cache entry alive for the assertion.
- **Files modified:** `src/features/profile/api.test.ts`
- **Verification:** `npm test` run 3 times consecutively, 59/59 passing each time (previously flaked 1/59 intermittently).
- **Committed in:** `1eca020`

---

**Total deviations:** 2 auto-fixed (both Rule 3 - blocking issues preventing the plan's own tasks/verification from completing cleanly)
**Impact on plan:** No change to shipped behavior — `logout.ts`'s content matches the plan's Task 3 action block verbatim, and the test-stabilization fix only changed test setup, not the hooks under test. No scope creep.

## Issues Encountered
None beyond the two auto-fixed items above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `ProfileView.tsx` already renders a `Change password` button pointing at `/(app)/(tabs)/profile/change-password` — plan 01-07 must create that route file and append its entry to `src/app/(app)/(tabs)/profile/_layout.tsx`'s `Stack`.
- `src/features/profile/schemas.ts` and `src/features/profile/api.ts` are intentionally left open for plan 01-07 to append `changePasswordSchema` and `useChangePasswordMutation` to (not separate files), per the plan's own note.
- AUTH-03 and AUTH-04 are both fully satisfied by this plan's success criteria (view/edit/logout, all tested) and marked complete in REQUIREMENTS.md.
- Pre-existing, unrelated `console.error` "not wrapped in act(...)" warning from `src/features/auth/api.test.ts` (logged in `deferred-items.md` during 01-05) is still present and still out of scope; not reproduced by any file this plan touched.

---
*Phase: 01-foundation-auth*
*Completed: 2026-08-11*

## Self-Check: PASSED

All created files verified present on disk; all 7 task/plan commits (`138e81a`, `a86b3b9`, `b7f79cd`, `252e51f`, `1eca020`, `f6dff86`, `8370da4`) verified in git history.
