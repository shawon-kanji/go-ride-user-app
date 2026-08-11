# Project Research Summary

**Project:** go-ride-user-app
**Domain:** Ride-hailing rider (passenger) mobile app — Expo/React Native, Android-first, cash-only, single-fare-tier, WebSocket-driven realtime trip tracking
**Researched:** 2026-08-11
**Confidence:** MEDIUM-HIGH

## Executive Summary

go-ride-user-app is the rider-facing counterpart to the already-mid-build `go-ride-driver-app`, built against the same three backend services (`go-ride-backend`, `cab-request-handler`, `websocket-gateway`) with a deliberately narrow scope: sign up, get a cash fare quote, book it, watch the assigned driver's live location on a map, and complete the trip with driver-confirmed cash collection — end to end, without losing track of trip state through a dropped WebSocket or a silently-retried dispatch. The entire core tech stack (Expo SDK 57, RN 0.86.2 New Architecture, React 19, TanStack Query + Zustand, react-hook-form + zod, NativeWind v4, hand-rolled WS singleton, `react-native-maps` 1.27.2) is already locked and mirrored from the driver app — this research only resolves the genuinely new decisions: how to render/animate the driver marker and route on the locked map library, how to do address search/geocoding, and how to structure the rider's trip state machine around three converging, structurally-different data sources (HTTP mutation results, WS push events, and `GET /current-trip` polling).

The recommended approach is architecturally driven by one fact the research surfaced repeatedly: unlike the driver app's job-offer WS (which replays state on reconnect), the rider WS has **no replay-on-reconnect guarantee** and is push-only with no ack protocol. This means the app cannot "trust the next push to catch up" — it must proactively reconcile via `GET /current-trip` on every reconnect, foreground transition, cold start, and watchdog timeout, and every one of those sources (plus HTTP booking/cancel results) must funnel through a single rank-guarded reducer (`applyTripEvent`) so no source can regress another. This reconciliation pattern is the single most important architectural decision in this research and should be built as day-one plumbing, not retrofitted after the booking/tracking screens exist — the Features research independently confirms this ("Trip State Recovery enhances both Finding Driver and Live Map Tracking... retrofitting it later means redesigning both state machines").

The key risks, in priority order: (1) the backend's silent dispatch retry with no fail-rider signal, which naive apps mishandle as an infinite/frozen spinner — mitigated with a client-side timeout-ladder for messaging, never a fabricated failure state; (2) Android WS lifecycle gotchas (Doze-mode connection death, reconnect storms, stale-UI-after-silent-reconnect) that only surface on real devices under real backgrounding, not emulators; (3) the Google Maps API key working in the dev client but failing in an EAS production build due to unregistered release SHA-1 fingerprints — must be verified against a real production build early, not assumed from dev-client success; and (4) a confirmed backend gap (no refresh-token endpoint for riders) that makes proactive JWT-expiry warnings a UX requirement, not polish, especially since mid-trip forced logouts are the worst-case failure this app can have.

## Key Findings

### Recommended Stack

Nearly all core technology choices are already locked and mirrored exactly from `go-ride-driver-app` (Expo SDK 57 custom dev client, RN 0.86.2 mandatory New Architecture, React 19.2.3, TypeScript strict, expo-router `(auth)`/`(app)` groups, TanStack Query v5 + Zustand v5, react-hook-form + zod, NativeWind v4, hand-rolled WS singleton, expo-secure-store, `react-native-maps` 1.27.2, expo-location, reanimated/gesture-handler). Research only resolved the rider-specific new decisions layered on top of that locked stack.

