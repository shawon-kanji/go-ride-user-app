# Pitfalls Research

**Domain:** Ride-hailing rider/passenger mobile app (React Native/Expo, Android-first) — realtime WebSocket tracking, live map rendering, fare-quote booking, dispatch-retry waiting UX
**Researched:** 2026-08-11
**Confidence:** MEDIUM-HIGH (WebSocket/Android lifecycle and react-native-maps gotchas verified via GitHub issues, official docs, and multiple independent sources; ride-hailing dispatch-UX patterns are MEDIUM confidence, cross-referenced across system-design writeups but not a single authoritative spec — the specific "silent retry, no fail-rider signal" backend behavior is a confirmed project-specific constraint from PROJECT.md, not an external source)

## Critical Pitfalls

### Pitfall 1: Silent Dispatch Retry Misread as a Frozen App

**What goes wrong:**
The backend's dispatch/matching process silently retries against the next candidate driver if the first attempt finds nobody — there is no explicit "no drivers available" push to the rider (confirmed in PROJECT.md: "dispatch/matching process that can silently retry with NO fail-rider signal if no driver is found on the first attempt"). If the UI shows a generic "Finding driver..." spinner with no elapsed-time signal or retry count, riders cannot distinguish "system is working, just a hard match" from "system is broken." Industry pattern confirms this exact trap: "the message 'We're finding you a driver' can be misleading when matches fail... after the rider has been waiting following a retry, their tolerance is lower and they're closer to abandoning the ride." With no backend-driven "no drivers available" event to react to, an app that models "finding driver" as a single boolean state will either spin forever or eventually time out client-side with no help from the server about *why*.

**Why it happens:**
The dispatch retry loop is entirely internal to `cab-request-handler`/`trip-dispatch-worker` — from the rider app's perspective, the only observable signal is "still no `driver_assigned` event yet." Developers build the naive version first (spinner + WS listener for `driver_assigned`) because it's the only thing the backend directly tells you, and defer the "what if it never comes" case as a follow-up that often doesn't get revisited.

