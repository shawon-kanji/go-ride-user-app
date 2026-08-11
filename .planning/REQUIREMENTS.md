# Requirements: go-ride-user-app

**Defined:** 2026-08-11
**Core Value:** A rider can reliably book and complete one cash trip end-to-end, without losing track of their trip state even through a dropped WebSocket connection or a silently-retried dispatch.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Authentication & Profile

- [x] **AUTH-01**: Rider can sign up with email + password
- [x] **AUTH-02**: Rider can log in and stay logged in across app restarts (session persisted via secure storage)
- [ ] **AUTH-03**: Rider can view and edit their profile (first/last name) — note: `GET /api/v1/me` and `PATCH /api/v1/profile` both wrap the response as `{"user": {...}}`, not a bare object
- [ ] **AUTH-04**: Rider can log out
- [ ] **AUTH-05**: Rider can change their password (`POST /api/v1/change-password`)
- [x] **AUTH-06**: Rider sees a proactive session-expiry warning before the JWT hard-expires — no refresh-token endpoint exists, so this is a client-side mitigation, most critical while an active trip is being tracked

### Ride Booking

- [ ] **RIDE-01**: Rider can get a fare estimate with an itemized breakdown (whatever fields `POST /fare-estimate` actually returns — verify before designing, don't fabricate) and a visible expiry countdown against the quote's `expires_at`
- [ ] **RIDE-02**: Rider can book a cab against a fare quote, idempotently (`Idempotency-Key` header or body `idempotency_key`, reused across retries of the same intent so a slow response never creates a duplicate trip)
- [ ] **RIDE-03**: Rider can cancel a pending or ongoing trip request with a reason, with the cancel affordance always reachable (not buried in a menu)

### Realtime Tracking

- [ ] **TRACK-01**: Rider connects to `GET /api/v1/ws/rider?token=...&device_id=...` while a trip request/trip is active, reconnecting on foreground/drop
- [ ] **TRACK-02**: Rider sees a "finding driver" state that silently absorbs dispatch retries (no fail-fast signal exists server-side), with an animated/pulsing indicator, an always-reachable cancel affordance, and escalating long-wait messaging via a client-side timeout ladder — not an invented failure state
- [ ] **TRACK-03**: Rider sees the assigned driver revealed (`ride_assigned`) with available identifying fields (name/vehicle/plate — verify exact DTO fields before designing the screen) and the driver appears on a map
- [ ] **TRACK-04**: Rider sees the driver's live location on the map during a trip (`driver_location`), routed through a single rank-guarded trip-state reducer so HTTP responses, WS pushes, and poll results never conflict or cause UI flicker — `driver_location` updates bypass the status rank-guard via a separate timestamp-guarded fast path
- [ ] **TRACK-05**: Rider's trip state is reconciled via `GET /current-trip` polling on every reconnect, app-foreground transition, and cold start — not treated as a rare fallback, since the rider WS has no documented replay-on-reconnect guarantee
- [ ] **TRACK-06**: Rider sees trip cancellation reflected immediately via the `trip_cancelled` push, regardless of trigger (rider-initiated, driver-initiated, or system), converging with the polling path on the same state without flicker or duplicate notifications

### Trip Lifecycle

- [ ] **LIFECYCLE-01**: Rider sees trip start reflected in the UI (`trip_started`) as a plain-language status label, not a raw backend enum
- [ ] **LIFECYCLE-02**: Rider sees the final fare once the trip ends (`trip_ended`)
- [ ] **LIFECYCLE-03**: Rider sees cash-collection status and trip completion (`trip_completed`) on a screen that clearly separates "amount due" from "payment confirmed" — rider only observes; driver confirms collection via their own endpoint

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap. Correctness-first: these are UI/UX polish added once the underlying state machine (TRACK-01..06) is proven reliable, not blocked on any missing backend capability.

### Tracking Polish

- **POLISH-01**: Smooth marker interpolation/animation between `driver_location` pings, instead of raw jump-cuts
- **POLISH-02**: Client-side ETA estimation derived from consecutive location pings (haversine distance + speed, smoothed) — straight-line/approximate only unless a routing API is confirmed available; must be labeled as approximate, not implied as precise
- **POLISH-03**: Trip lifecycle stepper/timeline visual (Requested → Driver Assigned → Arrived → In Progress → Completed) as a pure client-side rendering layer over already-available state
- **POLISH-04**: Subtle connection-health indicator distinguishing "you're offline" from "we're reconnecting" — calibrate prominence against real-world WS drop frequency post-launch to avoid alarm-fatigue

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Post-trip ratings/reviews | No ratings model or endpoint exists anywhere in the platform |
| Ride-history list screen | No GET endpoint exposes ride history, even though a `trip_history` table exists in the DB — this app doesn't own persistence, don't query the DB directly |
| In-app payment / card entry / wallet / tip screen | No payment gateway integration exists; MVP is cash, driver-confirmed. Tipping is normally routed through an in-app gateway that doesn't exist here |
| Promo/coupon code entry | `discount_total` column exists on trip fares but nothing populates it — a field that can never be nonzero reads as broken, not absent |
| Push notification permission prompt / rich notifications | WebSocket-only for riders in this milestone; in-app banners/toasts only, no OS-level notification permission request |
| Surge/dynamic pricing indicator | Pricing is hardcoded to 1.0 server-side with no signal to display — showing a surge UI would fabricate a value the backend never sends |
| Account deactivation (self-service) | `POST /api/v1/deactivate` exists but is destructive/low-frequency; deserves its own confirm-UX pass, not a rushed v1 add |
| Phone number + OTP login/signup | Backend is email+password only; no server-side auth flow exists to call |
| Vehicle-class picker (economy/premium/XL) | Single fare tier only — a class picker implies pricing-model choices the backend doesn't support |
| Scheduled ("book for later") rides | Not in Active requirements; adds future-dispatch/reminder state-machine complexity with no confirmed backend support |
| Multi-stop trips / waypoints | Requirements describe a single origin→destination trip; multi-stop would change the fare-estimate contract shape |
| In-app chat / messaging with driver | Rider WS connection is push-only with no ack protocol — no confirmed bidirectional channel exists to build on |
| Silent/automatic JWT refresh | No refresh-token endpoint exists for riders — attempting silent refresh against a nonexistent endpoint fails intermittently; use a proactive expiry warning (AUTH-06) instead |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Complete |
| AUTH-02 | Phase 1 | Complete |
| AUTH-03 | Phase 1 | Pending |
| AUTH-04 | Phase 1 | Pending |
| AUTH-05 | Phase 1 | Pending |
| AUTH-06 | Phase 1 | Complete |
| RIDE-01 | Phase 2 | Pending |
| RIDE-02 | Phase 2 | Pending |
| RIDE-03 | Phase 3 | Pending |
| TRACK-01 | Phase 3 | Pending |
| TRACK-02 | Phase 3 | Pending |
| TRACK-03 | Phase 3 | Pending |
| TRACK-04 | Phase 3 | Pending |
| TRACK-05 | Phase 3 | Pending |
| TRACK-06 | Phase 3 | Pending |
| LIFECYCLE-01 | Phase 4 | Pending |
| LIFECYCLE-02 | Phase 4 | Pending |
| LIFECYCLE-03 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 18 total
- Mapped to phases: 18
- Unmapped: 0 ✓

**Note:** RIDE-03 (cancel a pending/ongoing trip) was moved from Phase 2 to Phase 3 during roadmap creation — its always-reachable cancel affordance and immediate-reflection behavior (see TRACK-06) both depend on the pending-trip screen and rank-guarded trip-state reducer that are Phase 3 deliverables, not Phase 2's quote/booking flow. See .planning/STATE.md Decisions.

---
*Requirements defined: 2026-08-11*
*Last updated: 2026-08-11 after roadmap creation*