**Core technologies (new decisions):**
- Google Routes API `computeRoutes` with `polylineEncoding: GEO_JSON_LINESTRING` — returns the pickup→dropoff route as GeoJSON coordinates directly consumable by `<Polyline>`, eliminating any polyline-decoding library; the Maps key already has Routes API enabled.
- Google Places API (New) Autocomplete + Place Details, called via plain `fetch` (no SDK/widget) — matches the project's "hand-roll thin glue over already-provisioned APIs" convention; the legacy Places API and third-party autocomplete widgets are explicitly out (different, deprecated-for-new-usage API surface than what the key is scoped to).
- `markerRef.current.animateMarkerToCoordinate()` (Android-native imperative API), not `AnimatedRegion` — simpler, avoids `react-native-maps`'s still-stabilizing Fabric/New-Architecture support for the cross-platform animation path, and iOS is explicitly out of scope this milestone.
- Google Geocoding API (new API to enable on the existing key) for reverse-geocoding a dragged pickup pin — `expo-location`'s `reverseGeocodeAsync` has a documented Android reliability issue and should only be a fallback/placeholder label, never the primary source.
- Test tooling pinned from Phase 1 (`jest-expo ^57.0.4`, `jest ~29.7.0` — not `jest@latest` which resolves to 30.x and breaks pairing, `@react-native/jest-preset ^0.86.2`, `@testing-library/react-native ^14.0.1`, `test-renderer ^1.2.0`), using `jest-expo/android` preset to match the driver app's actual shipped (not just researched) config.

### Expected Features

Feature scope is fixed by PROJECT.md's Active requirements — this research adds UX depth, not new scope. Everything is either already in-scope (build it well) or an explicit anti-feature blocked by a confirmed backend gap (don't build it at all, even as a stub).

