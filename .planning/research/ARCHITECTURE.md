# Architecture Research

**Domain:** Rider-side real-time trip state synchronization — go-ride-user-app (Expo/React Native ride-hailing rider app)
**Researched:** 2026-08-11
**Confidence:** MEDIUM-HIGH (the transition-rank/single-funnel reconciliation pattern is a well-established distributed-systems technique — see Sources — applied here to this project's specific, verified backend contract; the folder structure, TanStack Query/Zustand split, and WS-singleton pattern are treated as fixed inputs per this project's `PROJECT.md`, not re-derived)

**Scope note:** This file deliberately does NOT re-propose the overall app architecture (folder layout, TanStack Query vs. Zustand split, WS-client-as-singleton) — those are locked decisions mirrored from `go-ride-driver-app`. It scopes to the three things this milestone's context calls out as genuinely new: the rider trip state machine, the HTTP/WS/polling reconciliation problem, and the live-map data flow.

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         PRESENTATION (trips feature)                     │
│  BookingScreen (fare quote + book CTA) · FindingDriverScreen ·           │
│  LiveTripMapScreen (assigned/started) · TripEndSummaryScreen             │
│  — all read the SAME trip store via granular selectors, no local copies  │
└───────────────┬───────────────────────────────────────┬─────────────────┘
                │                                        │
                │ selector reads                         │ selector reads
                ▼                                        ▼
┌───────────────────────────────┐      ┌──────────────────────────────────┐
│  Zustand: trip store           │◄─────┤  Zustand: trip store             │
│  { status, tripId, trip data,  │      │  (single store, shown twice for  │
│    driverLocation, isReconciling}      │   diagram clarity — status slice │
│                                 │      │   vs. driverLocation slice)      │
└───────────────▲─────────────────┘      └──────────────────────────────────┘
                │  ONLY writer: the trip reducer funnel (see Pattern 1)
                │
        ┌───────┴────────────────────────────────────────────┐
        │            applyTripEvent(event) — pure reducer      │
        │  rank-guarded transition table; single funnel for    │
        │  every source below, so none can regress the others  │
        └───────┬───────────────────┬───────────────────┬─────┘
                │                   │                   │
      normalize │         normalize │         normalize │
                │                   │                   │
┌───────────────┴──────┐ ┌──────────┴──────────┐ ┌──────┴─────────────────┐
│ HTTP mutation results │ │ WS client (singleton)│ │ GET /current-trip       │
│ POST /book-cab        │ │ ride_assigned,        │ │ (queryClient.fetchQuery,│
│ POST /cancel           │ │ trip_started,         │ │  triggered imperatively │
│ (cab-request-handler)  │ │ trip_ended,           │ │  by the realtime layer, │
│                        │ │ trip_completed,       │ │  NOT screen-mounted)    │
│                        │ │ trip_cancelled        │ │  (cab-request-handler)  │
│                        │ │ driver_location →     │ │                          │
│                        │ │  separate fast path    │ │                          │
│                        │ │  (Pattern 3, bypasses  │ │                          │
│                        │ │  the rank-guard)       │ │                          │
└────────────────────────┘ └──────────┬────────────┘ └──────────────────────────┘
                                       │ triggers reconciliation on:
                                       │  reconnect, app-foreground, watchdog timeout
                                       ▼
                            queryClient.fetchQuery(['current-trip'])
                            (see Pattern 2 — reconcile-first, never trust-next-push)
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|-------------------------|
| Trip reducer funnel (`applyTripEvent`) | Sole writer of trip **status** transitions; enforces the rank-guard so no source can regress state ahead of another | Pure function, framework-agnostic, unit-testable without any live connection |
| Trip store (Zustand) | Holds current trip status, trip data, driver location, and a boot-time `isReconciling` flag; exposes granular selectors | `stores/trip-store.ts`, mirrors `session-store.ts` conventions already in `go-ride-driver-app` |
| Event normalizers | Translate each source's raw payload (HTTP DTO, WS message, poll response) into one common `TripTransition` shape before it reaches the funnel | Three small pure functions, one per source, each colocated with its source module |
| WS client (singleton) | Owns rider WS connection lifecycle (connect, reconnect+backoff, AppState-aware suspend/resume); dispatches trip-status messages to the funnel and location messages to the fast path; fires reconciliation triggers | `realtime/websocket-client.ts` — already-decided pattern, extended here only with the dispatch/trigger logic specific to trip state |
| Reconciliation trigger | Decides *when* to call `GET /current-trip` (cold start, reconnect, foreground, watchdog) — never "wait for the next push" | Lives inside the WS client / app-lifecycle listener, not a component |
| Driver-location fast path | Applies `driver_location` pushes directly to the store's location slice, bypassing the status rank-guard, with its own last-write-wins ordering | Simple setter guarded only by message timestamp |
| Map screen + marker | Reads only the location slice; interpolates between the last two known points; owns camera-follow vs. user-pan state locally | `features/trips/components/DriverMarker.tsx`, `AnimatedRegion`/`Animated.ValueXY` |

