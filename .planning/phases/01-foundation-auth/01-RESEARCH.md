# Phase 1: Foundation & Auth - Research

**Researched:** 2026-08-11
**Domain:** Expo/React Native rider auth app bootstrap — project scaffolding, secure session management, form-driven auth/profile screens, Jest/RNTL test tooling from day 1, local Android native build verification (no EAS)
**Confidence:** HIGH (nearly everything below is copied from or directly cross-checked against a working sibling implementation and the actual backend source, not derived from general knowledge)

## Summary

This phase has an unusually strong starting position: `go-ride-driver-app`, a sibling repo already mid-build against the same backend, has a working, verified Phase 1 (auth, session, profile) plus a later KYC phase that retrofitted Jest + React Native Testing Library. Nearly every technical decision this phase needs — theme tokens, generic UI primitives, the `apiRequest`/`http-client.ts` wrapper, the Zustand session store, the hand-rolled JWT-expiry decoder, the `SessionExpiryBanner` pattern, the Jest config that actually works (`jest-expo/android`, not the bare preset) — already exists as working code to copy, not research to interpret. The primary risk in this phase is not "what pattern to use" but "faithfully adapting six specific backend-contract differences" between the driver and rider APIs (different route paths, a wrapped `{"user": {...}}` response envelope on `/me` and `/profile` that the driver side doesn't have, a `change-password` endpoint the driver side doesn't have, and a 2-value vs 3-value `account_status` enum) while reusing everything else verbatim.

