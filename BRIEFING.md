# go-ride-user-app — Briefing for /gsd:new-project

## What this is / Core value

An Expo/React Native app for **riders** on the go-ride ride-hailing platform. A rider signs up, requests a fare estimate, books a cab against that quote, watches it get assigned and tracked in realtime on a map, and rides through to completion with cash payment confirmed by the driver — reliably, end-to-end, even though the backend has no ratings, ride-history, payment gateway, or push-notification support yet.

This app is being built in parallel with a sibling driver app (`go-ride-driver-app`, a separate git repo, already mid-build) against the same backend. It should mirror that app's tech stack and conventions closely rather than re-evaluate alternatives — this is a deliberate consistency choice, not something to re-litigate.

## Tech stack — decided, mirror go-ride-driver-app exactly

- Expo SDK 57, custom dev client (not Expo Go, not bare RN CLI) — for EAS Build/Update and native module support (maps, secure storage).
- React Native 0.86.2, React 19.2.3, TypeScript strict mode (`expo/tsconfig.base`).
- **expo-router** (file-based, typed routes), route groups `(auth)` / `(app)` gated via `Stack.Protected` at the root layout.
- **TanStack Query v5** for server state, **Zustand v5** for ephemeral/session state — deliberately never mixed.
- **react-hook-form** + **zod v4** for forms/validation.
- **NativeWind v4** (Tailwind v3.4) + a small hand-maintained token set (`src/theme/colors.js` as single source of truth feeding both `tailwind.config.js` and native token exports, plus `tokens.ts`/`spacing.ts`/`radii.ts`).
- Folder pattern: `src/app/` (thin routed screens only), `src/features/<name>/{api.ts, schemas.ts, components/}`, `src/api/` (thin fetch wrapper + per-resource clients), `src/stores/` (Zustand), `src/lib/` (jwt decode, secure-store wrapper).
- Auth: JWT stored in `expo-secure-store` only, mirrored into a synchronous Zustand session store hydrated once at boot. No `zustand/persist`.
- Realtime: a hand-rolled WebSocket client (not a generic library) as an app-level singleton wired to `AppState`, reconnecting on foreground, writing directly into the Zustand trip store. Same reasoning as the driver app: the protocol is simple enough that a generic lib adds friction it doesn't save.
- No tests exist in the driver app yet; ESLint via `eslint-config-expo/flat`. Match this for now.

## Backend contracts — verified directly from source, treat as ground truth

Three separate Go services, no unified API gateway/BFF — the rider app talks to all three directly:

**Auth/profile** — `go-ride-backend` (Gin + GORM + Postgres):
- `POST /api/v1/auth/signup`, `POST /api/v1/auth/login` — email + password only, no OTP/phone auth, no social login.
- `GET /api/v1/me`, `PATCH /api/v1/profile`, `POST /api/v1/change-password`, `POST /api/v1/deactivate` (JWT-protected).
- JWT is HS256, with a `Claims{UserID, Email, Role}` shape and a role-specific `aud` claim distinguishing rider tokens from driver tokens (same shared secret across services). **No refresh-token endpoint exists** — a 401 means full re-login; plan the UX around this (e.g. a session-expiry banner) rather than expecting a fix.

**Ride booking** — `cab-request-handler` (in `go-ride-kafka-consumers`), base path `/api/v1/cab`:
- `POST /fare-estimate` — locks a fare quote (haversine distance × rates), returns `fare_id` + breakdown + `expires_at`. Surge multiplier is hardcoded to 1.0 (no dynamic surge — don't build UI for it).
- `POST /request-cab` — books using `rider_id` + `fare_id` (not raw coordinates); supports `Idempotency-Key` / `Correlation-Id` headers.
- `POST /request-cab/{request_id}/cancel` — handles both pre-assignment (withdraws job offers) and post-assignment stages.
- `GET /current-trip?rider_id=...` — polling fallback/recovery path for missed WebSocket pushes; not the primary update mechanism.

**Realtime** — `websocket-gateway`:
- Rider connects `GET /api/v1/ws/rider?token=<jwt>&device_id=<device_id>` — **push-only, no ack protocol** (unlike the driver side's job-offer accept flow).
- Pushes: `ride_assigned`, `driver_location` (filtered to riders with an actively matched driver), `trip_started`, `trip_ended` (carries `final_fare`), `trip_completed`.
- Backed by Kafka topics → Redis pub/sub → whichever gateway pod holds the live connection.
- **No driver-reject/offer-withdrawal push exists** — the rider's "finding driver" UI must be designed to tolerate silent dispatch retries, not assume a clean fail-fast signal.

## Confirmed backend gaps — external constraints, NOT work items for this repo

- No ratings/reviews system anywhere (no table, no endpoint).
- No ride-history GET endpoint for riders (a `trip_history` audit table exists in the DB but nothing exposes it to riders).
- No payment gateway or transaction history — cash-only; the driver confirms collection via their own endpoint, the rider app only observes status.
- No promo/coupon system (`discount_total` column exists on trip fares but nothing populates it).
- No push notifications or email for riders — WebSocket-only.
- Surge pricing hardcoded to 1.0.

These should show up in `REQUIREMENTS.md` as explicitly flagged v2/out-of-scope items with reasons, mirroring how `go-ride-driver-app/.planning/REQUIREMENTS.md` handles its own backend-blocked items (PAY-01, LOC-01, OFFER-05, VEH-04) — not as bugs to fix in this project.

## Design system status

Shared with `go-ride-driver-app`: its `src/theme/*` token files are explicitly a placeholder pending a later joint "bold/vibrant, Bolt/Grab-esque" brand pass across both apps. This app should start by copying those token files and the generic `src/components/` primitives (Button, Card, Badge, TextInput, Select, Stepper, Banner, ConfirmDialog, EmptyState) verbatim rather than reimplementing them from scratch, since there's no final design yet to protect from drift. Building a shared package/monorepo between the two separate git repos is explicitly deferred until the joint brand pass happens.

## Recommended v1 scope

**Buildable now**: signup, login, session persistence across restarts, profile view/edit, logout; fare estimate + request-cab (idempotent) + cancel; realtime trip tracking via WebSocket (map + `ride_assigned`/`driver_location`/`trip_started`/`trip_ended`/`trip_completed`) with `/current-trip` polling as a reconnect fallback; trip completion + cash-status display; a "finding driver" UX that tolerates silent retries.

**Flagged v2 / blocked on backend**: ratings, rider ride-history, in-app payment, promo codes, push notifications for riders, dynamic surge display.

**Out of scope with reasons**: same shape as the driver app's Out-of-Scope table (no backend model exists, or matches an existing backend constraint like email+password auth / cash-only).

## Cross-reference

See sibling repo `go-ride-driver-app/.planning/PROJECT.md` (and its `REQUIREMENTS.md`, `ROADMAP.md`) for the parallel driver-side plan. This app's roadmap should be phased differently (the rider side of the lifecycle is thinner — no vehicle management, no push, no earnings — so it doesn't need to match 6 phases), but should stay architecturally consistent: shared stack, shared design tokens, same GSD conventions (REQ-ID format, Key Decisions table, Context/Constraints shape in PROJECT.md).
