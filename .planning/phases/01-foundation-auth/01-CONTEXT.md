# Phase 1: Foundation & Auth - Context

**Gathered:** 2026-08-11 (via `/gsd:discuss-phase 1 --auto`)
**Status:** Ready for planning

<domain>
## Phase Boundary

Rider can sign up (email + password), log in, stay logged in across app restarts, view/edit their profile, change their password, log out, and is warned before their session/JWT expires rather than being silently kicked out. This is also the app's bootstrap phase: the repo is currently empty (no `package.json`, no `src/`) — scaffolding the Expo project, shared theme/components (copied from `go-ride-driver-app`), and test tooling is part of this phase's delivery, not a separate step. Fare estimate, booking, realtime tracking, and trip lifecycle are later phases, explicitly out of this phase's scope.

</domain>

<decisions>
## Implementation Decisions

**Auto mode note:** All decisions below were auto-selected per `[auto]` entries — no interactive user session ran. Each choice is grounded in `go-ride-driver-app`'s own settled Phase 1 decisions (`../go-ride-driver-app/.planning/phases/01-foundation-auth-profile-vehicles/01-CONTEXT.md`), since PROJECT.md's Key Decisions table locks this app to mirror the driver app's conventions rather than re-deciding them per-app. Where the rider backend genuinely differs from the driver backend (change-password exists, `account_status` has fewer values, no `is_email_verified` field), the mirror breaks and a new decision was made.

### App shell / navigation for this phase
- [auto] Bottom tabs: **Home** and **Profile** only for Phase 1 — no third tab yet, since there's no Vehicles/KYC equivalent on the rider side and Fare-Estimate-and-Booking (Phase 2) hasn't been built. Selected as recommended: mirrors the driver app's `(app)/(tabs)` structure exactly, just with fewer tabs at this stage; a booking-related tab/screen gets added in Phase 2, not stubbed early.
- [auto] Home screen shows a placeholder card/message ("Booking a ride is coming soon") rather than any real booking UI — directly mirrors the driver app's Phase 1 Home screen, which showed "Going online is coming soon — register an active vehicle to get ready" for the same reason (the dependent feature isn't built yet).
- [auto] Login is the default landing screen for a logged-out rider; Signup is reached via a link from Login — mirrors driver app's Phase 1 decision exactly, no reason to diverge.

### Auth & session UX
- [auto] Form validation errors (client-side zod failures and API error responses) are shown as a single banner/toast on submit, not inline per-field messages — mirrors driver app's Phase 1 decision exactly.
- [auto] Session-expiry warning: a dismissible countdown banner appears roughly 5 minutes before the 60-minute hard JWT expiry ("session ending soon, please re-login") — same `SessionExpiryBanner` component pattern as the driver app (`go-ride-driver-app/src/features/auth/components/SessionExpiryBanner.tsx`), reused/re-implemented identically here since no refresh-token endpoint exists for riders either.
- [auto] On an actual 401 (token truly expired/invalid): immediately clear the session and redirect to login with a "your session expired" message — no retry-then-redirect, mirrors driver app exactly.
- [auto] Signup does not return a token (`SignupResponse{user: UserResponse}` only, verified against `go-ride-backend/application/user/dto.go`) — signup must chain into an immediate login call to authenticate the rider, identical pattern to the driver app.

