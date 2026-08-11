# Feature Research

**Domain:** Ride-hailing rider (passenger) mobile app — cash-only, ratings-free, single-fare-tier, no surge, no promos
**Researched:** 2026-08-11
**Confidence:** MEDIUM-HIGH

> Scope note: This is not a blank-slate "what could a rider app have" survey. Feature scope is fixed by `.planning/PROJECT.md`'s Active requirements and backend-verified Out of Scope list. This document only researches *UX depth* for the features already in scope, plus flags true anti-features. Nothing here recommends a backend capability PROJECT.md confirms doesn't exist.

## Feature Landscape

### Table Stakes (Users Expect These)

These are the in-scope features from PROJECT.md's Active requirements, researched for what "done well" looks like. Missing the depth noted here (not the feature itself — the feature is already mandated) makes the app feel broken or untrustworthy, even though the backend contract is satisfied.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Fare estimate with itemized breakdown | Riders distrust a single opaque number; Uber/Lyft/Grab all show base + distance + time components before booking | LOW-MED | Render whatever breakdown fields the fare-estimate endpoint returns. If the API only returns a total, don't fabricate a fake breakdown — verify actual response shape before designing this screen. |
| Fare quote expiry countdown | Backend quote has `expires_at`; industry norm (per fare-calculator research) is quotes go stale within minutes due to traffic/route changes — silently booking against an expired quote is a trust-breaking failure mode | MEDIUM | Show a visible countdown or at minimum a "quote expiring" warning in the last ~30s; block the Book button and force re-fetch once expired rather than letting the request fail server-side with a confusing error. |
| Idempotent "Book Cab" button | Double-tap on a slow network is the single most common cause of duplicate-booking complaints in ride-hailing apps | LOW-MED | Disable button + show inline spinner on first tap; reuse the same idempotency key across retries of the same intent so a slow response doesn't create two trips. |
| "Finding driver" searching state | Users need to know the app is actively working, not frozen, during dispatch | MEDIUM | Animated/pulsing indicator (not just a static spinner) plus elapsed-time or subtle progress framing ("Looking for nearby drivers…"). Must NOT flash an error or reset the UI on each silent dispatch retry — PROJECT.md explicitly calls out retry-tolerance as a requirement, so the loading state must be built as a state machine that absorbs retries silently. |
| Explicit no-match / long-wait messaging | Leaving a spinner running indefinitely with no feedback reads as broken; competitors surface "still looking" or a graceful cancel-and-retry prompt after a threshold | MEDIUM | Since there's no push notification channel and WS is the only push mechanism, this needs a client-side timeout (e.g., after N seconds show "This is taking longer than usual" + keep the cancel affordance prominent). |
| Cancel affordance during search | Users must feel in control while waiting; every competitor keeps cancel visible and one-tap during matching | LOW-MED | Must be reachable at all times during "finding driver," not buried in a menu. Ties directly to the "cancel a pending or ongoing trip" requirement. |
| Assigned-driver reveal (name, vehicle, plate) | Baseline trust/safety expectation once a match happens — riders want to identify the correct car | LOW | Complexity depends entirely on what fields the driver-assignment payload actually contains — verify field availability (photo, plate, vehicle model) before designing this screen; don't assume fields that haven't been confirmed against the backend DTOs. |
| Live map with driver marker | This is the core value prop of the requirement list ("rider sees the driver's live location on the map") — competitors treat this as non-negotiable | MEDIUM-HIGH | Naive re-render of a marker on every WS location push looks janky (teleporting pin). Table-stakes bar is smooth interpolation between pings, not raw jump-cuts — see Differentiators for how far to take this. |
| Trip status label mapped to lifecycle | Riders expect a plain-language status ("Driver on the way," "Trip in progress," "Trip completed") not raw backend state enums | LOW-MED | Pure presentation mapping from the trip status the backend/WS already sends; no new backend capability needed. |
| Cancellation reflected immediately, any trigger | PROJECT.md flags `trip_cancelled` is pushed unconditionally regardless of who/what triggered it (rider, driver, or system) — a rider who cancels but still sees "finding driver" for 10 more seconds will assume the cancel failed and re-tap | MEDIUM | Must handle the WS `trip_cancelled` event and the polling-recovery path converging on the same UI state without flicker or duplicate "trip cancelled" toasts. |
| WS-drop recovery via polling | PROJECT's stated Core Value is literally "without losing track of trip state even through a dropped WebSocket connection" | MEDIUM-HIGH | `GET /current-trip?rider_id=...` is the documented recovery path. Table stakes: detect a stale/dead WS session (missed heartbeat or app-foreground-after-background) and reconcile via poll before the user notices anything is wrong. This is the single most safety-critical piece of UX in the app per the project's own Core Value statement. |
| Session-expiry warning | No refresh-token endpoint exists for riders — a 401 mid-trip means forced re-login, which is catastrophic if it happens while tracking an active ride | MEDIUM | Proactively warn before JWT expiry (e.g., "Your session will expire soon, please stay active") rather than silently failing a poll/WS reconnect attempt and dropping the user off their own active trip screen. This is a UX mitigation for a confirmed backend gap, not a request to add a backend capability. |
| Trip completion screen: final fare + cash status | Riders need unambiguous confirmation of (a) what they owe and (b) whether the driver has confirmed collecting it | LOW-MED | Rider only *observes* cash-collection status (driver confirms via their own endpoint per PROJECT.md) — this screen must clearly separate "amount due" from "payment confirmed" states rather than implying the rider can submit payment in-app. |
| Profile view/edit + change password | Baseline account-management expectation in any authenticated app | LOW | Standard CRUD forms against `GET /api/v1/me` and `PATCH /api/v1/profile` — note both are verified to wrap responses as `{"user": {...}}`, not bare objects, per PROJECT.md's verified correction. |
| Location-permission handling | Android runtime permissions are mandatory for any map/GPS feature; a rider who denies permission needs a clear recovery path, not a silently broken map | LOW-MED | Standard Android pattern: explain-then-request, and a fallback empty state if denied (can't book without pickup location — make that consequence explicit rather than letting the fare-estimate call silently fail). |
| Network/error empty states per step | Every network call (fare estimate, book, cancel, poll) can fail independently; ride-hailing users are mid-motion and on flaky mobile data constantly | LOW-MED | Each screen needs its own retry-affordance error state, not a generic app-wide error boundary — a failed poll during an active trip is a different severity than a failed fare estimate on the home screen. |

### Differentiators (Competitive Advantage)

These go beyond minimum viable and are optional polish — worth doing because they reinforce this app's stated Core Value (reliability through connection loss) but not required to satisfy PROJECT.md's Active requirements.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Smooth marker interpolation/animation | Turns "live tracking" from a checkbox feature into something that visibly feels real-time and premium, the way Uber/Grab/Bolt all do it | MEDIUM | Animate marker position between successive WS pings (e.g., tween over the inter-ping interval) rather than snapping; requires tracking last-known heading too for marker rotation, which is a nice-to-have on top. |
| Client-side ETA estimation | Backend does not compute an ETA (not in scope/not confirmed to exist) — deriving one client-side from consecutive driver lat/lng pings turns a data gap into a feature | MEDIUM-HIGH | Verified pattern (WebSocket.org / general GPS-ETA research): compute straight-line (haversine) distance to pickup/destination, derive current speed from delta-distance/delta-time between recent pings, smooth with a moving average to avoid GPS-noise spikes, degrade gracefully (hide or show "calculating…" with <2 samples). **Caveat, flag for requirements phase:** this yields a straight-line/speed estimate, not a road-routing ETA — verify whether the app has any maps SDK with a Directions/routing API available before promising road-aware ETAs; if not, label the ETA as approximate rather than implying precision it can't deliver. |
| "Quote expiring soon" active nudge | Reduces the failure case of a rider losing their place in the booking flow because a quote silently expired | LOW-MED | Visual state change (color/pulse) in the last ~30s of the countdown, prompting immediate action rather than a hard failure after expiry. |
| Trip lifecycle stepper/timeline visual | Makes the trip feel structured and predictable (Requested → Driver Assigned → Arrived → In Progress → Completed) using states the backend already sends | LOW-MED | Pure client-side rendering of already-available state; no new backend dependency, low cost for meaningfully higher perceived polish. |
| Large, unmissable "amount to pay" display at trip end | Reduces real-world friction of handing exact cash to a driver — this is the single moment cash-only apps most need to nail since there's no in-app settlement to fall back on | LOW | Typography/contrast treatment on the final fare number; genuinely differentiating because most competitors' primary flow is card-first and treat the cash screen as an afterthought. |
| Connection-health indicator (subtle, not alarming) | Reinforces the app's own stated reliability promise — showing a small "reconnecting…" state instead of hiding the WS drop builds trust that the app itself knows it lost data and is recovering | MEDIUM | Verified pattern (WebSocket.org reconnection guidance): distinguish "you're offline" vs "we're reconnecting" messaging; must not create alarm-fatigue by firing on every brief background reconnect. |

### Anti-Features (Commonly Requested, Often Problematic)

Everything below either requires a backend capability PROJECT.md explicitly confirms doesn't exist, or adds scope that contradicts the "single-fare-tier, cash-only" constraint. Building any of these is out of scope for this milestone.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|------------------|-------------|
| Post-trip rating/review prompt | Standard in every mainstream ride-hailing app; users may expect it | No ratings model or endpoint exists anywhere in the platform (PROJECT.md, backend-verified) — building the UI would have nothing to submit to | Skip entirely for v1; if the platform later adds a ratings backend, revisit as a new milestone, not a client-side stub. |
| Ride-history list screen | Every competitor has "your trips" | No GET endpoint exposes ride history, even though a `trip_history` table exists in the DB — client has no data source | Skip. Do not build against the DB table directly (this app doesn't own persistence); flag as a backend follow-up outside this repo. |
| In-app payment / card entry / wallet | Feels incomplete without it compared to Uber/Lyft | No payment gateway integration exists; MVP is explicitly cash, driver-confirmed | Trip-end screen shows amount due + driver-confirmed cash status only — no payment method UI at all. |
| Tip screen | Common in card-based competitors post-trip | Tipping in these apps is normally routed through the in-app payment gateway, which doesn't exist here; cash tipping (if any) happens outside the app entirely | Don't build; it's not a data point the backend tracks. |
| Promo/coupon code entry field | Users expect discount codes in most consumer apps | `discount_total` column exists on trip fares but nothing populates it — the field would always show $0 | Skip entirely; don't surface a field that can never have a nonzero value, it reads as a broken feature. |
| Push notification permission prompt / rich notifications | Standard mobile UX pattern, users expect background alerts | Explicitly out of scope — WebSocket-only for riders in this milestone | In-app banners/toasts driven by the open WS connection or the polling-recovery path; no OS-level notification permission request at all. |
| Surge/dynamic pricing indicator (multiplier badge, "prices are high" banner) | Common Uber/Lyft/Grab pattern users may expect | Pricing is hardcoded to 1.0 server-side with no UI for it — showing a surge indicator would be fabricating a signal the backend never sends | Don't build any surge-related UI; the fare estimate is simply the fare estimate. |
| Account deactivation flow (self-service) | Standard account-settings expectation | Endpoint exists but is destructive/low-frequency and PROJECT.md explicitly defers this pending its own confirm-UX pass, not a rushed v1 add | Exclude from this milestone's profile/settings screens entirely; don't even add a stub menu item that isn't wired up. |
| Phone number + OTP login/signup | Common in ride-hailing apps regionally (esp. outside North America) | Backend is email+password only; building OTP UI has no server-side auth flow to call | Email+password only, matching the existing backend exactly. |
| Vehicle-class picker (economy/premium/XL) | Common in multi-tier competitors | PROJECT.md constrains this to a single fare tier — a class picker implies choices the backend/pricing model doesn't support | One fare estimate, one booking flow, no tier selection UI. |
| Scheduled ("book for later") rides | Common secondary feature in mature ride-hailing apps | Not in the Active requirements list; adds meaningful state-machine complexity (future dispatch, reminder handling) with no confirmed backend support | Defer to a future milestone if/when backend adds scheduled-dispatch support. |
| Multi-stop trips / waypoints | Common power-user feature | Not in scope; requirements describe a single origin→destination trip, and multi-stop would change the fare-estimate contract shape | Single pickup + single destination only for this milestone. |
| In-app chat / messaging with driver | Feels like a safety/convenience feature riders expect | PROJECT.md notes the rider WS connection is push-only with no ack protocol from the rider — there is no confirmed bidirectional channel to build a chat feature on | Don't build; if contact is needed, that's a phone-call affordance at most, and only if a driver phone number is confirmed to exist in the assignment payload (unverified — check before building even that). |
| Silent auto-refresh of auth tokens | Users expect to never be logged out unexpectedly | No refresh-token endpoint exists for riders — attempting to build "seamless" silent refresh against a nonexistent endpoint will just fail intermittently and confuse the failure mode | Proactive session-expiry warning (see Table Stakes) + clean, fast re-login flow instead of pretending refresh is possible. |

## Feature Dependencies

```
Fare Estimate
    └──requires──> (none — entry point)

Book Cab (idempotent)
    └──requires──> Fare Estimate (needs quote reference + must be pre-expiry)

Finding Driver state
    └──requires──> Book Cab (trip must exist server-side)

Live Map Tracking (driver location)
    └──requires──> Finding Driver → Driver Assigned transition

Trip State Recovery (polling fallback)
    └──enhances──> Finding Driver state
    └──enhances──> Live Map Tracking
    (protects both against WS drops — this is the Core Value dependency)

Cancel Trip
    └──requires──> Finding Driver state OR Live Map Tracking (must be pending or ongoing)

Immediate Cancellation Reflection
    └──requires──> Trip State Recovery (must converge WS push + poll on same cancelled state without flicker)

Trip Completion (final fare + cash status)
    └──requires──> Live Map Tracking (trip must have been active)

Client-side ETA Estimation (differentiator)
    └──requires──> Live Map Tracking (needs consecutive location pings to derive speed)

Session-Expiry Warning
    └──enhances──> all authenticated flows, most critically Finding Driver + Live Map Tracking
    (a 401 mid-trip is the worst-case failure this app can have, per Core Value)

Surge Pricing UI ──conflicts──> Fare Estimate (hardcoded 1.0 server-side; do not build)
Promo Code UI ──conflicts──> Book Cab (discount_total unpopulated; do not build)
Ratings/Reviews ──conflicts──> Trip Completion (no backend model; do not build)
```

### Dependency Notes

- **Book Cab requires Fare Estimate:** the booking call is against a quote, and that quote has an `expires_at` — the UI must carry the quote reference and enforce freshness client-side before submitting.
- **Trip State Recovery enhances both Finding Driver and Live Map Tracking:** this isn't a separate screen, it's a resilience layer that must be wired into both states from day one — retrofitting it later means redesigning both state machines. This is the highest-priority piece of architecture given PROJECT.md's Core Value statement.
- **Immediate Cancellation Reflection requires Trip State Recovery:** because `trip_cancelled` can arrive via WS push *or* be discovered via poll, the UI needs a single source of truth that both paths feed into, or the rider risks seeing contradictory states (e.g., cancelled banner then reverting to "finding driver").
- **Client-side ETA requires Live Map Tracking:** you cannot estimate speed/ETA without at least two location samples over time — this differentiator cannot be built before the base tracking feature, and should not block v1 launch.
- **Session-Expiry Warning enhances long-running states specifically:** a rider mid-fare-estimate can just retry after re-login with no real loss; a rider mid-active-trip who gets logged out loses visibility into a ride already in progress, which is a much worse failure. Prioritize this warning for the trip-tracking screens first if time-constrained.
- **Surge / Promo / Ratings all conflict with their nearest table-stakes feature:** each corresponds to a UI surface that would either always show a null/zero value or have nothing to submit to. Building any of these is worse than not building them — a visibly broken/always-empty feature erodes trust more than its absence.

## MVP Definition

### Launch With (v1)

This is effectively PROJECT.md's Active requirements list, restated with the UX depth researched above — nothing here should be trimmed further, since it's already the constrained MVP, not an aspirational list.

- [ ] Sign up / log in (email + password) — entry point, everything requires auth
- [ ] Profile view/edit + change password — baseline account management
- [ ] Fare estimate with breakdown + visible expiry handling — first real interaction, sets trust
- [ ] Idempotent Book Cab — prevents the most common real-world booking bug (double trip)
- [ ] "Finding driver" state, retry-tolerant, with cancel affordance and long-wait messaging — the riskiest UX state in the app if built naively
- [ ] Live map with driver location once assigned — the requirement list's core "watch it get assigned and tracked" promise
- [ ] WS-drop recovery via polling — this is the app's literal stated Core Value; must ship in v1, not deferred
- [ ] Cancel pending/ongoing trip, reflected immediately regardless of trigger — directly required, and safety-critical (rider must trust cancel actually happened)
- [ ] Trip lifecycle to completion: start, final fare, cash-collection status (observe-only) — closes the loop end-to-end

### Add After Validation (v1.x)

- [ ] Smooth marker interpolation/animation — trigger: base tracking works reliably first; polish the *feel* once the *correctness* is proven
- [ ] Client-side ETA estimation — trigger: once enough real location-ping data exists to validate the smoothing/degradation logic against actual driver GPS noise
- [ ] Trip lifecycle stepper/timeline visual — trigger: once the underlying state machine (the hard part) is stable, this is a cheap visual layer on top
- [ ] Connection-health indicator — trigger: once real-world WS drop frequency is observed post-launch, to calibrate how prominent this should be without causing alarm-fatigue

### Future Consideration (v2+)

All blocked on backend capabilities PROJECT.md confirms don't currently exist — do not schedule these as this repo's work until the backend gap is closed:

- [ ] Ratings/reviews — needs a backend ratings model + endpoint that doesn't exist
- [ ] Ride history — needs a GET endpoint exposing the existing `trip_history` table
- [ ] In-app payment gateway + tipping — needs actual payment integration on the backend
- [ ] Promo/coupon codes — needs something to populate `discount_total`
- [ ] Push notifications — needs a push infrastructure decision beyond WS
- [ ] Surge pricing display — needs the backend to stop hardcoding 1.0
- [ ] Account deactivation self-service — deliberately deferred pending its own confirm-UX design pass
- [ ] Scheduled rides / multi-stop trips — not in scope, no confirmed backend support, meaningful new complexity

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|----------------------|----------|
| Fare estimate + expiry handling | HIGH | MEDIUM | P1 |
| Idempotent booking | HIGH | LOW-MED | P1 |
| Finding-driver retry-tolerant state | HIGH | MEDIUM | P1 |
| Live map tracking | HIGH | MEDIUM-HIGH | P1 |
| WS-drop polling recovery | HIGH | MEDIUM-HIGH | P1 |
| Cancel + immediate reflection | HIGH | MEDIUM | P1 |
| Trip completion + cash status | HIGH | LOW-MED | P1 |
| Session-expiry warning | MEDIUM-HIGH | MEDIUM | P1 |
| Auth + profile management | MEDIUM | LOW | P1 |
| Marker interpolation/animation | MEDIUM | MEDIUM | P2 |
| Client-side ETA estimation | MEDIUM | MEDIUM-HIGH | P2 |
| Trip lifecycle stepper visual | LOW-MEDIUM | LOW-MED | P2 |
| Connection-health indicator | LOW-MEDIUM | MEDIUM | P2 |
| Ratings/reviews | N/A (blocked) | N/A | P3 (blocked on backend) |
| Ride history | N/A (blocked) | N/A | P3 (blocked on backend) |

**Priority key:**
- P1: Must have for launch (matches PROJECT.md's Active requirements)
- P2: Should have, add when possible (post-v1 polish, no backend blockers)
- P3: Nice to have, future consideration — currently blocked on confirmed backend gaps, not schedulable in this repo

## Competitor Feature Analysis

Comparison focused specifically on the cash-payment flow and matching/tracking states, since those are the closest real-world analogues to this app's constrained scope (full competitor feature parity — ratings, in-app payment, promos — is explicitly not the goal here).

| Feature | Grab (cash trips) | Bolt (cash trips) | Our Approach |
|---------|--------------------|--------------------|--------------|
| Cash confirmation flow | Driver confirms the transaction in-app; rider hands over cash when prompted, then waits for confirmation | Payment method is fixed at trip acceptance and visible throughout the active order; driver is responsible for collecting cash | Matches this pattern closely: rider observes an "amount due" state, driver confirms collection via their own endpoint, rider's screen updates to "payment confirmed" — no rider-side confirm action, matching PROJECT.md's explicit constraint |
| Fare tier selection | Multiple vehicle classes/tiers with a picker before booking | Multiple tiers | Explicitly not replicated — single fare tier only, no picker, per PROJECT.md constraint |
| Surge/dynamic pricing display | Prominent surge multiplier/banner shown pre-booking | Similar dynamic pricing indicators | Explicitly not replicated — hardcoded 1.0 server-side, no UI |
| Driver matching/searching state | Animated searching UI with cancel always available | Similar pattern, matching-timeout messaging | Directly comparable — same UX bar (animated state, cancel affordance, timeout messaging), the differentiator here is retry-tolerance specific to this app's dispatch-retry backend behavior |

## Sources

- [Bolt Support — Driver asked cash for in-app payment trip](https://bolt.eu/en/support/articles/6084040505618/) — cash payment flow confirms method is fixed at acceptance and visible throughout the trip (MEDIUM confidence, official support doc)
- [Alphr — How to Pay Cash With Grab](https://www.alphr.com/how-to-pay-cash-with-grab/) — describes driver-confirms/rider-observes cash flow pattern (MEDIUM confidence, third-party but consistent with Bolt's official docs)
- [Uber Newsroom — Cash payment launch](https://www.uber.com/en-HK/newsroom/cash-payment-launch) and [Uber taxi cash](https://www.uber.com/en-HK/blog/uber-taxi-cash) — reference pattern for "amount displayed at trip end, paid directly to driver" (MEDIUM confidence, official Uber source)
- [WebSocket.org — WebSocket Reconnection: State Sync and Recovery Guide](https://websocket.org/guides/reconnection/) — reconnection/backoff and "reconnecting…" UX guidance (MEDIUM-HIGH confidence, dedicated technical resource)
- [web.dev — Offline UX design guidelines](https://web.dev/articles/offline-ux-design-guidelines) — general offline/connectivity-state messaging patterns (HIGH confidence, official Google web.dev guidance)
- General GPS-ETA derivation pattern (haversine distance + delta-time speed + smoothing, graceful degradation with sparse samples) — synthesized from multiple GPS/ETA calculation sources (LOW-MEDIUM confidence — no single authoritative source for mobile client-side ETA estimation found; this is a common but not standardized pattern, flagged for validation during implementation)
- Well-established ride-hailing UX conventions (fare breakdown, finding-driver states, live tracking, trip-status labeling) — based on broad familiarity with Uber/Lyft/Grab/Bolt product patterns; treated as HIGH confidence for the *existence* of these patterns industry-wide, but specific field/payload availability in this project's backend was NOT independently re-verified in this research pass (that verification already happened during PROJECT.md's initialization per its "Context" section) — always check the actual DTOs before designing a screen around an assumed field (e.g., driver photo, driver phone, itemized fare breakdown fields)

---
*Feature research for: ride-hailing rider app (cash-only, ratings-free, single-tier)*
*Researched: 2026-08-11*