## Recommended Project Structure

Scoped additions to the already-decided `features/trips/` and `stores/`/`realtime/` folders (per `go-ride-driver-app`'s structure, mirrored here):

```
src/
├── features/trips/
│   ├── state/
│   │   ├── trip-machine.ts        # types (TripStatus enum, TripTransition), transition table,
│   │   │                           #   rank map, applyTripEvent(prev, transition) — pure, no imports
│   │   │                           #   from React/Zustand/API, fully unit-testable in isolation
│   │   └── normalizers.ts          # bookingResponseToTransition(), wsMessageToTransition(),
│   │                                #   currentTripResponseToTransition() — one per source
│   ├── api.ts                      # TanStack Query hooks: fare quote, book (mutation),
│   │                                #   cancel (mutation), current-trip (imperative fetchQuery
│   │                                #   wrapper, also exposed for reconciliation triggers)
│   ├── screens/                    # BookingScreen, FindingDriverScreen, LiveTripMapScreen, ...
│   └── components/
│       ├── DriverMarker.tsx        # interpolated marker, camera-follow logic
│       └── FindingDriverStatus.tsx # soft "still looking..." timer UI (not a state, see Pattern 4)
├── stores/
│   └── trip-store.ts               # Zustand store; ONLY the reducer funnel + fast-path setter write to it
└── realtime/
    └── websocket-client.ts         # existing singleton; extended with trip-message dispatch +
                                     #   reconciliation triggers (reconnect/foreground/watchdog)
```

### Structure Rationale

- **`state/trip-machine.ts` has zero framework imports on purpose:** the highest-risk, most bug-prone logic in this milestone is the rank-guarded transition table. Keeping it a pure function (input: current status + a transition, output: next status or "ignored") makes it trivially unit-testable with fabricated out-of-order/duplicate events *before* any WS/HTTP plumbing exists — directly addresses the "no flicker, no conflicts" requirement at the cheapest point to verify it.
- **`normalizers.ts` is separate from the reducer:** each of the three sources (HTTP mutation, WS message, poll response) has a different wire shape but must produce the same internal `TripTransition` shape before touching the funnel. Keeping normalization separate from transition logic means adding a new WS message type or a new HTTP endpoint never requires touching the rank-guard itself.
- **The store has exactly one writer path for status** (the funnel) **and one separate writer for location** (the fast path) — this split is deliberate (Pattern 3) because location updates and status updates have different ordering semantics and mixing them into one rank-guarded pipeline would either over-guard location (dropping valid rapid updates) or under-guard status (losing the regression protection status needs).

## Architectural Patterns

### Pattern 1: Single-funnel, rank-guarded status reducer

**What:** Every trip-status-changing input — the `POST /book-cab` mutation's success payload, every status-bearing WS message (`ride_assigned`, `trip_started`, `trip_ended`, `trip_completed`, `trip_cancelled`), and every `GET /current-trip` poll response — is normalized into a common `TripTransition { tripId, status, ...data }` shape and passed through **one** function, `applyTripEvent`, before it can update the store. That function assigns each `TripStatus` a numeric rank (`idle=0 < quoted=1 < booking=2 < finding_driver=3 < driver_assigned=4 < trip_started=5 < trip_ended=6 < trip_completed=7`, with `cancelled` treated as an always-accepted terminal override for the current `tripId`) and rejects any transition whose rank is not greater than the current status's rank for the same `tripId` — except idempotent no-ops (same rank, same tripId, safe to ignore) and a genuinely new `tripId` (always accepted, since it means a fresh trip started, e.g., after a prior trip completed).
**When to use:** Always, for this store. No call site (mutation `onSuccess`, WS handler, poll `onSuccess`) is ever allowed to call `set()` on the trip store's status field directly.
**Trade-offs:** A small amount of indirection (every source calls a normalizer + the funnel instead of `set()` directly) versus eliminating an entire class of bugs: a duplicate or late-arriving `ride_assigned` WS message that lands after `trip_started` was already processed (plausible given the backend's "silent retry" dispatch behavior called out in `PROJECT.md`) is silently dropped instead of snapping the UI backward.

**Example:**
```typescript
// features/trips/state/trip-machine.ts
export type TripStatus =
  | 'idle' | 'quoted' | 'booking' | 'finding_driver'
  | 'driver_assigned' | 'trip_started' | 'trip_ended'
  | 'trip_completed' | 'cancelled';

const RANK: Record<TripStatus, number> = {
  idle: 0, quoted: 1, booking: 2, finding_driver: 3,
  driver_assigned: 4, trip_started: 5, trip_ended: 6,
  trip_completed: 7, cancelled: 99, // terminal override, not a "forward" rank
};

export interface TripTransition {
  tripId: string | null;
  status: TripStatus;
  data?: Partial<TripSnapshot>;
}

export function applyTripEvent(prev: TripSnapshot, next: TripTransition): TripSnapshot {
  const isNewTrip = next.tripId !== null && next.tripId !== prev.tripId;
  const isCancel = next.status === 'cancelled';
  const isForward = RANK[next.status] > RANK[prev.status];

  if (!isNewTrip && !isCancel && !isForward) {
    return prev; // stale/duplicate/out-of-order — ignored, no re-render, no flicker
  }
  return { ...prev, ...next.data, tripId: next.tripId, status: next.status };
}
```

### Pattern 2: Reconcile-first on every reconnect — never trust the next push

**What:** On WS reconnect, app-foreground transition (after backgrounding), or cold start with a possibly-active trip, the app does **not** wait for the next WS push to "catch it up." It immediately issues a `GET /current-trip` fetch (via `queryClient.fetchQuery`, so it benefits from the same retry/dedup machinery as the rest of this app's HTTP calls) and feeds the normalized response through the same `applyTripEvent` funnel as everything else.
**When to use:** Always, for this app specifically — unlike `go-ride-driver-app`'s job-offer WS, which the driver app's own research confirmed replays pending state to the client on reconnect, `PROJECT.md` documents no such replay guarantee for the rider WS (`/ws/rider` is explicitly "push-only... `GET /current-trip` is the polling-based recovery path for a missed/dropped WS connection, not the primary update mechanism"). Given that asymmetry, assuming replay-on-reconnect here would be an unverified, unsafe assumption.
**Trade-offs:** One extra HTTP round-trip on every reconnect/foreground event versus a real risk of silently missing a status change that happened entirely during the disconnected window (e.g., driver assigned and then trip cancelled, both while the socket was down) — cheap insurance given trip correctness is the core value proposition (`PROJECT.md`: "without losing track of their trip state even through a dropped WebSocket connection").

Reconciliation triggers, concretely:
1. **Cold start / app relaunch:** before rendering any trip-dependent screen, fetch `current-trip` once. Render a loading/skeleton state during this window — never render "no active trip" as a default while the fetch is in flight, since that default-then-flip is exactly the flicker this pattern exists to prevent. Model this as an `isReconciling: boolean` on the store, checked by the router/guard that decides which trip screen (if any) to show.
2. **WS `onopen` after a prior `onclose`/`onerror`** (i.e., every reconnect, not the very first connect): fetch `current-trip`.
3. **`AppState` foreground transition while a trip is non-terminal:** proactively reconnect the WS *and* fetch `current-trip`, regardless of whether the socket reports itself as still "connected" — mirrors `go-ride-driver-app`'s own documented pitfall that Android can suspend a backgrounded socket without firing a close event, leaving the client's local "connected" flag stale.
4. **Watchdog timeout:** if the trip is in a non-terminal, WS-relevant status (`finding_driver`, `driver_assigned`, `trip_started`) and no WS message of any kind (including `driver_location` pings) has arrived for N seconds (needs tuning against the real push cadence — LOW confidence placeholder, not verified against backend source), treat the connection as suspect: reconnect and fetch `current-trip` once. This is deliberately a one-off nudge, not a continuous poll loop — continuous polling alongside a working WS is the anti-pattern the driver app's own research explicitly flagged (battery drain, double-processing risk); this app's poll endpoint exists specifically for *recovery*, not as a steady-state second channel.

### Pattern 3: `driver_location` bypasses the status rank-guard entirely

**What:** `driver_location` WS messages update a separate `driverLocation` slice of the trip store through a lightweight, independent setter — not through `applyTripEvent`. This setter's only guard is a timestamp check (`newTimestamp > lastLocationTimestamp`, dropping anything older) since location has continuous last-write-wins semantics, unlike the discrete, one-directional trip-status lifecycle.
**When to use:** Any high-frequency, continuously-updating field that shares a WS connection with discrete lifecycle events but has fundamentally different ordering needs.
**Trade-offs:** Two write paths into one store instead of one, but running location through the status rank-guard would be actively wrong — location isn't a "state" with a rank, it's a value that just needs the latest sample, and forcing it through a lifecycle-oriented reducer would either block legitimate rapid updates or require bolting on a second, incompatible guard concept.

**Example:**
```typescript
// realtime/websocket-client.ts (message dispatch, added to existing singleton)
private handleMessage(msg: RiderWSMessage) {
  switch (msg.type) {
    case 'driver_location':
      useTripStore.getState().updateDriverLocation(msg.payload); // fast path, no funnel
      break;
    case 'ride_assigned':
    case 'trip_started':
    case 'trip_ended':
    case 'trip_completed':
    case 'trip_cancelled':
      applyTripEvent(useTripStore.getState(), wsMessageToTransition(msg)); // funnel
      break;
  }
  this.lastMessageAt = Date.now(); // feeds Pattern 2's watchdog trigger
}
```

### Pattern 4: "Still finding driver" is UI copy, not a state

**What:** Because the backend silently retries dispatch with no fail-fast signal (per `PROJECT.md`), the `finding_driver` status does not time out into some client-invented `finding_driver_failed` state. Instead, a local, presentation-only timer (in `FindingDriverStatus.tsx`, not the store) escalates the *copy* shown ("Looking for a driver..." → "Still looking, this is taking a bit longer than usual...") purely for reassurance, while the underlying trip status remains `finding_driver` until a real WS/poll-sourced transition arrives (`driver_assigned` or `cancelled`).
**When to use:** Any time the backend contract has no failure signal for a long-running async state — inventing a client-side failure state here would be actively wrong (it isn't real, and a late `driver_assigned` event would then have to "undo" it, reintroducing exactly the flicker/conflict this whole design avoids).
**Trade-offs:** The rider only ever sees "cancel" as an available user-initiated exit from `finding_driver` (never an automatic "search failed" state) — correct given the backend has no such signal, but should be paired with a generous, explicit cancel affordance in the UI so the rider isn't left with no recourse if dispatch genuinely never resolves.

## Data Flow

### Booking → live tracking (the critical path)

```
BookingScreen: fare quote (TanStack Query) → user taps "Book"
        │
        ▼
POST /book-cab (idempotent, Idempotency-Key header)
        │
   ┌────┴─────┐
 200 OK     network error/timeout
   │            │
   ▼            ▼
normalize →  TanStack Query's own retry (same Idempotency-Key,
applyTripEvent  safe to retry — backend dedupes)
   │
   ▼
status: 'finding_driver', tripId set — navigate to FindingDriverScreen
        │
        │  (meanwhile, independently, WS singleton is already connected
        │   and may push ride_assigned before or after the HTTP response
        │   resolves — both paths funnel through applyTripEvent, so
        │   whichever arrives "first" in rank wins, no race condition)
        ▼
WS: ride_assigned → applyTripEvent → status: 'driver_assigned'
        │
        ▼
navigate to LiveTripMapScreen; WS: driver_location → fast path (Pattern 3)
        │
        ▼
WS: trip_started → applyTripEvent → status: 'trip_started'
        │
        ▼
WS: trip_ended → applyTripEvent → status: 'trip_ended' (show final fare)
        │
        ▼
WS: trip_completed → applyTripEvent → status: 'trip_completed' (cash confirmed)
        │
        ▼
reset to 'idle' after user dismisses summary (new tripId next time resets cleanly)
```

### Reconnect reconciliation flow

```
WS onclose/onerror (network blip) OR AppState → active
        │
        ▼
WS client: reconnect w/ backoff  ──in parallel──►  queryClient.fetchQuery(['current-trip'])
        │                                                    │
        ▼                                                    ▼
  onopen: resume push handling                normalize → applyTripEvent
        (Pattern 3's watchdog resets)          (rank-guard means this is safe even if
                                                 a WS push already arrived first, or
                                                 arrives moments later — no double-apply,
                                                 no regression either direction)
```

### Cancellation flow (can interrupt any non-terminal status)

```
Rider taps Cancel (any status: booking/finding_driver/driver_assigned)
        │
        ▼
POST /cancel → normalize → applyTripEvent (rank 99, always wins) → status: 'cancelled'
        │
        ▼
   (independently) WS trip_cancelled may also arrive — rider- or system/driver-
   initiated, pushed unconditionally per PROJECT.md's verified backend behavior —
   normalize → applyTripEvent → same 'cancelled' status, idempotent no-op if
   already cancelled locally
```

### Key Data Flows

1. **Three sources, one funnel:** HTTP mutation results, WS status messages, and `GET /current-trip` poll responses are structurally different at the wire level but converge on one normalized shape and one reducer — this is the single most important property for avoiding flicker/conflicts, and it should be enforced with a lint-level convention (no direct `set()` calls on trip status from outside `trip-machine.ts`) as much as by discipline.
2. **Reconciliation is proactive, not reactive:** the app never waits to "see what the next WS message says" after a reconnect — it always asks `GET /current-trip` first, because the rider WS has no documented replay-on-reconnect guarantee (verified difference from the driver app's job-offer WS).
3. **Location and status are decoupled data flows sharing one transport:** both arrive over the same WS connection but update different store slices through different guard logic, because they have fundamentally different ordering semantics (discrete lifecycle vs. continuous last-write-wins).

## Scaling Considerations

Single-tenant mobile client — "scale" here means correctness under flaky connectivity and growing trip-lifecycle complexity, not concurrent load (backend's concern).

| Stage | Architecture Adjustments |
|-------|--------------------------|
| MVP (this milestone) | Rank-guarded reducer as described; watchdog-triggered reconciliation only (no steady-state polling); foreground-only tracking |
| Post-MVP (multi-stop trips, scheduled rides, richer cancellation reasons) | The transition table in `trip-machine.ts` grows branches; if it stops being a simple linear rank order (e.g., a trip can legitimately move between non-adjacent statuses depending on trip type), that's the signal to migrate this slice to a proper state-machine library (XState) — same escape hatch the driver app's own research already identified for its trip lifecycle, not a new decision here |
| Mature (payment gateway, driver ratings affecting matching, live ETA recalculation) | `driver_location` fast path likely needs its own throttling/interpolation tuning pass once ETA math depends on it; still doesn't change the funnel/fast-path split |

### Scaling Priorities

1. **First risk: watchdog timing tuned wrong.** Too short → unnecessary reconnect/poll churn and battery drain; too long → a silently-dead socket (Android background suspension, same failure mode the driver app's research documented) goes undetected for too long during an active trip. This needs to be validated against the real `location-producers`/`websocket-gateway` push cadence during implementation, not guessed — flagged as an open question below.
2. **Second risk: transition table complexity creep.** Keeping `applyTripEvent` a flat rank order works cleanly for this milestone's linear lifecycle; the moment a future requirement needs non-linear transitions (e.g., a trip that can return to `finding_driver` after a mid-trip driver reassignment), don't bolt exceptions onto the rank map — that's the trigger to reconsider the state-machine approach entirely.

## Anti-Patterns

### Anti-Pattern 1: Separate booleans instead of one status enum

**What people do:** `isBooking`, `isFindingDriver`, `isAssigned`, `isTripStarted` as independent flags on the store, set individually by whichever handler runs.
**Why it's wrong:** Nothing prevents two flags from being true simultaneously (a late WS message setting `isAssigned = true` after a poll response already set `isTripStarted = true`), which is precisely the flicker/conflict this milestone's context calls out as the thing to avoid.
**Do this instead:** One `status: TripStatus` enum field, written only through the rank-guarded funnel (Pattern 1).

### Anti-Pattern 2: Trusting the next WS push to "catch up" after reconnect

**What people do:** On reconnect, just resume listening and assume the next push reflects current reality, since that's how the driver app's job-offer WS (which does replay) behaves.
**Why it's wrong:** The rider WS has no documented replay-on-reconnect contract (verified in `PROJECT.md`) — a status change that happened entirely during the disconnected window would never arrive, leaving the rider stuck on a stale status indefinitely.
**Do this instead:** Always reconcile via `GET /current-trip` immediately on reconnect (Pattern 2).

### Anti-Pattern 3: Letting `GET /current-trip` responses bypass the rank-guard

**What people do:** Treat the poll response as unconditionally authoritative ("it's the source of truth, just overwrite the store with it") since it's a full snapshot rather than a delta.
**Why it's wrong:** A poll request can be in flight for a moment during which a WS push arrives and is already applied (Pattern 1's funnel processes it immediately); if the poll response is then applied without going through the same funnel, it can regress the store to an older snapshot than what's already showing.
**Do this instead:** Every source, including full-snapshot poll responses, goes through the exact same `applyTripEvent` funnel — "it's a full snapshot" doesn't exempt it from the rank check, it just means its `data` payload is more complete.

### Anti-Pattern 4: Steady-state polling alongside a healthy WS connection

**What people do:** Add a `setInterval` calling `GET /current-trip` every few seconds "just in case," on top of the WS connection, as a blanket safety net.
**Why it's wrong:** Unlike the driver app's job-offer path (where the driver app's own research flagged this as dead code — no REST fallback endpoint even exists there), this app's `/current-trip` endpoint *does* exist and is meant for recovery — but continuous polling still burns battery and creates unnecessary races with the WS path for no reliability gain once the watchdog/reconnect/foreground triggers (Pattern 2) are in place.
**Do this instead:** Event-triggered reconciliation only (reconnect, foreground, watchdog timeout, cold start) — never a bare interval.

### Anti-Pattern 5: Snapping the map marker directly to each new coordinate

**What people do:** Set the marker's `coordinate` prop directly from each `driver_location` push, relying on `react-native-maps`' default behavior.
**Why it's wrong:** With location pushes arriving every few seconds (exact cadence not yet verified against the backend — see Open Questions), directly-set coordinates produce a visibly jumpy, teleporting marker rather than a moving-car effect.
**Do this instead:** Interpolate between the last two known points using `AnimatedRegion`/`Animated.ValueXY` with a duration matched to the expected push interval, per the researched `react-native-maps` pattern (Sources).

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| `cab-request-handler` — `POST /book-cab`, `POST /cancel`, `GET /current-trip`, fare quote | REST, JWT-authenticated, TanStack Query (mutations + imperative `fetchQuery` for reconciliation) | Booking is idempotent via `Idempotency-Key`; `current-trip` is the recovery-only endpoint, never the primary update path |
| `websocket-gateway` — `GET /api/v1/ws/rider?token=...&device_id=...` | WebSocket, push-only, no ack protocol from the rider (verified in `PROJECT.md`) | No documented replay-on-reconnect for the rider route (contrast with the driver app's job-offer replay) — this asymmetry is the direct justification for Pattern 2 |
| Google Maps (`react-native-maps`) | Native SDK, shared config with `go-ride-driver-app` per `PROJECT.md` | Marker interpolation via `AnimatedRegion`/`Animated.ValueXY`; platform-specific APIs differ (Android: `animateMarkerToCoordinate`; iOS: `coordinate.timing(...).start()` — iOS untested per this project's Android-first constraint) |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Screens ↔ trip store | Granular Zustand selectors only (e.g., `useTripStore(s => s.status)`, `useTripStore(s => s.driverLocation)`) | Prevents the map screen re-rendering on status-only changes and vice versa — matters here specifically because `driverLocation` updates at a much higher frequency than `status` |
| HTTP mutations / WS client / poll fetch ↔ trip store | All three write exclusively through `applyTripEvent` (status) or `updateDriverLocation` (location) — never a direct `set()` from a screen or hook | This is the load-bearing boundary for the entire "no conflicts" requirement; worth enforcing via code review convention since Zustand itself won't stop a stray `set()` call |
| WS client ↔ reconciliation trigger | The WS client's own `onopen`/`onclose` and message-timestamp bookkeeping decide when to call `fetchQuery(['current-trip'])` — this logic lives in `realtime/`, not in a screen's `useEffect` | Consistent with the already-decided rule that realtime lifecycle must outlive any single screen's mount |
| Map screen ↔ camera state | Local component state (`userInteracting`), not the trip store | Camera-follow-vs-user-pan is a presentation concern specific to one screen, not shared app state — keeping it out of the store avoids re-render churn on every pan gesture |

## Open Questions (flag for phase-specific research)

- **`driver_location` push cadence and whether messages carry a server timestamp** — needed to tune both the marker-interpolation duration and the watchdog timeout precisely. Not verified against `location-producers`/`websocket-gateway` source during this research pass; recommend a targeted check against that service's source (or a live capture) before implementing Pattern 2's watchdog and Pattern 3's interpolation timing.
- **Exact `GET /current-trip` response shape when there is no active trip** (404 vs. `200` with a null/empty body) — determines whether the cold-start reconciliation call can distinguish "no trip" from "request failed," which matters for not showing a false error state on ordinary app opens.

## Sources

- [WebSocket.org — Reconnection: State Sync and Recovery Guide](https://websocket.org/guides/reconnection/) — MEDIUM confidence, vendor-neutral guide; corroborates the "always reconcile via full-state fetch on reconnect rather than assuming replay" strategy (Pattern 2) as one of the standard approaches when no server-side replay/sequence-number contract exists
- [WebSocket.org — Best Practices for Production Applications](https://websocket.org/guides/best-practices/) — MEDIUM confidence, general reconnection/backoff guidance, consistent with the already-decided WS-singleton pattern this file builds on
- [Christopher Hunt — Event-driven Finite State Machines](https://christopherhunt-software.blogspot.com/2021/02/event-driven-finite-state-machines.html) and [Event-driven finite-state machine — Wikipedia](https://en.wikipedia.org/wiki/Event-driven_finite-state_machine) — MEDIUM confidence, corroborates modeling multi-source real-time updates as an explicit state machine with a defined transition table rather than ad hoc flags (Anti-Pattern 1)
- General distributed-systems out-of-order-event handling discussion (rank/version-guarded transitions as an alternative to full sequence-number replay when the latter isn't available server-side) — MEDIUM confidence, standard technique, not sourced from a single authoritative doc but consistent across multiple WebSearch results this session
- [react-native-maps — `AnimatedRegion`/marker interpolation discussion, GitHub issue #2382](https://github.com/react-native-maps/react-native-maps/issues/2382) and [community `AnimatedRegion`/`animateMarkerToCoordinate` examples](https://swapnilwatkar.medium.com/how-to-animate-marker-position-on-google-map-in-react-native-35e44e9d2f28) — MEDIUM confidence, corroborated across multiple community sources for the platform-specific interpolation APIs cited in Anti-Pattern 5
- This project's own `.planning/PROJECT.md` — HIGH confidence, authoritative for the rider WS contract (push-only, no ack, `GET /current-trip` as recovery-only) and the verified `trip_cancelled` unconditional-push behavior that Pattern/flow sections above depend on
- `go-ride-driver-app/.planning/research/ARCHITECTURE.md` and `go-ride-driver-app/.planning/research/PITFALLS.md` (sibling repo, checked out locally) — HIGH confidence for this project's own already-decided conventions (WS-singleton pattern, Zustand store shape/selector discipline, AppState-background-suspension pitfall); used to confirm this file's new patterns are consistent with, and correctly identify divergences from (e.g., replay-on-reconnect not being guaranteed for riders), the sibling app's own verified research
- `go-ride-driver-app/src/stores/session-store.ts` (sibling repo source, read directly) — HIGH confidence, concrete example of this project's actual established Zustand store conventions, mirrored in this file's code examples

---
*Architecture research for: Rider trip state synchronization (go-ride-user-app)*
*Researched: 2026-08-11*