### Profile scope
- [auto] Backend only allows editing `first_name`/`last_name` via `PATCH /api/v1/profile` — email is not editable. Profile screen: read-only email, editable name, plus a factual `account_status` badge. Selected as recommended, mirroring the driver app's read-only-email/editable-name pattern.
- [auto] **New decision (no driver-app precedent — rider's `User` entity has no `is_email_verified` field at all):** the Profile screen shows no email-verification badge/status of any kind — there's nothing to display, and no verified/unverified concept exists in this backend for riders. Do not invent one.
- [auto] **New decision (rider's `AccountStatus` is `active`/`deactivated` — 2 values, vs. the driver app's `pending`/`active`/`blocked` — 3 values):** the `account_status` badge is a neutral, factual label only, same "must not imply a blocking review step" principle the driver app applied to its own (differently-shaped) status field — since self-service account deactivation is out of scope for this milestone (see PROJECT.md Out of Scope), a rider should in practice only ever see `active`; `deactivated` is handled defensively (badge renders correctly if encountered) but no dedicated "your account is deactivated" flow/messaging is designed in this phase — if a deactivated rider's login is ever rejected server-side, that surfaces through the same generic API-error banner as any other login failure, not a bespoke screen.
- [auto] Editing the name happens on a separate "Edit profile" screen (view screen has an Edit button that navigates away), not inline editing on the view screen — mirrors driver app exactly.
- [auto] Logout clears the token and redirects to login — mirrors driver app's logout pattern. **Divergence from driver app:** the driver app's logout makes a best-effort `PATCH /driver/online {is_online:false}` call before clearing session, since a driver might be online at logout time. Riders have no online/offline concept, so this step is simply omitted — logout is just clear-token-and-redirect, nothing else to best-effort.

### Change-password screen (new — no driver-app precedent, driver backend has no such endpoint)
- [auto] Reached via an action/button on the Profile screen (not bundled into the "Edit profile" name-editing screen) — kept as its own separate screen since it's a distinct, more sensitive action with its own validation (`old_password`, `new_password`) and success/failure states, consistent with the "separate screen per distinct action" pattern the driver app already established for profile-edit vs. vehicle-edit.
- [auto] Two fields: current password, new password (matching `POST /api/v1/change-password`'s `ChangePasswordRequest{old_password, new_password}` exactly — no "confirm new password" field is required by the backend, but adding one client-side as a UX safety check is Claude's discretion, not a locked requirement either way).
- [auto] On success, show a confirmation (toast/banner) and return to the Profile screen — do not force a re-login, since the backend returns a simple `{message}` response with no session-invalidation semantics documented.

### Claude's Discretion
- Exact component internals (Button/TextInput/Banner/Card/ConfirmDialog primitives) — these are being copied verbatim from `go-ride-driver-app/src/components/` per PROJECT.md's Context section; adapt only where a rider-specific need arises, don't redesign.
- Whether to add a client-side "confirm new password" field on the change-password form (backend doesn't require it).
- Internal file/module organization beyond what's specified in canonical refs (folder structure is already decided in PROJECT.md/driver-app's ARCHITECTURE.md pattern, not re-litigated here).
- Exact visual polish/spacing — per the driver app's own Phase 1 precedent, the "bold/vibrant" brand identity is deferred to a future joint brand pass across both apps; this phase uses standard, clean form/list conventions and the copied theme tokens as-is.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product/requirements
- `.planning/PROJECT.md` — core value, constraints (Android-first, email+password auth, cash-only MVP, shared design system with the driver app, test-tooling-from-day-1 constraint), verified backend corrections
- `.planning/REQUIREMENTS.md` — AUTH-01..06 acceptance criteria for this phase, traceability
- `.planning/ROADMAP.md` — Phase 1 boundary, success criteria, dependency chain rationale
- `.planning/research/SUMMARY.md`, `.planning/research/STACK.md`, `.planning/research/FEATURES.md` — table-stakes UX depth for auth/profile (session-expiry warning framed as table stakes given no refresh-token endpoint), test tooling version pins (`jest-expo@^57.0.4`, `jest@~29.7.0`, `@testing-library/react-native@^14.0.1`, `@react-native/jest-preset@^0.86.2`, `test-renderer@^1.2.0`)

### Sibling app — the pattern to mirror (read directly, do not re-derive)
- `../go-ride-driver-app/.planning/phases/01-foundation-auth-profile-vehicles/01-CONTEXT.md` — the driver app's own Phase 1 decisions this phase mirrors (auth/session UX, profile screen pattern, form-error-as-banner convention)
- `../go-ride-driver-app/src/theme/` — token files (`colors.js`, `radii.ts`, `spacing.ts`, `tokens.ts`) to copy verbatim as this app's starting theme
- `../go-ride-driver-app/src/components/` — generic UI primitives (`Button`, `Card`, `Badge`, `TextInput`, `Select`, `Stepper`, `Banner`, `ConfirmDialog`, `EmptyState`) to copy verbatim as starting points
- `../go-ride-driver-app/src/features/auth/` and `../go-ride-driver-app/src/api/{http-client.ts,auth-client.ts}` — the API-client/query-hook pattern to mirror for this app's own `src/features/auth/` and `src/api/`
- `../go-ride-driver-app/src/stores/session-store.ts`, `../go-ride-driver-app/src/lib/{jwt.ts,secure-store.ts}` — session/JWT handling pattern to mirror exactly (Zustand mirror of `expo-secure-store`, decoded-expiry-driven `SessionExpiryBanner`)
- `../go-ride-driver-app/jest.config.js` — the actual shipped Jest config to mirror (uses `preset: 'jest-expo/android'`, per this project's own STACK.md research noting the driver app's shipped config diverges from — and supersedes — its own research doc's generic recommendation)

### Backend contract (verified directly against `go-ride-backend` source during this project's initialization — no OpenAPI spec exists)
- `go-ride-backend/interfaces/http/routes/auth_routes.go` — rider auth/profile route definitions: `POST /api/v1/auth/signup`, `POST /api/v1/auth/login`, `GET /api/v1/me`, `PATCH /api/v1/profile`, `POST /api/v1/change-password`, `POST /api/v1/deactivate` (deactivate is out of scope for this phase, per REQUIREMENTS.md Out of Scope)
- `go-ride-backend/application/user/dto.go` — exact DTO shapes: `SignupRequest{email,password,first_name,last_name}` → `201 SignupResponse{user: UserResponse}` (no token — must chain into login); `LoginRequest{email,password}` → `200 LoginResponse{access_token, user: UserResponse}`; `GET /me` and `PATCH /profile` both return `200 {"user": UserResponse}` (wrapped, not bare — this project's own verified correction to the original briefing); `ChangePasswordRequest{old_password,new_password}` → `200 ChangePasswordResponse{message}`
- `go-ride-backend/domain/user/entity.go` — `User{ID, Email, PasswordHash, FirstName, LastName, AccountStatus, DeactivatedAt, CreatedAt, UpdatedAt}`; `AccountStatus` is `"active"` / `"deactivated"` only (`AccountStatusActive`/`AccountStatusDeactivated`) — no `is_email_verified` field, no phone field, confirmed via source read during PROJECT.md initialization
- `go-ride-backend/infrastructure/security/jwt.go` — rider tokens get `aud=go-ride-clients`; no refresh-token endpoint exists anywhere in the repo (grepped, zero matches) — 60-min-style hard expiry forces full re-login on 401, same as the driver app's documented pattern

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None in this repo yet — `go-ride-user-app` is currently empty (only `.git`, `AGENTS.md`, `BRIEFING.md`, `.planning/`). The entire starting point comes from copying `go-ride-driver-app`'s theme tokens, generic components, and API-client/session-store/JWT patterns, per PROJECT.md's explicit "mirror, don't re-decide" architectural direction — this phase establishes the stack/structure by copying from the sibling repo, not from zero the way the driver app's own Phase 1 had to.

### Established Patterns
- None in-repo yet. All patterns to follow come from `go-ride-driver-app`'s equivalent, already-built and already-verified Phase 1 code (see canonical refs above) — this is a stronger starting position than the driver app had, since there's a working reference implementation to copy rather than research-doc guidance to interpret from scratch.

### Integration Points
- `go-ride-backend` rider auth/profile REST endpoints (base path `/api/v1/...`, port 8080; Android emulator/device reaches a locally-run backend at `10.0.2.2:8080`, same as the driver app's documented local-dev setup).
- This phase does not touch `cab-request-handler` or `websocket-gateway`, so none of Phase 2/3's realtime concerns are relevant here.

</code_context>

<specifics>
## Specific Ideas

No specific visual/product references — visual polish is explicitly deferred to a future joint brand pass with the driver app (see PROJECT.md Constraints); this phase copies the driver app's existing theme/components as-is and follows standard, clean form/list conventions for anything new (change-password screen).

</specifics>

<deferred>
## Deferred Ideas

- Any handling beyond a generic error banner for a `deactivated` rider account — out of scope since self-service deactivation isn't built in this milestone (see REQUIREMENTS.md Out of Scope: Account deactivation); revisit if/when that capability is ever added.
- Shared component/theme package between `go-ride-driver-app` and `go-ride-user-app` — explicitly deferred until a future joint brand pass, per PROJECT.md; this phase copies files directly instead.

</deferred>

---

*Phase: 01-foundation-auth*
*Context gathered: 2026-08-11*