**Must have (table stakes, all P1):**
- Fare estimate with itemized breakdown + visible expiry countdown (quotes go stale; booking against an expired quote must never silently fail)
- Idempotent "Book Cab" (disable-on-tap + shared idempotency key — prevents the most common real-world duplicate-booking bug)
- Retry-tolerant "Finding driver" state with escalating messaging and an always-reachable cancel affordance (the backend's silent-retry dispatch behavior makes this the single riskiest UX state in the app)
- Live map with driver marker, smoothly interpolated (not raw jump-cuts)
- WS-drop recovery via `/current-trip` polling — this is the app's literal stated Core Value, must ship in v1
- Immediate cancellation reflection regardless of trigger (rider/driver/system)
- Trip completion screen separating "amount due" from "driver-confirmed payment" states (observe-only, no rider-side confirm action)
- Proactive session-expiry warning (no refresh-token endpoint exists — a 401 mid-trip is the worst-case failure)
- Auth (email+password) + profile view/edit/change-password

**Should have (P2 differentiators, add after v1 correctness is proven):**
- Smooth marker interpolation polish, client-side ETA estimation (straight-line/haversine, explicitly label as approximate — no road-routing ETA source confirmed), trip lifecycle stepper visual, subtle connection-health indicator

**Defer (v2+, blocked on confirmed backend gaps — do not schedule as this repo's work):**
- Ratings/reviews, ride history, in-app payment/tipping, promo codes, push notifications, surge pricing display, self-service account deactivation, scheduled/multi-stop rides — each corresponds to a UI surface with nothing to submit to or a field that would always show empty/zero, which erodes trust more than omitting it.

### Architecture Approach

The architecture centers on one rule: three structurally different sources of trip-status truth (HTTP mutation results from `POST /book-cab`/`POST /cancel`, WS push events, and `GET /current-trip` poll responses) are each normalized into a common `TripTransition` shape and passed through a single rank-guarded pure-function reducer (`applyTripEvent`) that is the only writer of trip status — no call site ever calls `set()` on the store directly. `driver_location` updates bypass this reducer entirely through a separate last-write-wins fast path, since continuous location data has fundamentally different ordering semantics than the discrete, one-directional trip lifecycle. Reconciliation via `/current-trip` is triggered proactively (cold start, WS reconnect, app-foreground, watchdog timeout) rather than reactively, because the rider WS has no documented replay-on-reconnect guarantee — this is the direct architectural response to that verified backend constraint.

**Major components:**
1. `state/trip-machine.ts` — pure, framework-free rank-guarded transition table (`applyTripEvent`); the highest-risk logic in the app, fully unit-testable before any WS/HTTP plumbing exists
2. `state/normalizers.ts` — one normalizer per source (HTTP, WS, poll) converting each wire shape into the common `TripTransition` before it reaches the funnel
3. `stores/trip-store.ts` (Zustand) — holds status, trip data, driver location, and a boot-time `isReconciling` flag; screens read only via granular selectors
4. `realtime/websocket-client.ts` (extended singleton) — owns connection lifecycle, dispatches status messages to the funnel and location messages to the fast path, and fires reconciliation triggers on reconnect/foreground/watchdog
5. `features/trips/components/DriverMarker.tsx` — reads only the location slice, interpolates between last two points, owns camera-follow-vs-user-pan state locally (not in the store)

### Critical Pitfalls

1. **Silent dispatch retry misread as a frozen app** — the backend gives no "no drivers found" signal; a static spinner reads as broken. Avoid with a client-side timeout ladder (escalating copy at 15s/45s+) and an always-reachable cancel action, never a fabricated client-side "search failed" state.
2. **WS reconnect storm / stale UI after silent reconnect** — naive "close → reconnect immediately" logic combined with Android's frequent `AppState` churn can spawn concurrent connections; separately, a technically-successful reconnect that doesn't also trigger a `/current-trip` resync leaves the UI showing stale data. Avoid with a singleton connection-state guard, exponential backoff + jitter, and treating every reconnect as "resync then resume listening," never just "resume listening."
3. **Missed WS events during Android Doze/backgrounding, no replay** — this is standard, documented Android behavior (not a bug) and is invisible in emulator testing; must be verified on a real device backgrounded 10+ minutes during an active trip. Avoid by treating foreground-triggered `/current-trip` polling as always-on, primary recovery, never a rare fallback.
4. **Raw marker jank / stale "last known location"** — setting marker coordinates directly from raw pushes teleports the marker; separately, if the driver's location feed stalls, the rider has no signal the data is stale. Avoid with interpolated marker animation plus a `lastLocationUpdateAt` staleness indicator, tracked as two distinct failure modes (WS dead vs. driver's own feed stalled).
5. **Google Maps API key works in dev, blank/crashes in an EAS production build** — debug and release Android builds are signed with different SHA-1 fingerprints; a key restricted to only the debug fingerprint silently breaks the first real production build, often discovered dangerously close to a store submission. Must register every signing SHA-1 (local debug, EAS debug, EAS production) and verify against a real EAS build, not just the dev client.

## Implications for Roadmap

Based on combined research, suggested phase structure:

### Phase 1: Foundation & Auth
**Rationale:** Every other feature requires authentication; test tooling and Google Maps key configuration are cheapest to get right before any screen depends on them, and both have documented "looks done but isn't" traps (jest/RN version pairing; API-key SHA-1 registration) that are far more expensive to discover late.
**Delivers:** Project scaffold (mirrored from driver app conventions), test tooling wired from day one (not retrofitted), email+password auth (`(auth)`/`(app)` route groups, `Stack.Protected`), profile view/edit/change-password, JWT storage via `expo-secure-store`, proactive JWT-expiry-warning infra (decode `exp`, warn before lapse), Google Maps API key configured and verified against a real EAS build (not just dev client), shared theme/component primitives copied from the driver app.
**Addresses:** Sign up/log in, profile management, session-expiry warning (Features table stakes)
**Avoids:** Pitfall 8 (Maps key works in dev, fails in production), Pitfall 9 (WS token expiry mid-connection with no refresh endpoint)

### Phase 2: Fare Estimate & Booking
**Rationale:** Booking is the entry point to every subsequent trip-related screen and has its own self-contained, well-documented risk (stale quotes, double-booking) that's independent of the realtime-tracking work — sequencing it before the trip-state-machine work lets the map/geocoding pieces (address search, pickup pin) get built and verified in isolation first.
**Delivers:** Pickup/dropoff address search (Places API (New) autocomplete + details), map-based pickup pin with reverse-geocoding, fare quote screen with itemized breakdown and visible expiry countdown, idempotent "Book Cab" mutation.
**Addresses:** Fare estimate + expiry handling, idempotent booking (Features P1)
**Avoids:** Pitfall 7 (fare quote expiry silently failing bookings)
**Uses:** Google Places API (New), Google Routes API `computeRoutes`, Google Geocoding API — all new stack decisions from STACK.md

### Phase 3: Realtime Trip Tracking (core plumbing)
**Rationale:** This is the architecturally load-bearing phase — the rank-guarded reducer funnel, WS client extensions, and reconciliation triggers must exist as a coherent whole before any trip-status screen is built on top of them, per both the Architecture and Features research's explicit warning against retrofitting this later. Build the state machine and its unit tests before wiring it to real screens.
**Delivers:** `trip-machine.ts` (pure rank-guarded reducer, unit-tested with fabricated out-of-order/duplicate events), per-source normalizers, extended WS singleton (trip-message dispatch, reconnect backoff+jitter, `AppState`-aware reconciliation triggers, watchdog timeout), `/current-trip` polling integration, driver-location fast path, interpolated `DriverMarker` component.
**Implements:** Architecture Patterns 1–3 (single-funnel rank-guarded reducer, reconcile-first on reconnect, location fast path bypass)
**Avoids:** Pitfalls 2, 3, 4, 5, 6, 10 (reconnect storms, missed Doze events, stale UI after reconnect, marker jank, stale location, WS/poll divergence) — this phase is where nearly every realtime pitfall lives

### Phase 4: Trip Lifecycle & Completion
**Rationale:** With the state-machine plumbing from Phase 3 in place, the remaining trip screens (finding-driver, live map, cancel, completion) are primarily UI built on already-solid foundations — this phase is where the timeout-ladder UX, cancellation flows, and trip-completion screen get built and where session-expiry warnings get integrated specifically into long-running trip screens.
**Delivers:** "Finding driver" screen with timeout-ladder messaging (15s/45s+ escalation) and reachable cancel, live trip map screen, cancel-trip flow (any non-terminal status, converging WS push + poll on one state), trip completion screen (final fare + cash-collection status, clearly separating amount-due from payment-confirmed).
**Addresses:** Finding-driver retry-tolerant state, cancel + immediate reflection, trip completion + cash status (Features P1)
**Avoids:** Pitfall 1 (silent dispatch retry misread as frozen app)

### Phase Ordering Rationale

- Auth must come first — it's the entry point for every screen and has no dependency on anything else.
- Booking (Phase 2) is sequenced before the realtime state-machine (Phase 3) because it's a self-contained, independently-testable slice (quote → book) that doesn't require the trip-status reducer to exist yet, and it exercises the new Places/Routes/Geocoding integrations in isolation before they're needed inside the more complex trip-tracking flow.
- The trip-state-machine plumbing (Phase 3) is deliberately separated from the trip-lifecycle screens (Phase 4) because Architecture and Features research both independently flag this as the piece that must be built correctly from day one, not incrementally discovered while also building UI — building the reducer and its unit tests first, then wiring screens on top, avoids the "redesign both state machines" retrofit cost called out in FEATURES.md.
- This ordering also naturally sequences pitfall-avoidance: Maps-key/production-build verification happens early (Phase 1) before it can block later phases; the WS reconnect/Doze/marker-jank pitfalls (the largest cluster) are concentrated in the one phase (3) purpose-built to address them with focused testing, rather than spread thin across multiple phases.

### Research Flags

Phases likely needing deeper research during planning (`/gsd:research-phase`):
- **Phase 3 (Realtime Trip Tracking):** Two concrete open questions from ARCHITECTURE.md are unresolved — the actual `driver_location` push cadence/timestamp field (needed to tune watchdog and interpolation duration) and the exact `GET /current-trip` response shape when no trip is active (404 vs. 200/null, needed to avoid a false error state on cold start). Also flag `react-native-maps` 1.27.2's Fabric/New-Architecture marker+polyline rendering behavior under RN 0.86.2 as unverified — neither app in this family has built a map screen yet.
- **Phase 2 (Fare Estimate & Booking):** Places API (New) / Routes API exact REST request/response shapes haven't been exercised in this codebase yet (STACK.md confidence is MEDIUM here specifically) — worth a focused check against live API responses before finalizing the booking-screen data model.

Phases with standard patterns (skip deep research):
- **Phase 1 (Foundation & Auth):** Directly mirrors `go-ride-driver-app`'s already-shipped, verified conventions (route groups, secure-store, theme primitives, Jest config) — low uncertainty.
- **Phase 4 (Trip Lifecycle & Completion):** Once Phase 3's reducer/reconciliation plumbing exists, this phase is primarily presentation logic over an already-solid state machine — the hard part (the funnel) is verified earlier.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH (MEDIUM on one point) | Versions verified live against npm registry and official Google/Expo docs on research date; sole MEDIUM spot is `react-native-maps`'s New Architecture/Fabric maturity, which is maintainer-discussion-level evidence, not an official compatibility statement |
| Features | MEDIUM-HIGH | Scope is fixed and verified by PROJECT.md (not re-derived), UX-depth patterns cross-referenced against official Uber/Bolt/Grab sources; the client-side GPS-ETA derivation pattern is explicitly flagged LOW-MEDIUM (no single authoritative source), and exact DTO field availability (fare breakdown fields, driver-assignment payload fields) was not independently re-verified in this pass |
| Architecture | MEDIUM-HIGH | The rank-guarded/reconcile-first pattern is a well-established distributed-systems technique applied to this project's specific, PROJECT.md-verified backend contract; two concrete open questions (push cadence/timestamp, no-active-trip response shape) are explicitly unverified and flagged for phase-specific research |
| Pitfalls | MEDIUM-HIGH | WebSocket/Android-lifecycle and `react-native-maps` gotchas are verified via official GitHub issue trackers and Android docs (HIGH); ride-hailing dispatch-UX patterns are cross-referenced system-design writeups (MEDIUM); the specific "silent retry, no fail-rider signal" constraint is a confirmed project-specific fact from PROJECT.md, not an external source |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- `driver_location` push cadence and whether messages carry a server timestamp — verify against `location-producers`/`websocket-gateway` source (or a live capture) before implementing Phase 3's watchdog timeout and marker-interpolation duration; currently a placeholder assumption.
- `GET /current-trip` response shape when there is no active trip (404 vs. 200 with null/empty body) — needed so Phase 3's cold-start reconciliation can distinguish "no trip" from "request failed" without showing a false error.
- Fare-estimate response's actual breakdown fields, and the driver-assignment payload's actual fields (photo, phone, plate, vehicle model) — verify against real backend DTOs before finalizing the Phase 2 quote screen and Phase 4 assigned-driver reveal; don't design around assumed fields.
- `react-native-maps` 1.27.2 marker/polyline rendering behavior under RN 0.86.2's mandatory New Architecture — budget explicit verification time in Phase 3, since neither sibling app has built a map screen yet and the library's own Fabric support is described as still stabilizing.
- Whether a driver phone number exists in the assignment payload — needed only if any "contact driver" affordance is ever considered; currently unverified and out of scope unless confirmed.

## Sources

### Primary (HIGH confidence)
- `.planning/PROJECT.md` (this project) — authoritative for all project-specific backend constraints (no refresh-token endpoint, push-only WS with no ack, silent dispatch retry with no fail-rider signal, Android-restricted Maps API key, fare quote `expires_at`, `trip_cancelled` unconditional push, verified `{"user": {...}}` response wrapping)
- `go-ride-driver-app/package.json`, `jest.config.js`, `babel.config.js`, `src/stores/session-store.ts` (sibling repo, read directly) — ground truth for exact locked versions and actual shipped conventions, not just research docs
- npm registry (queried live 2026-08-11) — `jest-expo`, `jest`, `@react-native/jest-preset`, `@testing-library/react-native`, `react-native-maps` versions/dist-tags/peer-dependencies
- Google Routes API `computeRoutes` reference docs, Google Places API (New) Place Autocomplete docs
- Android Developers — Optimize for Doze and App Standby (official Android documentation)
- react-native-maps official GitHub issue tracker (#5884, #3591, #5611, #2382, #2658, #2089) and installation docs — API key crash/blank-map behavior, marker animation/lag issues

### Secondary (MEDIUM confidence)
- react-native-maps GitHub discussions #5355, #5616 — New Architecture/Fabric maturity, maintainer/community discussion not an official statement
- expo/expo issue #36116 — `reverseGeocodeAsync` Android reliability
- WebSocket.org — Reconnection: State Sync and Recovery Guide, Best Practices for Production Applications
- Bolt/Uber/Grab official support docs and newsroom posts — cash-payment flow UX pattern (driver-confirms/rider-observes)
- System-design writeups (Hello Interview, System Design School, Medium) on ride-hailing dispatch-retry queue UX patterns — used only to corroborate general problem shape, not as a spec

### Tertiary (LOW confidence)
- General GPS-ETA derivation pattern (haversine + delta-time speed + smoothing) — synthesized from multiple non-authoritative sources, flagged for validation during Phase 3/4 implementation
- Watchdog timeout threshold values (30-45s) throughout PITFALLS.md and ARCHITECTURE.md — reasonable placeholders, explicitly need tuning against real observed push cadence, not treated as settled

---
*Research completed: 2026-08-11*
*Ready for roadmap: yes*
