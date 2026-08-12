# Phase 2: Fare Estimate & Booking - Context

**Gathered:** 2026-08-12 (via `/gsd:discuss-phase 2 --auto`)
**Status:** Ready for planning

<domain>
## Phase Boundary

Rider selects a pickup and dropoff location, gets a fare quote with an itemized breakdown and a visible expiry countdown, and books a cab against that quote exactly once (idempotent — no duplicate trip from a retry or double-tap). This phase ends once a booking is accepted by the backend (`202 Accepted`, `trip_requests` row created, `ride.requested.v1` published) and the rider sees a minimal confirmation. It explicitly does NOT build: the "finding driver" tolerant-of-retries live state (TRACK-02), driver assignment reveal (TRACK-03), live driver-location tracking on a map (TRACK-04), WebSocket connection handling (TRACK-01), or cancellation (RIDE-03) — all of those are Phase 3, which depends on this phase's booking existing.

</domain>

<decisions>
## Implementation Decisions

**Auto mode note:** All decisions below were auto-selected per `[auto]` entries — no interactive user session ran. Each choice is grounded in verified backend contracts (read directly from `go-ride-kafka-consumers/services/cab-request-handler` source and `docs/cab-request-flow.md` during this discussion, not assumed) and this project's own established risk-averse pattern from Phase 1 (don't build UI for backend capabilities that don't exist yet — e.g. no surge indicator since `surge_multiplier` is hardcoded `1.0` server-side, per PROJECT.md Out of Scope).

### Location input method (pickup/dropoff selection)
- [auto] **Sequential map-tap-to-pin, current-location default for pickup.** Two steps: "Set pickup" (map screen, defaults to device GPS via a new `expo-location` dependency — not yet installed — centered marker, tap-to-reposition) → "Set dropoff" (same pattern, no default position). Selected as recommended over two alternatives:
  - Simultaneous dual-draggable-pin single screen — more polished but more complex gesture UX for a first cut, no functional advantage for v1.
  - Search-box/Places-Autocomplete-first entry — REJECTED for v1: requires Google Places API (New) integration whose exact request/response shape was flagged as an unresearched MEDIUM-confidence gap in `.planning/STATE.md` Blockers; the backend's `POST /fare-estimate` only ever accepts raw `pickup_lat/lng`/`dropoff_lat/lng` (verified in `cab-request-handler/internal/api/server.go`) — a map-tap picker needs zero additional API surface beyond the already-registered Maps SDK key from Phase 1. Text-search/autocomplete is a natural v2 polish addition once Places API shapes are actually researched, not a v1 blocker.