The second focus area — local Android build verification — has one important correction to make before planning: the roadmap's goal text ("verified against a real production build") and this project's own PITFALLS.md (written before this session's clarification) both assume an EAS cloud build path. That assumption is now explicitly superseded: this project builds locally only, via `npx expo run:android`, using a debug-signed local build. This changes what "verified" means for the Google Maps API key: the relevant SHA-1 to register in Google Cloud Console is the **local debug keystore's** fingerprint (auto-generated at `~/.android/debug.keystore` by the first `expo run:android`/`prebuild`), not an EAS-managed credential. No Android emulator is currently installed on this machine (cmdline-tools only, no system images, no `emulator` binary) — verification requires either a physical device over USB debugging or a fresh `sdkmanager`-installed AVD.

Third, adding the Maps API key config now (not deferred to Phase 3) is genuinely cheap: this phase already requires a full local native build to verify auth end-to-end, so adding the `react-native-maps` config plugin block, registering the debug SHA-1, and confirming the key resolves to a literal (non-placeholder) value in the generated `AndroidManifest.xml` costs one extra `grep` after a build that's happening anyway. Actually rendering a `<MapView>` is not in scope — that's genuinely Phase 3's job.

**Primary recommendation:** Scaffold via `create-expo-app`, then copy `go-ride-driver-app`'s theme/components/lib/stores/jest.config.js verbatim; hand-write only the six backend-contract-different files (`types.ts`, `auth-client.ts`, a new `profile-client.ts` or extended client, `schemas.ts`, the `AccountStatus` type, and a new change-password feature) against the verified rider DTOs below; write tests alongside each unit as it's built (RNTL v14's `render`/`renderHook` are async — always `await` them); do the Maps-key config-and-manifest-verification as a cheap tail step of the same local build used to verify auth, not a separate effort.

## User Constraints

<user_constraints>

### Locked Decisions (from CONTEXT.md — copy verbatim, planner MUST honor)

**App shell / navigation for this phase**
- Bottom tabs: Home and Profile only for Phase 1 — no third tab yet, since there's no Vehicles/KYC equivalent on the rider side and Fare-Estimate-and-Booking (Phase 2) hasn't been built. Mirrors the driver app's `(app)/(tabs)` structure exactly, just with fewer tabs.
- Home screen shows a placeholder card/message ("Booking a ride is coming soon") rather than any real booking UI — mirrors the driver app's Phase 1 Home screen pattern.
- Login is the default landing screen for a logged-out rider; Signup is reached via a link from Login — mirrors driver app's Phase 1 decision exactly.

**Auth & session UX**
- Form validation errors (client-side zod failures and API error responses) are shown as a single banner/toast on submit, not inline per-field messages — mirrors driver app exactly.
- Session-expiry warning: a dismissible countdown banner appears roughly 5 minutes before the 60-minute hard JWT expiry ("session ending soon, please re-login") — same `SessionExpiryBanner` component pattern as the driver app, reused/re-implemented identically here since no refresh-token endpoint exists for riders either.
- On an actual 401 (token truly expired/invalid): immediately clear the session and redirect to login with a "your session expired" message — no retry-then-redirect, mirrors driver app exactly.
- Signup does not return a token (`SignupResponse{user: UserResponse}` only) — signup must chain into an immediate login call to authenticate the rider, identical pattern to the driver app.

**Profile scope**
- Backend only allows editing `first_name`/`last_name` via `PATCH /api/v1/profile` — email is not editable. Profile screen: read-only email, editable name, plus a factual `account_status` badge.
- The Profile screen shows no email-verification badge/status of any kind — rider's `User` entity has no `is_email_verified` field. Do not invent one.
- `account_status` badge is a neutral, factual label only (values: `active`/`deactivated`, 2 values not 3). No dedicated "your account is deactivated" flow/messaging is designed in this phase — a rejected login for a deactivated rider surfaces through the same generic API-error banner as any other login failure.
- Editing the name happens on a separate "Edit profile" screen (view screen has an Edit button that navigates away), not inline editing — mirrors driver app exactly.
- Logout clears the token and redirects to login — mirrors driver app's logout pattern, EXCEPT: no best-effort online-status PATCH call before clearing (riders have no online/offline concept) — logout is just clear-token-and-redirect.

**Change-password screen (new — no driver-app precedent)**
- Reached via an action/button on the Profile screen (not bundled into "Edit profile") — its own separate screen.
- Two fields: current password, new password (`POST /api/v1/change-password`'s `ChangePasswordRequest{old_password, new_password}` exactly — no "confirm new password" field is required by the backend).
- On success, show a confirmation (toast/banner) and return to the Profile screen — do not force a re-login (backend returns `{message}` with no session-invalidation semantics documented).

### Claude's Discretion
- Exact component internals (Button/TextInput/Banner/Card/ConfirmDialog primitives) — copied verbatim from `go-ride-driver-app/src/components/`; adapt only where a rider-specific need arises, don't redesign.
- Whether to add a client-side "confirm new password" field on the change-password form.
- Internal file/module organization beyond what's specified in canonical refs.
- Exact visual polish/spacing — standard, clean form/list conventions and the copied theme tokens as-is; bold/vibrant brand pass is deferred.

### Deferred Ideas (OUT OF SCOPE)
- Any handling beyond a generic error banner for a `deactivated` rider account — out of scope since self-service deactivation isn't built in this milestone.
- Shared component/theme package between `go-ride-driver-app` and `go-ride-user-app` — explicitly deferred until a future joint brand pass; this phase copies files directly instead.

</user_constraints>

## Phase Requirements

<phase_requirements>

| ID | Description | Research Support |
|----|-------------|-------------------|
| AUTH-01 | Rider can sign up with email + password | `authClient.signup` → chained `authClient.login` pattern (Code Examples); `signupSchema` zod mirror of backend validate tags; `POST /api/v1/auth/signup` confirmed returns `201 {user: UserResponse}`, no token |
| AUTH-02 | Rider can log in and stay logged in across app restarts (secure storage) | `tokenStorage` (expo-secure-store) + `useSessionStore.hydrate()` pattern (Code Examples); `POST /api/v1/auth/login` confirmed returns `200 {access_token, user: UserResponse}` |
| AUTH-03 | Rider can view/edit profile (first/last name); `/me` and `/profile` both wrap as `{"user": {...}}` | Confirmed directly against `auth_handler.go`: `Me` returns `gin.H{"user": response}`, `UpdateProfile` returns `gin.H{"user": response}` — both wrapped, driver-app's `{driver: Driver}` wrap-and-unwrap-at-component pattern directly transfers |
| AUTH-04 | Rider can log out | Driver app's `useLogout` pattern minus the best-effort online-status PATCH (riders have no online concept) — see Architecture Patterns |
| AUTH-05 | Rider can change their password (`POST /api/v1/change-password`) | Confirmed `ChangePasswordRequest{old_password, new_password}` → `200 ChangePasswordResponse{message}`, no driver-app precedent, new screen needed — see Architecture Patterns |
| AUTH-06 | Rider sees a proactive session-expiry warning before the JWT hard-expires | `SessionExpiryBanner` component + `decodeJwtExpiryMs` (Code Examples), confirmed backend `JWT_EXPIRY_MINUTES` defaults to 60, no refresh-token route exists (grepped `auth_routes.go`, zero matches for refresh) |

</phase_requirements>

## Standard Stack

### Core (mirror `go-ride-driver-app`'s exact locked versions — do not re-derive)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|---------------|
| expo | `~57.0.9` | SDK / custom dev client (not Expo Go) | Locked to match driver app exactly; `latest` on npm today is `57.0.12` (patch-compatible with the `~57.0.9` range) |
| react-native | `0.86.2` | RN core — New Architecture mandatory at this version | Locked, matches driver app |
| react | `19.2.3` | — | Locked, matches driver app |
| typescript | `~6.0.3` | strict mode | Locked, matches driver app |
| expo-router | `~57.0.9` | File-based routing, `(auth)`/`(app)` groups, `Stack.Protected` guard | Locked, matches driver app |
| @tanstack/react-query | `^5.101.4` | Server-state (profile query, auth mutations) | Locked, matches driver app |
| zustand | `^5.0.14` | Session-state store (token, expiry, status) — no persist middleware | Locked, matches driver app |
| react-hook-form | `^7.84.0` | Form state for signup/login/edit-profile/change-password | Locked, matches driver app |
| zod | `^4.4.3` | Client-side validation mirroring backend `validate` tags | Locked, matches driver app |
| @hookform/resolvers | `^5.7.1` | `zodResolver` glue | Locked, matches driver app |
| nativewind | `^4.2.6` | Tailwind-in-RN styling for copied components | Locked, matches driver app — **pinned to Tailwind v3, not v4** |
| tailwindcss | `^3.4.19` | NativeWind v4's actual required peer | Locked — do not take tailwindcss v4 |
| expo-secure-store | `~57.0.1` | JWT storage (Keystore-backed on Android) | Locked, matches driver app |
| react-native-maps | `1.27.2` | Not rendered until Phase 3, but the dependency + config-plugin block should be added now (see Common Pitfalls) | Locked shared-key project convention |

### Test tooling (new for this phase — driver app retrofitted this later, this app starts with it)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|---------------|
| jest-expo | `^57.0.4` | Jest preset mocking Expo/RN native modules | Re-verified live via `npm view jest-expo dist-tags` today (2026-08-11): `latest`=`next`=`57.0.4`. `57.0.0` had a broken peer on `@react-native/jest-preset@^0.85.0` vs this repo's RN `0.86.2` — fixed in `57.0.1`+. |
| jest | `~29.7.0` | Test runner | `npm view jest dist-tags.latest` today = `30.4.2` — **do not take latest**. `jest-expo@57.0.4`'s own bundled sub-deps (`jest-snapshot`, `babel-jest`, `@jest/globals`) are still on the `29.2.1` line. |
| @react-native/jest-preset | `^0.86.2` | RN-specific transform/mock preset, peer of `jest-expo` | Re-verified live today: npm `latest` dist-tag is actually `0.86.2` (matches RN exactly) as of this check — `jest-expo` only declares it as a `peerDependency`, so it must be installed explicitly regardless. Pin explicitly rather than relying on the dist-tag, since `next`/`nightly` tags on this package move ahead of stable RN releases. |
| @testing-library/react-native | `^14.0.1` | Component/hook rendering + queries | Confirmed current `latest` today. Peers: `react >=19.0.0`, `react-native >=0.78`, `test-renderer ^1.0.0` — all satisfied by this stack. |
| test-renderer | `^1.2.0` | Shim RNTL v14 depends on in place of deprecated `react-test-renderer` under React 19 | Peer dependency of RNTL, not always auto-resolved — add explicitly, matches driver app. |
| @types/jest | latest matching `~29.x` | TS types for Jest globals | Only needed if not using `@jest/globals` imports directly. |

**Installation:**
```bash
npx create-expo-app@latest . --template blank-typescript
# (or equivalent — see Architecture Patterns for exact scaffold approach)

npx expo install expo-router expo-secure-store expo-splash-screen react-native-maps
npm install @tanstack/react-query zustand react-hook-form zod @hookform/resolvers
npm install nativewind@^4.2.6
npm install -D tailwindcss@^3.4.19

# Test tooling — from Phase 1, not retrofitted:
npx expo install jest-expo jest --dev
npm install -D @react-native/jest-preset@^0.86.2 @testing-library/react-native@^14.0.1 test-renderer@^1.2.0 @types/jest
```

**Version verification performed 2026-08-11 (today):**
- `jest-expo` dist-tags: `{latest: '57.0.4', next: '57.0.4'}` ✓ matches STACK.md
- `jest` dist-tags.latest: `30.4.2` — confirms pin to `~29.7.0` is required, not optional ✓
- `@testing-library/react-native` dist-tags.latest: `14.0.1` ✓ matches STACK.md
- `@react-native/jest-preset` dist-tags: `{latest: '0.86.2', next: '0.87.0-rc.4', nightly: '0.88.0-nightly-...'}` — `latest` itself is currently `0.86.2` and matches RN's locked version exactly; still pin explicitly since `next`/`nightly` move independently of RN releases.
- `expo` dist-tags.latest: `57.0.12` (patch-ahead of, and compatible with, the locked `~57.0.9` range)

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Copying `go-ride-driver-app`'s theme/components file-by-file | A shared monorepo package between the two apps | Explicitly deferred per CONTEXT.md/PROJECT.md until a future joint brand pass — two separate git repos, premature coupling right now |
| `jest-expo/android` preset | Bare `jest-expo` preset | Contradicts the driver app's actual shipped, working config; the platform-scoped preset avoids pulling in iOS-only native mock surface this Android-first app doesn't need |
| Hand-rolled `decodeJwtExpiryMs` (base64url decode of the JWT payload) | A JWT library (e.g. `jwt-decode`) | Driver app avoided a dependency for something this small (~30 lines) and avoided assuming `atob`/Buffer availability under Hermes — same reasoning applies here, no verification is needed client-side, only reading the `exp` claim |

## Architecture Patterns

### Recommended Project Structure
```
src/
├── app/                          # expo-router file-based routes
│   ├── _layout.tsx                # Root: QueryClientProvider, session hydrate, Stack.Protected guard
│   ├── (auth)/
│   │   ├── _layout.tsx
│   │   ├── login.tsx
│   │   └── signup.tsx
│   └── (app)/
│       ├── _layout.tsx            # Renders <SessionExpiryBanner /> once, above the tab stack
│       └── (tabs)/
│           ├── _layout.tsx        # Home + Profile tabs only, per CONTEXT.md
│           ├── index.tsx          # Home placeholder ("Booking a ride is coming soon")
│           └── profile/
│               ├── _layout.tsx
│               ├── index.tsx      # ProfileView (read-only email, name, account_status badge)
│               ├── edit.tsx       # EditProfileForm (name only)
│               └── change-password.tsx   # NEW — no driver-app precedent
├── api/
│   ├── http-client.ts             # apiRequest<T>() wrapper — copy verbatim
│   ├── auth-client.ts             # signup/login — ADAPT (different paths, no /driver prefix)
│   ├── profile-client.ts          # NEW — getProfile/updateProfile/changePassword (rider has no separate "driver-client" split; consider folding all rider auth+profile calls into one client file)
│   ├── query-client.ts            # copy verbatim
│   └── types.ts                   # ADAPT — rider DTOs differ from driver DTOs (see Code Examples)
├── features/
│   └── auth/
│       ├── api.ts                 # useSignupMutation/useLoginMutation — copy pattern, adapt payload/response types
│       ├── schemas.ts             # signupSchema/loginSchema — copy pattern, values already match (email/password/first_name/last_name)
│       └── components/
│           ├── LoginForm.tsx      # copy structure
│           ├── SignupForm.tsx     # copy structure
│           └── SessionExpiryBanner.tsx  # copy verbatim (same 60-min/no-refresh-token situation)
│   └── profile/
│       ├── api.ts                 # useProfileQuery/useUpdateProfileMutation/useChangePasswordMutation (new)
│       ├── schemas.ts             # editProfileSchema + NEW changePasswordSchema
│       ├── logout.ts              # SIMPLER than driver app — no online-status best-effort call
│       └── components/
│           ├── ProfileView.tsx
│           ├── AccountStatusBadge.tsx  # ADAPT — 2 values (active/deactivated), not 3
│           ├── EditProfileForm.tsx
│           └── ChangePasswordForm.tsx  # NEW
├── lib/
│   ├── jwt.ts                     # decodeJwtExpiryMs — copy verbatim
│   └── secure-store.ts            # copy verbatim, change the storage KEY constant (e.g. 'go-ride-rider-token')
├── stores/
│   └── session-store.ts           # copy verbatim (rename `driver` field to `user` or `rider` throughout)
├── components/                    # Button, Card, Badge, TextInput, Select, Banner, ConfirmDialog, EmptyState — copy verbatim
├── theme/                         # colors.js, radii.ts, spacing.ts, tokens.ts — copy verbatim
└── test-utils/                    # NEW — this app builds it from Phase 1, driver app only has it from its later KYC phase
    ├── query-wrapper.tsx           # createTestQueryClient() / createQueryWrapper() — copy verbatim pattern
    └── auth-fixtures.ts            # makeUser(), makeLoginResult(), etc. — new, rider-shaped
```

### Pattern 1: Wrapped-Response API Client with Component-Level Unwrap
**What:** The rider backend wraps `GET /me` and `PATCH /profile` responses as `{"user": {...}}` (confirmed directly in `auth_handler.go`: `c.JSON(http.StatusOK, gin.H{"user": response})` for both `Me` and `UpdateProfile`). Rather than unwrapping inside the API client function, keep the wrapper in the TypeScript return type and unwrap at the point of use (query result destructuring / component render) — this is exactly what the driver app already does for its own (differently-named) `{driver: Driver}` wrapper.
**When to use:** Every rider profile-read/-write call in this phase.
**Example:**
```typescript
// Source: go-ride-driver-app/src/api/driver-client.ts + src/features/profile/components/ProfileView.tsx (pattern), adapted field names per go-ride-backend/application/user/dto.go
// src/api/profile-client.ts
export const profileClient = {
  getProfile: () => apiRequest<{ user: User }>('/me'),
  updateProfile: (payload: UpdateProfilePayload) =>
    apiRequest<{ user: User }>('/profile', { method: 'PATCH', body: payload }),
  changePassword: (payload: ChangePasswordPayload) =>
    apiRequest<{ message: string }>('/change-password', { method: 'POST', body: payload }),
};

// src/features/profile/components/ProfileView.tsx
const { data, isLoading } = useProfileQuery();
// ...
const { user } = data; // unwrap here, not in the client
```

### Pattern 2: Signup-Then-Login Chain (No Token on Signup)
**What:** `POST /api/v1/auth/signup` returns `201 {user: UserResponse}` with no `access_token` (confirmed in `application/user/dto.go`: `SignupResponse{User UserResponse}`). The mutation must chain an immediate `login()` call with the same credentials to actually authenticate the rider, and must surface a distinct error if signup succeeded but the chained login failed (account exists — route to Login, not a generic error).
**When to use:** `useSignupMutation` (AUTH-01).
**Example:**
```typescript
// Source: go-ride-driver-app/src/features/auth/api.ts — copy this pattern verbatim, only the payload/response types differ
export class SignupSucceededLoginFailedError extends Error {
  email: string;
  constructor(email: string) {
    super('Account created — please log in.');
    this.email = email;
  }
}

export function useSignupMutation() {
  return useMutation({
    mutationFn: async (payload: SignupPayload) => {
      await authClient.signup(payload);
      try {
        return await authClient.login({ email: payload.email, password: payload.password });
      } catch {
        throw new SignupSucceededLoginFailedError(payload.email);
      }
    },
    onSuccess: ({ access_token, user }) => {
      useSessionStore.getState().setSession(access_token, user);
    },
  });
}
```

### Pattern 3: Session Store as a Synchronous In-Memory Mirror of SecureStore
**What:** Zustand store holds `{status, token, tokenExpiresAt, user, sessionExpiredReason}` with NO `zustand/persist` — the token's single source of truth is `expo-secure-store`; the store is hydrated once at boot (`hydrate()` reads SecureStore, decodes JWT expiry, sets in-memory state) and mutated synchronously thereafter. `tokenExpiresAt` (decoded once, cached) drives both the `SessionExpiryBanner` and the `Stack.Protected` route guard.
**When to use:** AUTH-02, AUTH-06, the root `_layout.tsx` guard.
**Example:** See `go-ride-driver-app/src/stores/session-store.ts` (read in full during this research) — copy verbatim, renaming the `driver` field/type references to `user`/`User`.

### Pattern 4: Centralized 401 Handling in the HTTP Client, Not Per-Screen
**What:** `apiRequest<T>()` checks `response.status === 401 && !skipAuth` and calls `useSessionStore.getState().clearSession('Your session ended. Please log in again.')` directly inside the shared client, rather than every screen/hook handling 401 individually. The `Stack.Protected` guard then redirects based on `status`.
**When to use:** Copy `http-client.ts` verbatim — no rider-specific changes needed here at all (the `ApiErrorBody{code, message}` flat shape is the same `pkg/apperror` convention on both driver and rider backends — verify this in Wave 0 by hitting one real error response, e.g. duplicate signup, but there is no reason to expect it differs).

### Pattern 5: Route Guard via `Stack.Protected`
**What:** Root `_layout.tsx` returns `null` while `status === 'unknown'` (still hydrating), then renders exactly one of `(auth)` or `(app)` behind `Stack.Protected guard={...}`, never both.
**When to use:** Copy `go-ride-driver-app/src/app/_layout.tsx` verbatim (see Code Examples) — no rider-specific changes needed except renaming `driver` references.

### Anti-Patterns to Avoid
- **Unwrapping the `{"user": ...}` envelope inside the API client function:** Keep the wrapper in the return type; unwrapping too early makes it easy to silently regress if a future endpoint returns a differently-named wrapper (e.g. if the backend later adds a paginated list response) — the driver app's own convention (keep the wrapper, unwrap at the query-result/component boundary) is deliberate, not an oversight.
- **Persisting the token via `zustand/persist` + AsyncStorage/MMKV:** Only `expo-secure-store` should ever touch the raw JWT — this is called out as Anti-Pattern 3 in the driver app's own `ARCHITECTURE.md` research and the same reasoning applies here unchanged.
- **Building a bespoke "your account is deactivated" screen/flow:** CONTEXT.md explicitly defers this — a deactivated login rejection should surface through the same generic API-error banner as any other login failure, nothing bespoke.
- **Forcing re-login after a successful password change:** The backend returns a simple `{message}` with no session-invalidation semantics — CONTEXT.md explicitly says do not force re-login.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| Secure JWT storage on Android | A custom encrypted-storage wrapper | `expo-secure-store` (Android Keystore-backed) | Already the locked, verified pattern from the driver app; reinventing this for "just this app" adds risk with zero benefit |
| JWT expiry countdown/banner timing | A new component design | Copy `SessionExpiryBanner.tsx` verbatim (5-min warning window, 30s tick, dismiss-resets-on-token-change logic) | Already built, already handles the "dismiss should reset if the user re-logs in" edge case correctly |
| Form validation matching backend rules | Ad-hoc inline validation | zod schemas mirroring the backend's `validate` struct tags exactly (e.g. `password min=8` on both signup and login, `first_name`/`last_name` `min=2,max=100`) | Keeps client-side rejection in sync with server-side rejection so users don't hit a confusing 400 for a case the client silently allowed |
| Test QueryClient setup for mutation tests | A fresh `QueryClient` per test file with default options | `createTestQueryClient()` (retry: false, gcTime: 0 on both queries and mutations) | The default 5-minute mutation `gcTime` schedules a real `setTimeout` that outlives the test and leaves Jest unable to exit cleanly — this is a real, previously-hit problem in the driver app's own KYC test suite, not a hypothetical |

**Key insight:** Every "hand-roll or use a library" decision in this domain has already been made and proven in a working sibling app hitting the same backend. The only genuinely new work is the six backend-contract-different pieces (routes, wrapped envelope, change-password, 2-value account status) — everything else is a copy-and-rename exercise, and treating it as anything more is wasted effort.

## Common Pitfalls

### Pitfall 1: Assuming the Wrapped `{"user": ...}` Envelope Applies Uniformly
**What goes wrong:** `GET /me` and `PATCH /profile` are wrapped (`{"user": {...}}`), but `POST /change-password` is NOT wrapped in the same way — it returns a bare `{message: string}` (`ChangePasswordResponse{Message string}`), and `POST /auth/signup`/`POST /auth/login` wrap under a different key each (`{user: ...}` for signup, `{access_token, user: ...}` for login — `user` here is NOT further nested). A type that assumes one universal envelope shape across all four endpoints will be wrong for at least one of them.
**Why it happens:** It's tempting to write one generic `ApiResponse<T> = {user: T}` type and reuse it everywhere once you've confirmed the pattern on one endpoint.
**How to avoid:** Type each endpoint's response individually against the actual DTO (see Code Examples below, all confirmed directly against `go-ride-backend/application/user/dto.go` and `interfaces/http/handlers/auth_handler.go`), not against an assumed shared wrapper type.
**Warning signs:** A `.message` or `.user` access that TypeScript doesn't flag as an error but that returns `undefined` at runtime on one specific endpoint.

### Pitfall 2: Reusing the Driver App's 3-Value `AccountStatus` Type
**What goes wrong:** The driver app's `AccountStatus = 'pending' | 'active' | 'blocked'`. The rider's is `'active' | 'deactivated'` only (confirmed in `domain/user/entity.go`: `AccountStatusActive = "active"`, `AccountStatusDeactivated = "deactivated"`, no `pending`/`blocked` equivalents exist for riders). A copy-pasted `AccountStatusBadge` component built against the driver's 3-value enum will either fail to compile against the narrower rider type or, worse, silently accept a value the rider backend will never actually send.
**Why it happens:** Straight copy-paste of `types.ts` and `AccountStatusBadge.tsx` without adjusting the union type.
**How to avoid:** Define `AccountStatus = 'active' | 'deactivated'` freshly for this app; don't extend or reuse the driver app's type.
**Warning signs:** A switch/badge-color mapping with a `pending` or `blocked` case that's dead code.

### Pitfall 3: Registering Only the "Right" SHA-1, Not the Local Debug One (EAS Assumption Carried Over From PITFALLS.md)
**What goes wrong:** This project's own `.planning/research/PITFALLS.md` (Pitfall 8) and `.planning/STATE.md`'s "Blockers/Concerns" both describe verification against "a real EAS production build." **That assumption is stale for this project as of this session** — the developer has explicitly locked this project to local-only builds (`npx expo run:android`, no EAS cloud builds: "the free tier expo is very slow, the build will be in my laptop, i have jdk installed"). A local `npx expo run:android` build is signed with the **local debug keystore** (auto-created at `~/.android/debug.keystore`, default alias `androiddebugkey`, default password `android`), which has a completely different SHA-1 fingerprint than any EAS-managed credential. If the Maps key is only restricted to an EAS SHA-1 that this project will never actually produce, the map will show blank/crash the very first time it's tested locally.
**Why it happens:** The roadmap's Phase 1 goal text and the PITFALLS.md research doc were both written/generalized before this session's explicit "local builds only" clarification.
**How to avoid:**
1. Run `npx expo run:android` once (or `npx expo prebuild --platform android` alone) to generate the `android/` directory and auto-create `~/.android/debug.keystore` if it doesn't already exist.
2. Get the local debug SHA-1: `keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android` (or `cd android && ./gradlew signingReport`, which lists SHA-1 for all variants including `debug`).
3. Register that SHA-1 (plus the Android package name, e.g. `com.goride.rider`) against the restricted Maps API key in Google Cloud Console — do this in addition to, not instead of, whatever SHA-1(s) the sibling driver app may have already registered (they're on a shared Google Cloud project per PROJECT.md, but each app has its own package name and its own local debug keystore, since each was scaffolded independently).
4. If a physical release build is ever produced later (not in this phase's scope), that will need its own release-keystore SHA-1 registered too — this phase only needs the local debug one.
**Warning signs:** Blank map with just a Google logo, or a Play-Services "API key not found"/`AuthorizationException` at runtime, despite the key clearly being present in the manifest.

### Pitfall 4: `app.json` (Static JSON) Cannot Resolve `process.env.X` References for Native Config-Plugin Fields
**What goes wrong:** Confirmed directly by reading `react-native-maps`'s installed config plugin source (`node_modules/react-native-maps/plugin/build/android.js`): the plugin takes whatever literal string is passed as `androidGoogleMapsApiKey` and writes it verbatim into `AndroidManifest.xml` as the `com.google.android.geo.API_KEY` meta-data value — `addMetaDataItemToMainApplication(mainApplication, 'com.google.android.geo.API_KEY', props.androidGoogleMapsApiKey)`. If `app.json` (plain JSON, never evaluated as JS) contains the literal text `"process.env.GOOGLE_MAPS_API_KEY"` as the value, that literal string — not the resolved env var — ends up in the manifest. The map then fails with a key that looks present but is actually the string `process.env.GOOGLE_MAPS_API_KEY`.
**Why it happens:** JSON has no concept of variable interpolation; only `app.config.js`/`app.config.ts` (evaluated as real JS, where `process.env.X` genuinely reads the environment at prebuild time) can resolve this correctly.
**How to avoid:** Either (a) convert to `app.config.js`, load `.env` via `dotenv` at the top, and reference `process.env.GOOGLE_MAPS_API_KEY` inside the JS config object (resolves correctly since the file itself is executed), or (b) hardcode the literal key value directly in `app.json` — acceptable per this project's own PITFALLS.md given the key is already SHA-1/package-restricted and the repo is private, though rotation is harder. After either approach, **verify** by grepping the generated file: `grep -A1 "com.google.android.geo.API_KEY" android/app/src/main/AndroidManifest.xml` and confirming the value is the real key, not a placeholder string.
**Warning signs:** Manifest grep shows `android:value="process.env.GOOGLE_MAPS_API_KEY"` literally, or an empty/missing meta-data entry (which happens silently if the config-plugin prop was `undefined` — the plugin's `else` branch just removes the entry, no error).

### Pitfall 5: No Emulator Currently Installed — Verification Path Must Be Decided Before Planning "Verify the Build" Tasks
**What goes wrong:** This machine has JDK 17 and Android SDK cmdline-tools/platform-tools/build-tools (`android-35`, `android-36`, build-tools `35.0.0`/`36.0.0`) but **zero system-images and no `emulator` binary** — confirmed by listing `$ANDROID_HOME/system-images/` (empty) and `which emulator` (not found). A task that says "run and verify on an emulator" without first installing one will stall.
**Why it happens:** cmdline-tools-only Android SDK installs (vs. Android Studio's full install) don't include the emulator package or any system images by default.
**How to avoid:** Before planning a "verify locally" task, decide explicitly: (a) use a physical Android device over USB with Developer Options → USB debugging enabled (`adb devices` should list it; this needs no additional downloads and is the faster path), or (b) install an emulator: `sdkmanager --install "emulator" "system-images;android-35;google_apis;x86_64"` then `avdmanager create avd -n test -k "system-images;android-35;google_apis;x86_64"` (multi-hundred-MB download, budget real time for this if no physical device is available).
**Warning signs:** A plan task that says "run `npx expo run:android`" with no prior step establishing which target device/emulator will receive the build.

### Pitfall 6: Physical-Device Networking — `10.0.2.2` Only Works on the Emulator
**What goes wrong:** The already-established `EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:8080/api/v1` convention (copied from the driver app's `.env.example`) is an Android-emulator-only loopback alias to the host machine. A physical device on the same Wi-Fi network cannot reach `10.0.2.2` — it needs the host machine's actual LAN IP, or `adb reverse tcp:8080 tcp:8080` (works over USB regardless of Wi-Fi).
**Why it happens:** The `.env.example` convention was set for emulator-based dev; verifying via physical device (the likely path here, since no emulator is installed) needs a different value.
**How to avoid:** If verifying via physical device, either run `adb reverse tcp:8080 tcp:8080` (then `10.0.2.2`... no — use `localhost:8080` after the reverse tunnel) or set `EXPO_PUBLIC_API_BASE_URL` to the host's LAN IP (`http://192.168.x.x:8080/api/v1`) in a local, gitignored `.env` — document which approach was used so the next verification pass doesn't have to rediscover this.
**Warning signs:** Every API call fails with a connection-refused/timeout error on physical-device testing despite the backend clearly running locally.

### Pitfall 7: `renderHook`/`render` Are Async in RNTL v14 — Missing `await` Causes Flaky, Not Failing, Tests
**What goes wrong:** `@testing-library/react-native@14.x` made `render()` and `renderHook()` return Promises (to correctly flush `act()`/concurrent-mode work before assertions run). Code written against older RNTL habits (`const {result} = renderHook(...)` without `await`) will often still "pass" locally because of timing luck, then flake intermittently, especially around `waitFor`/mutation-settling assertions.
**Why it happens:** This is a real, recent breaking change in the testing library itself, not a project-specific quirk — easy to miss if muscle memory comes from RNTL v12/v13 examples.
**How to avoid:** Always `await render(...)` and `await renderHook(...)` — confirmed as the actual pattern already in use in `go-ride-driver-app`'s existing KYC test suite (every `render(...)` call there is `await`ed).
**Warning signs:** `act(...)` warnings in test output; tests that pass alone but fail when run in the same file as others; assertions on `result.current` that read stale values.

### Pitfall 8: Mutation `gcTime` Left at Its 5-Minute Default in Tests Leaves Jest Hanging
**What goes wrong:** TanStack Query's default mutation `gcTime` is 5 minutes — a mutation-hook test using a plain `new QueryClient()` (not a test-tuned one) schedules a real `setTimeout` that Jest's process doesn't naturally wait on, but which can leave handles open and force `--detectOpenHandles`/hanging-test symptoms depending on Jest's teardown mode.
**Why it happens:** The production `QueryClient` config is correctly tuned for production; a naive test reuses it wholesale instead of a test-specific client.
**How to avoid:** Always build test `QueryClient`s via a shared `createTestQueryClient()` helper with `gcTime: 0` on both `queries` and `mutations`, and `retry: false` — exact pattern already proven in `go-ride-driver-app/src/test-utils/query-wrapper.tsx` (read directly during this research).
**Warning signs:** Jest hangs after all tests report as passed, or requires `--forceExit`.

## Code Examples

Verified patterns, cross-checked directly against the driver app's actual source and `go-ride-backend`'s actual DTOs/handlers (not training-data assumptions):

### Rider API types (adapt from driver app's `types.ts`, all fields confirmed against `go-ride-backend/application/user/dto.go` and `domain/user/entity.go`)
```typescript
// Source: go-ride-backend/application/user/dto.go + domain/user/entity.go, read directly 2026-08-11
export type AccountStatus = 'active' | 'deactivated'; // NOT the driver app's 3-value enum

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  account_status: AccountStatus;
  // no is_email_verified — does not exist on the rider entity, do not add it
}

export interface SignupPayload {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface LoginResult {
  access_token: string;
  user: User;
}

export interface UpdateProfilePayload {
  first_name: string;
  last_name: string;
}

export interface ChangePasswordPayload {
  old_password: string;
  new_password: string;
}

// Flat {code, message} — same go-ride-backend/pkg/apperror shape as the driver side
export interface ApiErrorBody {
  code: string;
  message: string;
}
```

### Rider auth client (routes confirmed against `go-ride-backend/interfaces/http/routes/auth_routes.go`)
```typescript
// Source: go-ride-driver-app/src/api/auth-client.ts pattern, paths adapted per auth_routes.go
// NOTE: no "/driver" or "/user" prefix segment — routes are mounted directly under /api/v1
export const authClient = {
  signup: (payload: SignupPayload) =>
    apiRequest<{ user: User }>('/auth/signup', { method: 'POST', body: payload, skipAuth: true }),
  login: (payload: LoginPayload) =>
    apiRequest<LoginResult>('/auth/login', { method: 'POST', body: payload, skipAuth: true }),
};

export const profileClient = {
  getProfile: () => apiRequest<{ user: User }>('/me'),
  updateProfile: (payload: UpdateProfilePayload) =>
    apiRequest<{ user: User }>('/profile', { method: 'PATCH', body: payload }),
  changePassword: (payload: ChangePasswordPayload) =>
    apiRequest<{ message: string }>('/change-password', { method: 'POST', body: payload }),
};
```

### Simplified rider logout (no online-status best-effort call, unlike the driver app)
```typescript
// Source: go-ride-driver-app/src/features/profile/logout.ts, simplified — riders have no is_online concept
export function useLogout() {
  const queryClient = useQueryClient();
  return async () => {
    await useSessionStore.getState().clearSession();
    queryClient.clear();
    router.replace('/(auth)/login');
  };
}
```

### jest.config.js — mirror the driver app's actual shipped config exactly
```javascript
// Source: go-ride-driver-app/jest.config.js, read directly 2026-08-11
module.exports = {
  preset: 'jest-expo/android',
  testPathIgnorePatterns: ['/node_modules/', '/android/', '/.expo/', '/dist/'],
};
```

### Test-tuned QueryClient (prevents hanging tests — Pitfall 8)
```typescript
// Source: go-ride-driver-app/src/test-utils/query-wrapper.tsx, read directly 2026-08-11
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false, gcTime: 0 },
    },
  });
}
export function createQueryWrapper(client: QueryClient) {
  return function QueryWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}
```

### Async render/renderHook pattern (RNTL v14 — Pitfall 7)
```typescript
// Source: go-ride-driver-app/src/features/kyc/components/DocumentTile.test.tsx, read directly 2026-08-11
it('renders correctly', async () => {
  await render(<SomeComponent {...props} />);
  expect(screen.getByText('...')).toBeTruthy();
});

it('exercises a mutation hook', async () => {
  const client = createTestQueryClient();
  const { result } = await renderHook(() => useSomeMutation(), {
    wrapper: createQueryWrapper(client),
  });
  await act(async () => {
    await result.current.mutateAsync({ /* ... */ });
  });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|-------------------|---------------|--------|
| `react-test-renderer` as RNTL's rendering shim | `test-renderer` package | RNTL v14 / React 19 | Install `test-renderer`, not `react-test-renderer`, as the peer devDependency |
| Synchronous `render()`/`renderHook()` | Both return Promises, must be `await`ed | RNTL v14 | Every test call site needs `await` — see Pitfall 7 |
| Manual `android.config.googleMaps.apiKey` field in `app.json` (pre-plugin era) | `react-native-maps`'s own Expo config plugin (`plugins: [["react-native-maps", {androidGoogleMapsApiKey: "..."}]]`) | `react-native-maps >= 1.22`, requires Expo SDK >= 53 | This project's locked `1.27.2` supports the plugin form; use it, not the older manual manifest-field approach |

**Deprecated/outdated:**
- `react-test-renderer` as a direct devDependency for RNTL — superseded by `test-renderer` for React 19 compatibility.
- The assumption (carried in this project's own PITFALLS.md and STATE.md, written before this session's clarification) that Maps-key verification happens against an EAS production build — superseded by explicit local-build-only direction; see Pitfall 3.

## Open Questions

1. **Exact Android package name / bundle identifier for this app**
   - What we know: The driver app uses `com.goride.driver`; PROJECT.md doesn't state the rider app's package name anywhere researched.
   - What's unclear: Whether `com.goride.rider`, `com.goride.user`, or something else is intended — this affects both the Google Cloud Console API-key restriction entry and the `app.json`/`app.config.js` `android.package` field.
   - Recommendation: Planner should pick one (e.g. `com.goride.rider`, matching the driver app's `com.goride.driver` naming convention) during scaffolding and register exactly that in Google Cloud Console — this is a five-minute decision, not a research gap, but must be made explicitly and recorded rather than left to whatever `create-expo-app` defaults to.

2. **Whether to hardcode the Maps key in `app.json` or migrate to `app.config.js` with `.env`**
   - What we know: Both are technically viable (Pitfall 4); this project's own PITFALLS.md explicitly calls hardcoding "acceptable short-term" given the key is already SHA-1/package-restricted and the repo is private.
   - What's unclear: No locked decision exists either way in CONTEXT.md (not raised as a discussion topic — the CONTEXT.md decisions are silent on this specific mechanism).
   - Recommendation: Default to `app.config.js` + `.env` (matches the already-established `EXPO_PUBLIC_API_BASE_URL` convention of keeping config out of committed JSON, and is barely more work than hardcoding) unless the planner judges the extra file conversion isn't worth it for a key that's already defense-in-depth restricted — either choice is reasonable, flag the choice made in the plan so it's not silently inconsistent with `.env.example`'s existing pattern.

3. **Whether a physical Android device is actually available for this session's verification, or an emulator must be installed**
   - What we know: No emulator/system-image is currently installed on this machine; `adb devices` was not run during this research pass (no device was connected at research time) so device availability is unconfirmed either way.
   - What's unclear: Which path (physical device vs. fresh emulator install) the implementation session will actually use.
   - Recommendation: The plan's verification task should check `adb devices` first and branch: if a device is listed, use it (faster, zero extra downloads); if not, install a minimal AVD via `sdkmanager`/`avdmanager` (commands in Pitfall 5) — don't assume either path silently, since the emulator install alone can take significant time on a slow connection.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest `~29.7.0` + `jest-expo/android` preset + `@testing-library/react-native@^14.0.1` |
| Config file | `jest.config.js` — does not exist yet (Wave 0, this is a from-scratch repo) |
| Quick run command | `npx jest <path/to/file>.test.ts(x) --watchAll=false` |
| Full suite command | `npm test` (maps to `jest --watchAll=false`, matching the driver app's `package.json` script) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|---------------------|--------------|
| AUTH-01 | `signupSchema` rejects short password / invalid email; `useSignupMutation` chains signup→login and sets session on success; `SignupSucceededLoginFailedError` thrown when chained login fails | unit + hook | `npx jest src/features/auth/schemas.test.ts src/features/auth/api.test.ts --watchAll=false` | ❌ Wave 0 |
| AUTH-02 | `tokenStorage` round-trips via SecureStore mock; `useSessionStore.hydrate()` restores `authenticated` status from a valid stored token and clears an expired one; `useLoginMutation` sets session on success | unit + store | `npx jest src/lib/secure-store.test.ts src/stores/session-store.test.ts src/features/auth/api.test.ts --watchAll=false` | ❌ Wave 0 |
| AUTH-03 | `useProfileQuery` unwraps `{user: ...}`; `ProfileView` renders name/email/status badge from the wrapped shape; `useUpdateProfileMutation` sends only `first_name`/`last_name`; `AccountStatusBadge` renders correctly for both `active` and `deactivated` (not a 3rd value) | unit + component | `npx jest src/features/profile --watchAll=false` | ❌ Wave 0 |
| AUTH-04 | `useLogout` clears session, clears query cache, redirects to `/(auth)/login` — with no online-status side call (unlike driver app) | unit | `npx jest src/features/profile/logout.test.ts --watchAll=false` | ❌ Wave 0 |
| AUTH-05 | `useChangePasswordMutation` posts `{old_password, new_password}` to `/change-password`, does NOT trigger `clearSession`/re-login on success; `ChangePasswordForm` shows success banner and doesn't navigate away except back to Profile | unit + component | `npx jest src/features/profile/api.test.ts src/features/profile/components/ChangePasswordForm.test.tsx --watchAll=false` | ❌ Wave 0 |
| AUTH-06 | `SessionExpiryBanner` renders nothing outside the 5-min window, renders the warning inside it, hides after dismiss, and resets `dismissed` if `tokenExpiresAt` changes (re-login case) | component (fake timers) | `npx jest src/features/auth/components/SessionExpiryBanner.test.tsx --watchAll=false` | ❌ Wave 0 |
| (cross-cutting) | `apiRequest` calls `clearSession('Your session ended...')` on a real 401 and does NOT on a `skipAuth` request | unit | `npx jest src/api/http-client.test.ts --watchAll=false` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** targeted `npx jest <relevant file(s)> --watchAll=false`
- **Per wave merge:** `npm test` (full suite)
- **Phase gate:** Full suite green before `/gsd:verify-work`, plus the manual local-build verification pass (sign up → log in → close/reopen app → profile view/edit → change password → log out, on a real Android device or emulator, per Pitfall 5/6)

### Wave 0 Gaps
- [ ] `package.json` + `jest.config.js` + `babel.config.js` — none exist yet, repo is currently empty (only `.git`, `AGENTS.md`, `BRIEFING.md`, `.planning/`)
- [ ] `src/test-utils/query-wrapper.tsx` — `createTestQueryClient()`/`createQueryWrapper()`, copy pattern from driver app
- [ ] `src/test-utils/auth-fixtures.ts` — `makeUser()`, `makeLoginResult()`, etc. (rider-shaped, new — no direct driver-app equivalent since driver fixtures are KYC-shaped)
- [ ] Framework install: `npx expo install jest-expo jest --dev && npm install -D @react-native/jest-preset@^0.86.2 @testing-library/react-native@^14.0.1 test-renderer@^1.2.0 @types/jest`
- [ ] `expo-secure-store` mock — verify `jest-expo/android` mocks it automatically (it should, since it mocks Expo native modules broadly), but confirm with one trivial passing test before relying on it across the session-store test suite

## Sources

### Primary (HIGH confidence)
- `go-ride-user-app/.planning/phases/01-foundation-auth/01-CONTEXT.md` — locked decisions for this phase
- `go-ride-user-app/.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `.planning/STATE.md`, `.planning/PROJECT.md`, `.planning/config.json` — read directly
- `go-ride-user-app/.planning/research/STACK.md`, `PITFALLS.md` — read directly, cross-referenced against live npm checks
- `go-ride-backend/interfaces/http/routes/auth_routes.go` — read directly, confirms exact route paths and mounting
- `go-ride-backend/application/user/dto.go` — read directly, confirms all rider DTO shapes
- `go-ride-backend/interfaces/http/handlers/auth_handler.go` — read directly, confirms the `{"user": ...}` wrapping on `Me`/`UpdateProfile` specifically (vs. bare on `ChangePassword`)
- `go-ride-backend/domain/user/entity.go` — read directly, confirms 2-value `AccountStatus` enum, no `is_email_verified` field
- `go-ride-backend/infrastructure/security/jwt.go` — read directly, confirms `aud=go-ride-clients` for riders, no refresh mechanism in this file
- `go-ride-backend/internal/config/config.go` + `.env.example` — read directly, confirms `JWT_EXPIRY_MINUTES` defaults to 60
- `go-ride-driver-app/package.json`, `jest.config.js`, `babel.config.js` — read directly, ground truth for exact shipped versions/config
- `go-ride-driver-app/src/{api,app,components,features,lib,stores,theme,test-utils}/**` — read directly (http-client.ts, auth-client.ts, types.ts, jwt.ts, secure-store.ts, session-store.ts, features/auth/{api,schemas}.ts, SessionExpiryBanner.tsx, features/profile/{api,logout}.ts + components, app/_layout.tsx and route-group layouts, Button.tsx, Banner.tsx, colors.js, tokens.ts, test-utils/{query-wrapper,kyc-fixtures}, kyc test files for RNTL v14 patterns)
- `go-ride-driver-app/.planning/phases/01-foundation-auth-profile-vehicles/01-CONTEXT.md` — the driver app's own settled Phase 1 decisions this phase mirrors
- `node_modules/react-native-maps/plugin/build/android.js` (in `go-ride-driver-app`, same locked version `1.27.2` this app will use) — read directly, confirms the config plugin's literal (non-interpolating) handling of `androidGoogleMapsApiKey`
- Live npm registry checks (2026-08-11, via `npm view`): `jest-expo` dist-tags, `jest` dist-tags.latest, `@testing-library/react-native` dist-tags.latest, `@react-native/jest-preset` dist-tags, `expo` dist-tags
- Local environment checks (2026-08-11): `java -version` (OpenJDK 17.0.20), `$ANDROID_HOME` contents (platforms `android-35`/`android-36`, build-tools `35.0.0`/`36.0.0`, no system-images, `sdkmanager`/`avdmanager`/`adb` present, `emulator` absent)

### Secondary (MEDIUM confidence)
- [react-native-maps installation docs](https://github.com/react-native-maps/react-native-maps/blob/master/docs/installation.md) — WebSearch result, config-plugin field name and version requirements (`androidGoogleMapsApiKey`, requires `react-native-maps >= 1.22` and Expo SDK `>= 53`), cross-verified against the actually-installed plugin source in `node_modules` (matches)

### Tertiary (LOW confidence)
- None — every claim in this document was either read directly from source code in this session or verified live against the npm registry.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every version pin cross-checked live against npm today, not carried over from training data
- Architecture: HIGH — copied directly from a working sibling implementation hitting the same backend, not derived from general Expo/RN knowledge
- Backend contract (routes/DTOs/wrapping): HIGH — read directly from `go-ride-backend` Go source, not inferred
- Local build / Maps SHA-1 path: HIGH — corrected in this research from a stale EAS assumption to the actual local-build-only direction, verified against the actual local JDK/SDK environment and the actual installed config-plugin source
- Pitfalls: HIGH for backend-contract and RNTL-version pitfalls (directly sourced); MEDIUM for the general Maps-key config-plugin field name (WebSearch-sourced but cross-verified against locally installed plugin source, so effectively HIGH)

**Research date:** 2026-08-11
**Valid until:** ~30 days for the architecture/pattern guidance (stable, sibling-app-proven); ~7-14 days for the exact npm version pins (jest-expo/jest-preset move fast on a live SDK line) — re-verify pins with `npm view <pkg> dist-tags` if planning is delayed past that window.

---
*Phase: 01-foundation-auth*
*Research completed: 2026-08-11*