**How to avoid:**
- Client-side timeout ladder, not a single infinite spinner: escalate the *message* (not necessarily the backend state) at fixed intervals — e.g., 0-15s "Finding your driver...", 15-45s "Still looking — this can take a moment in your area...", 45s+ "Taking longer than usual" with an explicit, prominent "Cancel search" action.
- Treat "still searching past N seconds" as a first-class UI state distinct from "just started searching," driven purely by a client-side timer since the backend gives no retry-count signal — do not try to infer retry count from WS traffic that doesn't exist.
- Always give the rider an explicit, low-friction way out (cancel button that's reachable, not buried) — since the backend won't proactively tell them to give up, the app must let them choose to.
- Log/instrument time-to-`driver_assigned` distribution in production so you can tune the timeout ladder thresholds against real dispatch latency instead of guessing.

**Warning signs:**
- QA reports "the app seems stuck" during manual testing of a no-driver-available scenario (empty driver pool in a test environment) — if this happens in dev, it will happen in production far more often since driver supply fluctuates.
- The waiting screen has no elapsed-time indicator or only a single static string for the entire wait duration.
- Cancel action is a small text link rather than a visible button.

**Phase to address:**
Fare-Estimate-and-Book (booking triggers the search) and Realtime-Tracking (the waiting-state UI itself, since it's driven by the WS `driver_assigned` event or its absence). This is the single most important UX pitfall for this app given the confirmed backend constraint — the roadmap should treat "finding driver" as its own explicit state machine, not a byproduct of the booking screen.

---

### Pitfall 2: WebSocket Reconnect Storm on Android Background/Foreground Churn

**What goes wrong:**
Naive reconnect logic (e.g., "on any close event, reconnect immediately") combined with React Native's `AppState` transitions on Android (background → active happens frequently: notification shade pulls, app switcher, screen lock/unlock) can spawn multiple concurrent WebSocket connections or hammer the server with immediate retries with no backoff. Each reconnect re-authenticates against `websocket-gateway` via the query-string token, so a storm also multiplies auth/connection load server-side and can produce out-of-order or duplicated event delivery to the client if old and new sockets briefly overlap.

**Why it happens:**
Developers often wire "connection closed" directly to "reconnect now" without a singleton guard or backoff, and don't realize that Android fires multiple `AppState` change events during a single user gesture (e.g., pulling the notification shade can trigger `background` then `active` within a second). Without deduplication, this creates a burst of reconnect attempts.

**How to avoid:**
- Use a singleton WebSocket service (single instance app-wide, not one per screen/hook) with explicit connection-state tracking (`idle`/`connecting`/`open`/`closing`) so a reconnect is only ever attempted from `idle` or `closed` states, never re-entrantly.
- Reconnect with exponential backoff + jitter (e.g., 1s, 2s, 4s, 8s, capped at ~30s), not immediate retry.
- Debounce `AppState` transitions — only treat the app as "backgrounded" after a short delay (e.g., 500ms-1s) of sustained background state, to filter out transient OS-level flicker.
- Explicitly close the socket on background (rather than letting it die silently) and reconnect deliberately on foreground, rather than trying to keep it alive through backgrounding — this also avoids burning battery/data while the rider isn't looking at the screen.

**Warning signs:**
- Server-side logs show the same `device_id`/token opening multiple WS connections within seconds of each other.
- Duplicate or out-of-order trip-status events observed client-side in testing.
- Reconnect attempts visible in logs with no increasing delay between them.

**Phase to address:**
Realtime-Tracking — this is where the WS client is built. Should be a documented, testable behavior (not just "we have reconnect logic") with explicit backoff and singleton-connection tests before the phase is considered done.

---

### Pitfall 3: Missed WS Events During Backgrounding/Doze — Stale Trip State With No Replay

**What goes wrong:**
Android's Doze mode and App Standby terminate idle TCP connections (including WebSockets) after sustained inactivity to save battery — this is documented, standard Android behavior, not a bug. Because this rider WS connection is push-only with no ack protocol (confirmed in PROJECT.md), there's no mechanism for the client to say "I missed messages between timestamp X and now, replay them." If a `driver_assigned`, location update, or `trip_cancelled` event fires while the socket is silently dead (app backgrounded, screen off, Doze engaged), the rider's UI simply never updates — and because there's no ack, the *client itself* may not even know the connection died until the next reconnect attempt or a stale-data timeout fires.

**Why it happens:**
Doze/App Standby is invisible to app code unless you specifically test for it (it only engages after a device has been stationary/screen-off for a while — easy to miss in day-to-day emulator/simulator testing where the device state never triggers it). Developers test "kill the WS server" or "airplane mode toggle" but rarely test "leave the app backgrounded on a real device for 10+ minutes."

**How to avoid:**
- Treat `GET /current-trip?rider_id=...` polling as the *primary* recovery mechanism on every foreground transition, not a rare fallback — poll it every time the app returns to foreground, regardless of whether the WS "looks" connected, since a silently-dead socket won't self-report.
- Add a heartbeat/staleness check: if no WS message (including any server ping/pong, if the gateway supports one) has been received within a threshold (e.g., 30-45s) while the app is foregrounded and a trip is active, proactively trigger a reconnect + `/current-trip` poll rather than trusting the socket's apparent open state.
- Never let the UI trust "last known trip state from WS" as ground truth after any backgrounding event — always reconcile against a fresh `/current-trip` fetch on resume.
- Test explicitly on a real Android device with the screen off and app backgrounded for 5-15 minutes during an active trip, not just in an emulator (Doze timing is unreliable/instant in emulators and won't reproduce the real bug).

**Warning signs:**
- Trip status shown to the rider is stale after they unlock their phone (e.g., still shows "finding driver" when the trip actually started minutes ago).
- No polling call fires on `AppState` → `active` transition in the codebase.
- No distinction in the client between "WS object reports open" and "WS is actually delivering messages."

**Phase to address:**
Realtime-Tracking (WS client + reconnect design) and Trip-Lifecycle (the `/current-trip` polling recovery path is explicitly a requirement in PROJECT.md — "Rider recovers trip state via polling if the WebSocket connection was missed or dropped"). This pitfall is exactly why that requirement exists; the roadmap should treat polling-on-resume as non-optional, always-on behavior, not an edge-case fallback.

---

### Pitfall 4: Stale UI After Reconnect (Silent Reconnect Success, UI Still Shows Old State)

**What goes wrong:**
A WS client can technically reconnect successfully (new socket open, auth accepted) while the UI layer never re-triggers a state refresh — the reconnect logic lives in a networking module that's decoupled from the screen's rendering state, so the screen keeps showing whatever it last rendered (e.g., a spinner, a stale driver position, a completed-looking trip) even though the underlying data pipe is healthy again. This is a common gap because "reconnect" and "resync UI" are treated as the same problem when they're actually two separate ones.

**Why it happens:**
Reconnect logic is often built and tested in isolation (does the socket open again? yes, done) without an explicit contract that "socket reopened" must trigger a state resync, not just a return to listening for new events. If the rider's trip changed state entirely while disconnected (e.g., cancelled, or driver already arrived), simply resuming the event listener without also fetching current state leaves the UI wrong until the *next* event happens to arrive.

**How to avoid:**
- On every successful reconnect (not just app-foreground), trigger a `/current-trip` fetch to reconcile state — treat reconnect as "resync then resume listening," never just "resume listening."
- Make trip state a single source of truth (e.g., one TanStack Query cache entry) that both the WS event handler and the polling fetch write into, so neither path can leave the other stale.
- Add a visible (even if subtle) "reconnecting..."/"back online" transient indicator so the rider has feedback that the app noticed the interruption, rather than silently hoping the old UI was still correct.

**Warning signs:**
- Manual test: disconnect WS mid-trip (toggle airplane mode), change trip state via another channel (e.g., cancel from a test/admin tool), reconnect — if the UI doesn't update until some unrelated future event, this pitfall is present.
- Reconnect handler code has no explicit refetch call, only `ws.addEventListener` re-registration.

**Phase to address:**
Realtime-Tracking, verified against Trip-Lifecycle scenarios (cancellation, completion) since those are the state transitions most likely to be missed.

---

### Pitfall 5: Raw Lat/Lng Marker Jank (No Interpolation Between Updates)

**What goes wrong:**
If the driver marker's position is set directly from each raw location update (`marker.setCoordinate(newLatLng)`), the marker visibly "teleports" or jumps between points rather than gliding, especially if updates arrive at a low or irregular frequency (every few seconds, common for battery-conscious location producers) or the underlying location publish itself is jittery (GPS noise). react-native-maps' own animation primitives (`Marker.Animated`/`AnimatedRegion`) have known lag/performance issues, especially on Android and with custom marker icons, and naive high-frequency `setState` updates on every location tick will cause map re-render storms and frame drops.

**Why it happens:**
It's the simplest thing to build first — subscribe to location events, set marker coordinate — and looks "done" in a quick demo where updates happen to arrive smoothly. The jank only becomes obvious with real network jitter or infrequent update intervals, which is exactly the production condition (mobile networks, battery-optimized publish intervals from `location-producers`).

**How to avoid:**
- Interpolate/animate between the last known position and each new position over the expected update interval (e.g., using `AnimatedRegion.timing()` or a `react-native-reanimated`-driven approach) rather than snapping.
- Throttle re-renders: don't tie marker position directly to raw event-driven React state updates on every tick if updates can arrive in bursts — batch/coalesce if needed.
- Use lightweight marker rendering (avoid heavy custom marker images/components that resize on every update) since custom markers are specifically known to cause lag on Android.
- Decide and document the expected update cadence from `location-producers`/`websocket-gateway` early (verify actual interval, don't assume) so animation duration matches reality rather than guessing.

**Warning signs:**
- Marker visibly snaps/jumps in manual testing rather than gliding.
- Frame drops or map stutter reported on mid-range Android devices (not just high-end test devices).
- No animation/interpolation code exists around marker position updates — position is set directly from the raw WS payload.

**Phase to address:**
Realtime-Tracking. Should be validated on a real mid-range Android device (not just an emulator or flagship phone), since GPU/animation performance varies significantly on Android and this is Android-first per PROJECT.md.

---

### Pitfall 6: Stale "Last Known Location" When Driver Goes Out of Range or Location Feed Stops

**What goes wrong:**
If the driver's location publishing stops (app backgrounded on the driver's side, driver's connectivity drops, driver's GPS loses fix, or `location-producers`/`location-consumers` pipeline has a gap), the rider app has no signal that the location it's displaying is stale — the marker simply stops moving and the rider has no way to know whether the driver is stuck in traffic or the data pipe is dead. Without an explicit "last updated" timestamp check, a rider can stare at a driver marker that hasn't moved in 10 minutes with zero indication that anything is wrong.

**Why it happens:**
The naive implementation only handles the "happy path" of continuous updates; there's no monitoring for "how long since the last update," because that requires tracking a timestamp and comparing against wall-clock time on every render tick or via a timer, which is easy to skip in an MVP build.

**How to avoid:**
- Track a `lastLocationUpdateAt` timestamp alongside the driver's coordinates, and surface a UI signal (e.g., dim the marker, add a "last updated Xs ago" note, or a toast) if it exceeds a threshold (e.g., 30-60s with no update while a trip is active) — don't leave the rider guessing.
- Distinguish this from a WS disconnect (Pitfall 3) — the socket can be alive and healthy while the *driver's own* location stream has stalled server-side; these need separate detection logic.
- Consider a lightweight periodic re-request or nudge (if the backend supports it) rather than passively waiting, though this depends on what `cab-request-handler`/`websocket-gateway` actually expose — verify before assuming a "request fresh location" capability exists.

**Warning signs:**
- No timestamp stored with the driver's location state.
- QA/testing never simulates "driver stops sending updates mid-trip" (e.g., by killing the driver app's connection in a test).

**Phase to address:**
Realtime-Tracking.

---

### Pitfall 7: Fare Quote Expiry — Booking Fails Silently After a Stale `fare_id`

**What goes wrong:**
The fare quote has an `expires_at` the rider must book before. If the rider takes too long on the booking screen (reading terms, comparing prices, getting distracted by a notification) and then taps "Book," the backend will reject the stale `fare_id` — but if the client doesn't specifically handle this error case, the failure can present as a generic error toast, an unresponsive button, or worst case a swallowed exception that leaves the rider unsure whether they booked a ride or not (a genuinely dangerous ambiguity in a ride-hailing context, since double-booking anxiety or "did it work?" uncertainty drives repeated taps and potential duplicate requests).

**Why it happens:**
Happy-path booking flows are built and tested with fresh quotes (request quote, immediately book, in the same test session) so the expiry case never triggers during normal development. The specific server error for "quote expired" may not be distinguished from other 4xx errors in client error-handling code, so it falls through to a generic message that doesn't tell the rider what actually happened or what to do next.

**How to avoid:**
- Surface the quote's `expires_at` visibly in the UI (e.g., a visible countdown or subtle timer) before the rider taps "Book," so expiry is expected rather than a surprise.
- Explicitly handle the "quote expired" error response as its own case — distinct message ("Your fare quote expired — let's get you a fresh one") plus an automatic or one-tap re-quote action, not a generic error banner.
- Disable/re-fetch proactively: if the countdown reaches zero while the rider is still on the screen, auto-refresh the quote (or clearly prompt them to) rather than waiting for a failed booking attempt to reveal the problem.
- Guard against double-submission on the book action (disable button immediately on tap, rely on backend idempotency as the safety net, not the primary defense) — this is a related but distinct trap: if a rider taps "Book" multiple times while unsure if the first tap registered (compounded by an expired-quote failure with unclear messaging), duplicate request risk goes up even with backend idempotency.

**Warning signs:**
- No `expires_at` countdown or freshness indicator anywhere on the booking screen.
- Error handling code around the book-cab call has only a generic catch-all, no specific branch for the expired-quote error code/message.
- Manual test: request a quote, wait past its expiry window, then tap book — if the resulting UX is a confusing generic error, this pitfall is present.

**Phase to address:**
Fare-Estimate-and-Book — this is the phase that owns the quote-to-booking flow end to end and should treat expiry as a first-class, designed-for state, not an edge case discovered late.

---

### Pitfall 8: Google Maps API Key Works in Dev, Blank Map or Crash in Production Android Build

**What goes wrong:**
`react-native-maps` on Android requires the Google Maps API key to be present in the generated `AndroidManifest.xml` as a `<meta-data android:name="com.google.android.geo.API_KEY">` entry. Multiple independent, current sources confirm two related traps that compound each other: (1) an API key restricted by SHA-1 signing fingerprint (which PROJECT.md confirms is already the case for this project — "Android-restricted Maps API key") will render a blank map with only a Google logo, or crash with an "API key not found" exception, if the SHA-1 fingerprint used to sign the actual build doesn't match what's configured in Google Cloud Console; and (2) with Expo config plugins, environment-variable references (e.g., `process.env.GOOGLE_MAPS_API_KEY`) can leak through literally into the generated manifest as the string `"process.env.GOOGLE_MAPS_API_KEY"` instead of being resolved, silently breaking the map in a way that looks identical to a bad/missing key. Development builds (debug keystore, Expo dev client with a differently-configured key or unrestricted key) can work perfectly while EAS production builds (release keystore, different SHA-1) fail — "a classic mistake is forgetting to properly restrict your API keys... they might work perfectly in your development build but then silently fail in production."

**Why it happens:**
Debug and release Android builds are signed with different keystores (and therefore different SHA-1 fingerprints) by default. If only the debug SHA-1 (or EAS's default managed debug credential) is registered against the restricted API key in Google Cloud Console, everything looks fine through the entire development cycle and only breaks the first time a real release/production build is tested — often discovered very late, close to a store submission deadline.

**How to avoid:**
- Register **every** SHA-1 fingerprint that will ever sign a build against the restricted API key in Google Cloud Console: local debug keystore, EAS-managed debug credential (if used), and the actual EAS production/release keystore — verify via `eas credentials` or the Google Play Console's App Signing page for the real production fingerprint, don't assume it matches local debug.
- Set the key via the `react-native-maps` Expo config plugin's `androidGoogleMapsApiKey` field (or `android.config.googleMaps.apiKey` in `app.json`) using the literal key value, not an unresolved environment-variable reference that config plugins may fail to substitute — confirm the generated `AndroidManifest.xml` after `expo prebuild` actually contains the resolved key, not a placeholder string.
- Test with an actual EAS production/preview build (not just the dev client) before assuming the map integration is done — the dev client and Expo Go both commonly mask this class of bug because they use different signing.
- Since PROJECT.md confirms the key is already Android-restricted, explicitly verify (early, not late) that the restriction's registered SHA-1 list is correct for every build variant this project will produce.

**Warning signs:**
- Map works in the dev client but the team hasn't yet run a single EAS production/preview build with the map screen.
- `app.json`/`app.config.js` references the API key via a bare env var interpolation without a documented check that `expo prebuild` resolves it correctly.
- Only one SHA-1 fingerprint is registered against the restricted key in Google Cloud Console.

**Phase to address:**
Foundation/Auth (initial project setup, where the Expo config plugin and key configuration should be established and verified against a real production-signed build early) with a concrete verification checkpoint no later than Fare-Estimate-and-Book (the first phase that actually renders a map for pickup/dropoff selection).

---

### Pitfall 9: WS Auth Token Expiring Mid-Connection, Compounded by No Refresh-Token Endpoint

**What goes wrong:**
The rider WS connection authenticates via a token in the query string (`GET /api/v1/ws/rider?token=...&device_id=...`). If the JWT expires while a long-lived WS connection is still technically open (JWTs are typically validated at connection time, not continuously per-message, but reconnects will re-validate), a later reconnect attempt (from any of the earlier pitfalls — backgrounding, Doze, network blip) can fail auth with a 401. Because there's no refresh-token endpoint for riders (confirmed in PROJECT.md — "a 401 means full re-login"), this means a rider mid-trip can be silently kicked into a "reconnect failed, please log in again" dead end at the worst possible moment (actively tracking a driver en route or already in the car), unless the app has proactive session-expiry handling built ahead of time.

**Why it happens:**
Auth-token lifetime and WS-connection lifetime are two independent clocks that developers often don't reconcile — the token was valid when the connection was first opened, and unless something explicitly checks token expiry against wall-clock time and warns the user, the first sign of trouble is a failed reconnect with a 401 deep into an active trip.

**How to avoid:**
- Decode the JWT's expiry (`exp` claim) client-side and proactively warn the rider (e.g., "Your session will expire soon — please stay in the app" or, more usefully, prompt a lightweight re-auth) *before* it lapses, rather than reacting only after a 401 reconnect failure — this is explicitly called out as the intended UX in PROJECT.md ("UX should include a proactive session-expiry warning rather than expecting a backend fix").
- Choose a session length (or confirm the existing JWT TTL from `go-ride-backend`) long enough that this realistically won't fire mid-trip for the vast majority of rides — but still build the warning/re-login path, since a rider on an unusually long wait (Pitfall 1) or an unusually long trip is exactly the case where this becomes likely.
- On a 401 from any endpoint (WS reconnect or REST) during an active trip, preserve local trip context (trip ID, last known state) so that after forced re-login, the app can immediately resume showing the correct trip rather than dropping the rider back to a blank home screen.

**Warning signs:**
- No client-side check of JWT expiry anywhere in the session-management code — expiry is only discovered reactively via a failed request.
- Forced re-login flow does not preserve/restore the active trip context afterward.

**Phase to address:**
Foundation/Auth (session/token management, proactive expiry warning) with the trip-context-preservation half verified in Trip-Lifecycle.

---

### Pitfall 10: Polling/WebSocket Dual-Source State Divergence

**What goes wrong:**
This app has two sources of trip-state truth by design: the WS push stream (primary) and `/current-trip` polling (recovery path). If both are wired into the UI without a single reconciliation point, they can race — e.g., a poll response arrives and updates the UI to state A, then a slightly-stale-but-already-in-flight WS event overwrites it back to state B, causing visible flicker or, worse, the UI regressing to a state the trip has already moved past (e.g., briefly showing "finding driver" again after a poll fetched during the gap right as the WS `driver_assigned` event was also in flight).

**Why it happens:**
It's tempting to write WS event handlers and the polling fetch as two independent code paths that both directly call `setState`/update a store, without a single ordering/reconciliation rule (e.g., "whichever has the later trip-status timestamp wins" or "polling only updates gaps, WS is always authoritative when both are present").

**How to avoid:**
- Route both WS events and poll responses through one state-update function with clear precedence rules (e.g., compare a status-sequence number or timestamp from the payload, discard updates that are older than current state).
- Only poll `/current-trip` at specific, deliberate trigger points (app foreground, reconnect, explicit staleness timeout) rather than on a tight continuous interval that runs concurrently with an active WS connection — reduces the collision surface.
- Write an explicit test/scenario for "poll and WS event arrive within the same render cycle with different states" during Realtime-Tracking/Trip-Lifecycle development, not just individually.

**Warning signs:**
- Trip status UI flickers between two states during manual testing of a reconnect scenario.
- No ordering/timestamp comparison exists in the code path that merges WS and polling updates.

**Phase to address:**
Trip-Lifecycle (owns the full state machine across trip statuses) in coordination with Realtime-Tracking (owns both data sources).

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|-----------------|------------------|
| Single infinite "Finding driver..." spinner with no timeout ladder | Fast to ship, no state machine needed | Riders abandon or think the app is frozen (Pitfall 1); support burden | Never for MVP given the confirmed silent-retry backend behavior — this is a core UX requirement, not polish |
| Reconnect WS immediately on every `close` event, no backoff | Simple to write | Reconnect storms (Pitfall 2), server load spikes, out-of-order events | Never — backoff is cheap to add and the failure mode is expensive |
| Set marker coordinate directly from raw WS payload, no interpolation | Fastest to a working map demo | Visible jank on real devices/networks (Pitfall 5); looks unpolished in a domain (ride-hailing) where competitors set the smoothness bar high | Acceptable only for the very first internal prototype/demo, not for anything shown to real users |
| Hardcode Google Maps API key directly in `app.json` instead of via env var + secrets management | Unblocks development immediately, avoids config-plugin env-var resolution bugs (Pitfall 8) | Key committed to source control if `app.json` is tracked; harder to rotate | Acceptable short-term if the key is already restricted by SHA-1/package name (defense in depth) and the repo is private, but should migrate to EAS secrets/build-time injection before wider team access or public repo |
| Skip `/current-trip` polling on app-foreground, rely on WS only | Less code, "WS already handles it" | Stale trip state after any backgrounding/Doze gap (Pitfall 3) — this is not a rare edge case on Android | Never — this is an explicit named requirement in PROJECT.md, not optional |
| Generic catch-all error handling for the book-cab call | Faster to ship the happy path | Fare-expiry failures (Pitfall 7) look identical to network errors or server bugs to the rider | Acceptable only until the first pass at error-state design in Fare-Estimate-and-Book; must be fixed before that phase is considered done |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|-----------------|--------------------|
| `react-native-maps` (Android, Expo config plugin) | Assuming a dev-client-working map means the API key setup is correct; using unresolved env-var references in `app.json` | Verify against a real EAS production/preview build; confirm the generated `AndroidManifest.xml` has a literal, resolved key; register every signing SHA-1 (debug, EAS debug, EAS production) against the restricted key |
| `websocket-gateway` (`GET /api/v1/ws/rider?token=...&device_id=...`) | Treating "socket object reports open" as equivalent to "connection is healthy and delivering messages" | Track last-message-received timestamp; treat staleness beyond a threshold as effectively disconnected regardless of the socket's reported readyState |
| `cab-request-handler` (fare quote `expires_at`) | Only handling the happy-path book response, no distinct handling for expired-quote rejection | Explicit error branch for expired quotes with a one-tap re-quote action; visible countdown before expiry occurs |
| `go-ride-backend` (JWT auth, no refresh endpoint) | Reactive-only handling of 401s (discover expiry only when a request fails) | Proactive client-side expiry check against the JWT `exp` claim with an advance warning, per PROJECT.md's stated intended UX |
| `GET /current-trip?rider_id=...` (polling recovery) | Treating polling as a rare fallback invoked only "if something seems wrong" | Always poll on app-foreground and on every WS reconnect, unconditionally — this is the designed recovery path, not an emergency-only mechanism |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|-----------------|
| Re-rendering the full map/marker tree on every raw location tick | Frame drops, stutter, battery drain during active trips | Throttle/coalesce location-driven state updates; animate positions rather than re-rendering from scratch each tick | Noticeable on mid-range Android hardware even at moderate (1 update/2-5s) frequencies; severe if update frequency increases or custom marker icons are heavy |
| Custom marker images/components that re-layout on every position update | Extreme lag specifically on Android per known react-native-maps issues | Use lightweight/static marker assets; avoid re-mounting marker components on each update, only update position | Becomes visible quickly on Android even with only 1-2 animated markers on screen |
| Continuous/tight-interval polling of `/current-trip` running concurrently with an active WS connection | Redundant network/battery use; state-divergence flicker (Pitfall 10) | Poll only at deliberate trigger points (foreground, reconnect, staleness timeout), not on a fixed short interval throughout an active trip | Becomes a real cost at any meaningful user base — unnecessary backend load multiplied across concurrent riders |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| WS auth token passed as a query-string parameter (`?token=...`), as this backend requires | Tokens can be logged in server access logs, browser history equivalents, or intermediate proxy logs, since query strings are often logged even when headers aren't | This is a fixed backend contract the client can't change, but mitigate by keeping token TTL short-lived and avoiding any client-side logging of the full WS connection URL (redact the token in any client-side debug/analytics logging) |
| Storing the JWT in plain `AsyncStorage` rather than a secure, encrypted store | Token theft via device compromise or a malicious app with storage access is easier | Use Expo's SecureStore (or equivalent Android Keystore-backed storage) for the JWT rather than plain AsyncStorage |
| Leaving the Google Maps API key usable beyond its intended restriction scope during development (e.g., temporarily unrestricting it to debug a blank-map issue and forgetting to re-restrict) | Exposed, unrestricted key risk — billing abuse, quota exhaustion, or misuse by third parties if the key leaks (e.g., via a public repo or decompiled APK) | Debug restriction issues by registering the correct SHA-1 rather than removing restrictions; treat any temporary unrestriction as requiring an explicit follow-up ticket to re-restrict, not an assumed later step |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-------------------|
| Static "Finding driver..." spinner with no elapsed-time or retry signal | Riders can't tell working-as-intended from broken; abandon or repeatedly force-close/reopen the app | Timeout ladder with escalating messaging and a clear, reachable cancel action (Pitfall 1) |
| No countdown/freshness indicator on a fare quote before booking | Rider taps "Book" on a stale quote and hits a confusing generic error | Visible countdown; explicit expired-quote error state with one-tap re-quote |
| Driver marker snaps/teleports between raw location updates | Feels janky/cheap compared to competitor ride-hailing apps; harder to judge actual ETA/distance at a glance | Interpolated/animated marker movement between updates |
| No indication when the driver's location feed has gone stale (marker just stops moving) | Rider can't tell if the driver is stuck in traffic or the app/data pipe is broken | "Last updated Xs ago" or dimmed-marker signal past a staleness threshold |
| Silent reconnect with no "reconnecting.../back online" feedback | Rider has no idea the app noticed and recovered from a connectivity gap; erodes trust in the shown trip state | Brief, non-intrusive connectivity-state indicator tied to actual reconnect events |
| Forced full re-login (no refresh token) with no preserved trip context afterward | Rider mid-trip gets logged out and lands on a blank home screen, unsure if their trip still exists | Preserve trip ID/context through forced re-login and immediately resume the correct trip screen afterward |

## "Looks Done But Isn't" Checklist

- [ ] **"Finding driver" screen:** Often only tested against the happy path (driver found quickly) — verify behavior when no driver is available for an extended period (simulate an empty driver pool), including the cancel action being reachable throughout.
- [ ] **WebSocket reconnect logic:** Often only tested by toggling airplane mode briefly — verify against a real Android device backgrounded with screen off for 10+ minutes (Doze) during an active trip, and verify no duplicate/concurrent connections form.
- [ ] **Map screen on a production build:** Often only verified in the Expo dev client — verify against an actual EAS production/preview build with the real release-signing SHA-1 registered against the restricted Google Maps API key.
- [ ] **Fare quote booking:** Often only tested with a freshly-fetched quote — verify the expired-quote rejection path produces a specific, actionable error, not a generic failure.
- [ ] **Trip state recovery on cold start:** Often only tested for a warm app resume — verify what happens if the app process is fully killed (not just backgrounded) mid-trip and relaunched; confirm `/current-trip` polling correctly restores the rider to the right screen.
- [ ] **`trip_cancelled` handling:** Often only wired into the active-trip/tracking screen — verify the rider correctly sees cancellation reflected even if they're on a different screen (e.g., profile, or mid-navigation) when the event arrives, since the backend sends this event unconditionally regardless of what triggered the cancellation.
- [ ] **Session-expiry warning:** Often deferred as "we'll add it later" — verify a proactive warning actually fires before a JWT expires, not only reactively after a 401.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|-----------------|--------------------|
| Silent dispatch retry mistaken for a frozen app (shipped without a timeout ladder) | LOW | Add client-side timeout-driven message escalation and a prominent cancel action; no backend change needed since this is purely a client-side state/timer fix |
| WebSocket reconnect storm discovered in production | MEDIUM | Introduce a singleton connection guard and exponential backoff; requires careful testing to confirm no regression in reconnect responsiveness, plus monitoring server-side connection counts to confirm the storm is resolved |
| Missed events during backgrounding causing stale trip state (found post-launch via user reports) | MEDIUM | Add always-on foreground-triggered polling reconciliation; retrofit is straightforward but requires auditing every screen that displays trip state to ensure it subscribes to the reconciled source of truth, not a stale local copy |
| Google Maps API key blank/crash discovered late (e.g., during store submission testing) | LOW-MEDIUM | Identify and register the missing production SHA-1 fingerprint in Google Cloud Console; low cost if caught before submission, higher cost (delayed launch) if caught only during store review |
| Fare-quote expiry silently failing bookings (found via support complaints) | LOW | Add a specific error branch and re-quote action; purely additive client-side change, no backend dependency |
| Polling/WS state divergence causing UI flicker (found via QA) | MEDIUM | Introduce single reconciliation point with ordering rules; requires auditing all existing call sites that directly mutate trip state to route through the new reconciliation function instead |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|-------------------|-----------------|
| Silent dispatch retry misread as frozen app | Fare-Estimate-and-Book (booking triggers search) / Realtime-Tracking (waiting-state UI) | Manually test against an empty/no-driver-available scenario; confirm timeout-ladder messaging and reachable cancel action at each stage |
| WS reconnect storm | Realtime-Tracking | Server-side log check for duplicate concurrent connections per token during rapid AppState churn testing |
| Missed WS events during backgrounding, no replay | Realtime-Tracking (WS design) + Trip-Lifecycle (polling recovery requirement) | Real-device test: background app with screen off for 10+ min during active trip, confirm state is correct on resume |
| Stale UI after silent reconnect | Realtime-Tracking | Test: disconnect, change trip state via a separate channel, reconnect — confirm UI resyncs without waiting for the next organic event |
| Raw lat/lng marker jank | Realtime-Tracking | Visual check on a real mid-range Android device; confirm animated/interpolated movement, not snapping |
| Stale "last known location" when driver feed stalls | Realtime-Tracking | Test: stop the driver-side location feed mid-trip, confirm a staleness indicator appears within the defined threshold |
| Fare quote expiry silent failure | Fare-Estimate-and-Book | Test: let a quote expire before tapping book, confirm a specific, actionable error and re-quote path (not a generic error) |
| Google Maps API key works in dev, fails in production | Foundation/Auth (setup) verified by Fare-Estimate-and-Book (first map render) | Confirm a real EAS production/preview build renders the map correctly, not just the dev client |
| WS token expiry mid-connection, no refresh endpoint | Foundation/Auth (session management) verified by Trip-Lifecycle (context preservation through forced re-login) | Confirm a proactive expiry warning fires before token lapse; confirm forced re-login preserves and restores active trip context |
| Polling/WS dual-source state divergence | Trip-Lifecycle (state machine) coordinated with Realtime-Tracking (data sources) | Test: trigger a poll and a WS event with conflicting states within the same window, confirm deterministic, correct resolution |

## Sources

- [react-native-maps Issue #5884 — app crashes with invalid Google API Key](https://github.com/react-native-maps/react-native-maps/issues/5884) — HIGH confidence (official repo issue tracker)
- [react-native-maps Issue #3591 — restricted API key shows blank map on Android only](https://github.com/react-native-maps/react-native-maps/issues/3591) — HIGH confidence (official repo issue tracker)
- [react-native-maps Issue #5611 — API key not found with Expo 53 / react-native-maps 1.24.2](https://github.com/react-native-maps/react-native-maps/issues/5611) — HIGH confidence (official repo issue tracker, current version)
- [react-native-maps official installation docs](https://github.com/react-native-maps/react-native-maps/blob/master/docs/installation.md) — HIGH confidence (official docs)
- [Expo app.json/app.config.js config reference](https://docs.expo.dev/versions/latest/config/app/) — HIGH confidence (official Expo docs)
- [Expo react-native-maps SDK docs](https://docs.expo.dev/versions/latest/sdk/map-view/) — HIGH confidence (official Expo docs)
- [expo/expo Issue #40513 — unclear instructions for adding Google Maps API key to app.json](https://github.com/expo/expo/issues/40513) — MEDIUM-HIGH confidence (official repo issue tracker)
- [Android Developers — Optimize for Doze and App Standby](https://developer.android.com/training/monitoring-device-state/doze-standby) — HIGH confidence (official Android documentation)
- [nv-websocket-client Issue #111 — Doze mode/app standby breaks background connectivity](https://github.com/TakahikoKawasaki/nv-websocket-client/issues/111) — MEDIUM confidence (community-reported, corroborates official Android docs)
- [Best Practices of using WebSockets in React Native Projects — Medium](https://medium.com/@tusharkumar27864/best-practices-of-using-websockets-real-time-communication-in-react-native-projects-89e749ba2e3f) — MEDIUM confidence (community best-practices writeup, not official)
- [react-native-maps Issue #2382 — Move Marker and MapView Smoothly](https://github.com/react-native-maps/react-native-maps/issues/2382) — HIGH confidence (official repo issue tracker)
- [react-native-maps Issue #2658 — Custom Markers cause extreme lag on Android](https://github.com/react-native-maps/react-native-maps/issues/2658) — HIGH confidence (official repo issue tracker)
- [react-native-maps Issue #2089 — Animation lag on iOS with Marker.Animated](https://github.com/react-native-maps/react-native-maps/issues/2089) — HIGH confidence (official repo issue tracker; cited for cross-platform animation caveat awareness even though this project is Android-first)
- Ride-hailing dispatch/matching and "no drivers available" UX patterns — MEDIUM confidence, synthesized from multiple system-design writeups (Hello Interview, System Design School, Medium system-design articles) on Uber-style dispatch retry queues; these describe common industry patterns, not an audited official source, and are used here only to corroborate the general shape of the problem, not as a spec for this project's actual backend behavior (which is independently confirmed via PROJECT.md)
- `.planning/PROJECT.md` (this project, 2026-08-11) — HIGH confidence, primary source for all project-specific backend constraints cited throughout (no refresh-token endpoint, push-only WS with no ack, silent dispatch retry with no fail-rider signal, Android-restricted Maps API key, `expires_at` fare quote)

---
*Pitfalls research for: Ride-hailing rider/passenger mobile app (go-ride-user-app)*
*Researched: 2026-08-11*