- [auto] No address reverse-geocoding required for v1 — pinned coordinates are sent as-is; if a human-readable label is wanted for the confirmation screen, `Marker`/static text showing raw lat/lng rounded to 4 decimals is acceptable placeholder content (Claude's discretion on exact display).

### Fare quote screen
- [auto] Itemized breakdown shown: `base_fare`, `distance_fare`, `time_fare`, `total_fare` (prominent). `surcharge_total`/`discount_total` are rendered ONLY if nonzero (both are always `0` today per backend config — showing a permanent "$0.00 discount" row would imply an active-but-unused promo, same principle PROJECT.md already applied to excluding promo-code entry from scope). `surge_multiplier` is NEVER rendered — it's hardcoded `1.0` server-side and PROJECT.md Out of Scope explicitly excludes any surge UI.
- [auto] Visible countdown timer against `expires_at` (backend default: 15 minutes from `locked_at`, confirmed via `cab-request-handler`'s `FARE_LOCK_TTL_MINUTES` config, default `15`). At zero: quote enters an explicit "Quote expired" state with a single "Get new estimate" button that re-calls `POST /fare-estimate` with the same pickup/dropoff pins (no need to re-pick locations) — NOT a silent auto-refetch. This matches both REQUIREMENTS.md RIDE-01 ("booking against an expired quote is never silently accepted") and the backend's own explicit refusal to silently reprice (`fare_expired` is a hard `409`, per `cab-request-flow.md` Phase 4a: "rejects rather than silently repricing").

### Booking confirmation & idempotency
- [auto] Tapping "Book this ride" on the quote screen calls `POST /request-cab` directly — no separate `ConfirmDialog` interstitial. `ConfirmDialog` (component exists in `src/components/`, unused anywhere in the codebase so far — no established precedent) is reserved for destructive/irreversible actions elsewhere; booking a ride is the primary expected action of this whole screen, not a destructive one, so the button itself is the confirmation.
- [auto] Idempotency key: a client-generated UUID minted once when the rider first taps "Book this ride" for a given fare quote, held in local component/hook state and reused for every retry of that same tap (e.g., a timeout or transient error). Sent via the `Idempotency-Key` header (matches `httpheaders.Idempotency` constant verified in `go-ride-utils/httpheaders`, which the backend prefers over the body field — `firstNonEmpty(header, body)` in `server.go`). A NEW key is minted only when the rider re-estimates after expiry (a genuinely new booking intent) — this exactly matches REQUIREMENTS.md RIDE-02.
- [auto] `rider_id` for both `/fare-estimate` and `/request-cab` calls comes from the already-authenticated session's `User.id` (Zustand `session-store`, populated at login/signup) — NOT from decoding the JWT client-side. `src/lib/jwt.ts` only exposes `decodeJwtExpiryMs` (the `exp` claim), it does not decode `sub`/other claims, and there is no need to extend it — the session store already holds the full `User` object. **Cross-cutting note for researcher/planner**: `cab-request-handler` has NO JWT/auth middleware at all (grepped, zero matches for `Authorization`/`jwt`/`middleware`) — `rider_id` is fully client-trusted at this endpoint. This is a backend characteristic, not something this app fixes (per PROJECT.md: "Backend is a dependency, not something this project modifies").
- [auto] Post-booking confirmation is intentionally minimal: on `202 Accepted`, show a simple "Ride requested!" confirmation (toast or lightweight screen) and return to Home — this phase does NOT build a live/polling "finding driver" status screen. Building that now would be throwaway work once Phase 3's real tracking screen (TRACK-02, backed by the rank-guarded reducer) replaces it — same horizontal-layer anti-pattern already rejected for the TRACK-01..06 grouping decision recorded in `.planning/STATE.md` Decisions.

### Booking error handling
- [auto] `fare_expired` (409): inline message on the quote screen ("Your quote expired") + the same "Get new estimate" action as the countdown-zero state — same code path, not a separate error UI.
- [auto] `fare_already_used` (409): treated as idempotent success, not an error — routes to the same "Ride requested!" confirmation as a normal `202`. This correctly reflects a retried request that actually succeeded the first time (verified backend behavior: "covers both already-booked-earlier and lost-a-concurrent-claim-race", per `cab-request-flow.md`).
- [auto] `fare_not_found` (404) and network/5xx failures: generic single-banner error message ("Something went wrong, please get a new estimate" / "Something went wrong, please try again"), matching Phase 1's established "single banner on submit" form-error convention. `fare_not_found` is not expected on any normal user path (the backend returns it defensively even for a fare belonging to a different rider, to avoid leaking existence) so no bespoke messaging is warranted.

### Claude's Discretion
- Exact map screen layout/chrome (search bar presence, marker icon styling, confirm-location button placement) — no specific product reference given; use `react-native-maps` (already an installed dependency since Phase 1, version `1.27.2`, not yet used anywhere) and the existing theme tokens/components as-is.
- Whether pickup/dropoff selection is two full-screen steps or one screen with a mode toggle — functionally equivalent, implement whichever is simpler given `react-native-maps`' actual API surface (a research concern, not a product decision).
- Rounded-coordinate placeholder label vs. no label at all on the confirmation screen for chosen locations.
- Exact fare-breakdown row order/typography/spacing.
- Toast vs. lightweight screen for the post-booking "Ride requested!" confirmation.

</decisions>

<specifics>
## Specific Ideas

User's own framing when kicking off this phase: "map view and create fair [fare] quote" — confirms a map-based interaction (not a pure text-form) is expected for location selection, consistent with the map-tap-to-pin decision above. No further specific product references given (no "make it feel like X app" comparison).

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product/requirements
- `.planning/PROJECT.md` — core value, constraints (Android-first, cash-only MVP, shared design system, backend-is-a-dependency principle)
- `.planning/REQUIREMENTS.md` — RIDE-01, RIDE-02 acceptance criteria (itemized breakdown + expiry countdown; idempotent booking via `Idempotency-Key`)
- `.planning/ROADMAP.md` — Phase 2 boundary, success criteria, dependency chain rationale (Phase 3 depends on this phase's booking existing)
- `.planning/STATE.md` — Decisions log (horizontal-layer anti-pattern rejection for TRACK-01..06 grouping, applied here to justify NOT building a live status screen in this phase) and Blockers (Places/Routes API flagged as an unresearched MEDIUM-confidence gap — resolved for v1 by avoiding Places API entirely via the map-tap decision above)

### Backend contract (verified directly against source during this discussion — no OpenAPI spec exists)
- `go-ride-kafka-consumers/services/cab-request-handler/internal/api/server.go` — exact route definitions (`POST /api/v1/cab/fare-estimate`, `POST /api/v1/cab/request-cab`), request/response struct shapes (`fareEstimateRequest`/`fareEstimateResponse`, `createCabRequestRequest`/`createCabRequestResponse`), error sentinel handling (`fare_not_found` 404, `fare_expired` 409, `fare_already_used` 409, via `errorResponse{Error, Message}` — **note the field is named `error`, not `code`**, which differs from `go-ride-backend`'s `{code, message}` shape that this app's existing `src/api/http-client.ts` `apiRequest` helper was built around; a new/adapted request helper is needed for this service, not a reuse of the Phase 1 one as-is), and confirmation that NO auth middleware exists on this service (rider_id is client-supplied, unverified server-side)
- `go-ride-kafka-consumers/services/cab-request-handler/internal/config/config.go` — `FARE_LOCK_TTL_MINUTES` default `15`, `DEFAULT_SEARCH_RADIUS_KM` default `20`, fare pricing config env vars (base/per-km/per-minute/minimum amounts, currency code default `USD`, pricing version default `v1`) — informational only, the client never computes fares itself
- `go-ride-kafka-consumers/docs/cab-request-flow.md` — the full fare-estimate/book-cab design history (Phase 4a split rationale), confirms: `/fare-estimate` has no idempotency (always mints a fresh quote), `/request-cab` idempotency is `(rider_id, idempotency_key)` scoped and returns the existing request on replay, `fare_expired` is a hard rejection with no silent repricing by design
- `go-ride-utils/httpheaders/httpheaders.go` — `Idempotency = "Idempotency-Key"` header constant (shared across services), confirms header takes precedence over the body's `idempotency_key` field when both are sent

### Sibling app
- No driver-app precedent exists for this phase — `go-ride-driver-app` has not yet reached its own booking/trip-adjacent phases (still on Phase 01.1 KYC). This phase's patterns are new, not mirrored.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/{Card,Button,Banner,TextInput,Stepper}.tsx` — Phase 1's copied-from-driver-app primitives; `Stepper` may fit a two-step pickup→dropoff flow if its API supports non-linear/map-driven steps (verify during planning).
- `src/stores/session-store.ts` — already holds the authenticated `User` object (including `id`), which this phase uses directly as `rider_id` for both new endpoints — no new session/auth plumbing needed.
- `src/api/http-client.ts` (`apiRequest`) — the Phase 1 pattern (centralized 401 handling, `ApiError` class) is worth mirroring structurally, but **cannot be reused as-is**: different `BASE_URL` (cab-request-handler runs on a different port/service than `go-ride-backend`) and a different error-body field name (`error` vs `code` — see canonical_refs above). A parallel `cab-client.ts`/adapted request helper is needed.

### Established Patterns
- Phase 1's "single banner on submit" form-error convention — reused here for booking error states (fare_expired/fare_not_found/network failures).
- Phase 1's route-group structure (`(app)/(tabs)/...`) — the Home tab currently renders a static placeholder card ("Booking a ride is coming soon", `src/app/(app)/(tabs)/index.tsx`) that this phase replaces with the real booking entry point.

### Integration Points
- `cab-request-handler` service (verified running locally on port **8082** during this session — confirm exact port/env var naming convention when planning `.env`/`app.config.js` additions; Phase 1 only wired `EXPO_PUBLIC_API_BASE_URL` for `go-ride-backend`'s port 8080).
- `react-native-maps` (`^1.27.2`) is already an installed dependency (added during Phase 1's scaffold, presumably for future map needs) but has zero usage anywhere in the codebase yet — this phase is its first real integration point.
- `expo-location` is NOT currently installed — required new dependency for device-GPS-based pickup default.

</code_context>

<deferred>
## Deferred Ideas

- Google Places Autocomplete/search-box location entry — deferred to v2 (POLISH), once Places API (New) request/response shapes are actually researched rather than assumed; map-tap-to-pin fully satisfies v1's RIDE-01/RIDE-02 without it.
- Reverse-geocoded human-readable address labels for chosen pickup/dropoff points — deferred; raw coordinates are sufficient for v1's booking flow.
- Any live/polling "finding driver" status UI — explicitly Phase 3 (TRACK-02), not built here even minimally, to avoid throwaway work.

</deferred>

---

*Phase: 02-fare-estimate-booking*
*Context gathered: 2026-08-12*
