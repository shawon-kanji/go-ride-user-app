# Phase 2: Fare Estimate & Booking - Research

**Researched:** 2026-08-12
**Domain:** `react-native-maps` tap-to-pin location selection, `expo-location` GPS defaulting, client-generated idempotency keys, TanStack Query v5 mutation patterns for exactly-once booking, and testing native-module-backed screens under Jest/RNTL — layered on Phase 1's already-established session/http-client/theme foundation.
**Confidence:** HIGH for backend contract and Phase-1-pattern reuse (read directly from source in both repos); MEDIUM-HIGH for `react-native-maps`/`expo-location` API surface and New Architecture compatibility (official docs + installed package inspection, cross-verified); MEDIUM for the exact test-mocking mechanics of `expo-location`/`expo-crypto` (verified against `jest-expo`'s actual bundled mock list, but not yet exercised as a passing test in this repo).

## Summary

This phase's product decisions are already fully locked in `02-CONTEXT.md` — the researcher's job was to close the six specifically-flagged technical gaps, not to re-litigate UX. All six came back with clear, actionable answers, but two are worth calling out up front because they carry real execution risk that the CONTEXT.md decisions didn't anticipate:

First, **`react-native-maps@1.27.2` (already installed since Phase 1, never actually rendered) needs a real New-Architecture compatibility check as a Wave 0 smoke test, not an assumption.** RN 0.86.2 is bridgeless/New-Architecture-only, and `react-native-maps` only gained Fabric support in `v1.26.1+` (requires RN >= 0.81.1, per the library's own compatibility table). The installed `1.27.2` clears that bar on paper, and its `package.json` already carries a populated `codegenConfig` (Fabric specs, `android.javaPackageName: com.rnmaps.fabric`), which is strong corroborating evidence it should render correctly under this stack — but a 2022-era GitHub issue claiming "New Architecture not supported, closed as not planned" is still the top search result for this topic and is now stale/superseded. Because this is genuinely the *first* real `<MapView>` usage anywhere in either the codebase or this research session (nothing was ever visually confirmed, even in Phase 1), the plan should not build five screens' worth of UI before rendering one bare `MapView` on the real device and confirming it isn't a pink "Unimplemented component" screen.

Second, **two new native dependencies (`expo-location`, and `expo-crypto` for idempotency-key generation) are being added to a project whose native Android project (`android/`) already exists from Phase 1's `expo run:android` build.** Installing them via npm/`npx expo install` is necessary but not sufficient — the existing `android/` directory needs to be regenerated (`npx expo prebuild` or another `npx expo run:android`) before either module's native code is linked, exactly the same class of "don't assume JS install is enough" pitfall Phase 1 hit with the Maps config plugin. Budget a real native rebuild into Wave 0, not just an `npm install`.

Beyond those two risks, the rest of the research is straightforward and mostly confirms CONTEXT.md's plan is sound: `MapView`'s `onPress`/`onLongPress` give `{coordinate: {latitude, longitude}}` directly, which is exactly what a tap-to-pin screen needs; `expo-location`'s permission flow is a simple two-call sequence (`requestForegroundPermissionsAsync` → `getCurrentPositionAsync`) that degrades gracefully (resolves a status, never throws on denial) and is trivially made non-blocking for the "let the rider place the pin manually" fallback; `SessionExpiryBanner`'s absolute-timestamp-anchored countdown pattern is directly reusable in spirit (not verbatim — a primary-focus 15-minute countdown wants a 1-second tick, not the banner's background 30-second tick) for the fare-quote countdown; and `expo-crypto`'s `Crypto.randomUUID()` is the lowest-footprint idempotency-key generator available (zero new transitive deps, already on the SDK-57 line, no polyfill-ordering concerns unlike `uuid` + `react-native-get-random-values`). The one piece of testing infrastructure that genuinely doesn't exist yet anywhere in this codebase or its sibling is a `react-native-maps` Jest mock — `jest-expo` mocks first-party Expo SDK native modules (including `expo-location`) but has no knowledge of this third-party library, so a hand-written `__mocks__/react-native-maps.js` is a real Wave 0 deliverable, not an assumption.

**Primary recommendation:** Before building any pickup/dropoff screen, add a Wave 0 task that (1) installs `expo-location` and `expo-crypto`, (2) adds both to `app.config.js`'s `plugins` array, (3) runs a fresh `npx expo run:android` to relink native modules, and (4) renders one bare `<MapView>` with a single hardcoded `<Marker>` on the real device to prove Fabric compatibility — only then proceed to the tap-to-pin, GPS-default, countdown, and idempotent-booking work, all of which are comfortably de-risked by the findings below.

## User Constraints

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Location input method (pickup/dropoff selection)**
- Sequential map-tap-to-pin, current-location default for pickup. Two steps: "Set pickup" (map screen, defaults to device GPS via a new `expo-location` dependency — not yet installed — centered marker, tap-to-reposition) → "Set dropoff" (same pattern, no default position). Selected over simultaneous dual-draggable-pin (more complex gesture UX, no v1 advantage) and search-box/Places-Autocomplete-first entry (REJECTED for v1 — requires unresearched Google Places API (New) shapes; the backend only ever accepts raw lat/lng, so a map-tap picker needs zero additional API surface).
- No address reverse-geocoding required for v1 — pinned coordinates sent as-is; a rounded-lat/lng placeholder label is acceptable confirmation-screen content (Claude's discretion on exact display).

**Fare quote screen**
- Itemized breakdown shown: `base_fare`, `distance_fare`, `time_fare`, `total_fare` (prominent). `surcharge_total`/`discount_total` rendered ONLY if nonzero (both always `0` today). `surge_multiplier` NEVER rendered (hardcoded `1.0` server-side, PROJECT.md Out of Scope).
- Visible countdown timer against `expires_at` (backend default: 15 minutes from `locked_at`, `FARE_LOCK_TTL_MINUTES` default `15`). At zero: quote enters an explicit "Quote expired" state with a single "Get new estimate" button that re-calls `POST /fare-estimate` with the same pickup/dropoff pins — NOT a silent auto-refetch. Matches RIDE-01 and the backend's hard `409` refusal to silently reprice.

**Booking confirmation & idempotency**
- Tapping "Book this ride" on the quote screen calls `POST /request-cab` directly — no separate `ConfirmDialog` interstitial (booking is the primary expected action, not destructive).
- Idempotency key: a client-generated UUID minted once when the rider first taps "Book this ride" for a given fare quote, held in local component/hook state and reused for every retry of that same tap. Sent via the `Idempotency-Key` header (matches `httpheaders.Idempotency` constant, which the backend prefers over the body field). A NEW key is minted only when the rider re-estimates after expiry (a genuinely new booking intent) — matches RIDE-02.
- `rider_id` for both `/fare-estimate` and `/request-cab` calls comes from the already-authenticated session's `User.id` (Zustand `session-store`) — NOT from decoding the JWT client-side. `cab-request-handler` has NO JWT/auth middleware at all — `rider_id` is fully client-trusted at this endpoint (backend characteristic, not something this app fixes).
- Post-booking confirmation is intentionally minimal: on `202 Accepted`, show a simple "Ride requested!" confirmation (toast or lightweight screen) and return to Home — this phase does NOT build a live/polling "finding driver" status screen.

**Booking error handling**
- `fare_expired` (409): inline message on the quote screen + the same "Get new estimate" action as the countdown-zero state — same code path.
- `fare_already_used` (409): treated as idempotent success, not an error — routes to the same "Ride requested!" confirmation as a normal `202`.
- `fare_not_found` (404) and network/5xx failures: generic single-banner error message, matching Phase 1's "single banner on submit" convention.

### Claude's Discretion
- Exact map screen layout/chrome (search bar presence, marker icon styling, confirm-location button placement) — use `react-native-maps` and existing theme tokens/components as-is.
- Whether pickup/dropoff selection is two full-screen steps or one screen with a mode toggle — functionally equivalent, implement whichever is simpler given `react-native-maps`' actual API surface.
- Rounded-coordinate placeholder label vs. no label at all on the confirmation screen for chosen locations.
- Exact fare-breakdown row order/typography/spacing.
- Toast vs. lightweight screen for the post-booking "Ride requested!" confirmation.

### Deferred Ideas (OUT OF SCOPE)
- Google Places Autocomplete/search-box location entry — deferred to v2 (POLISH), once Places API (New) request/response shapes are actually researched.
- Reverse-geocoded human-readable address labels for chosen pickup/dropoff points — deferred; raw coordinates are sufficient for v1.
- Any live/polling "finding driver" status UI — explicitly Phase 3 (TRACK-02), not built here even minimally.

</user_constraints>

## Phase Requirements

<phase_requirements>

| ID | Description | Research Support |
|----|-------------|-------------------|
| RIDE-01 | Rider can get a fare estimate with an itemized breakdown and a visible expiry countdown against `expires_at` | `fareEstimateResponse` fields confirmed directly against `cab-request-handler/internal/api/server.go` (Code Examples); countdown pattern adapted from `SessionExpiryBanner.tsx`'s absolute-timestamp-anchored `setInterval` (Architecture Patterns, Pattern 3) |
| RIDE-02 | Rider can book a cab against a fare quote idempotently (`Idempotency-Key` header, reused across retries so a slow response never creates a duplicate trip) | `createOrLoadCabRequest`'s `(rider_id, idempotency_key)` replay-returns-existing-request logic confirmed directly against source (Code Examples); client-side stable-key-across-retries mechanics via `useRef`/lazy-minted state, since TanStack Query v5 mutations have no built-in key-based deduplication (Architecture Patterns, Pattern 4; Don't Hand-Roll) |

</phase_requirements>

## Standard Stack

### Core (new for this phase)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `expo-location` | `~57.0.9` | Foreground permission request + one-shot GPS read for pickup default | Confirmed via `node_modules/expo/bundledNativeModules.json`: SDK 57 pins `expo-location` to `~57.0.9`. `npx expo install expo-location` will resolve this exact range. |
| `expo-crypto` | `57.0.1` | `Crypto.randomUUID()` for the client-generated idempotency key | Confirmed current on npm today (`npm view expo-crypto versions`): `57.0.1` is the latest SDK-57-line release, zero runtime dependencies. Chosen over `uuid` + `react-native-get-random-values` (two packages, requires a polyfill import as the literal first line of the app entrypoint before any other import touches `crypto`) — Hermes has **no built-in `crypto.randomUUID()`** (confirmed via WebSearch: "React Native has no native crypto.randomUUID() — you need a polyfill... Hermes does not natively implement the crypto Web API"), so a real dependency is unavoidable either way; `expo-crypto` is the lower-footprint one and matches this project's already-Expo-first dependency posture. |
| `react-native-maps` | `1.27.2` (already installed, unused) | Tap-to-pin `MapView`/`Marker` for pickup/dropoff selection | Already locked from Phase 1; this phase is its first real usage. **New Architecture note:** the library's own compatibility table states Fabric support starts at `1.26.1+` requiring RN `>= 0.81.1` — the installed `1.27.2` clears both bars against this project's RN `0.86.2`, and the installed package's `package.json` already contains a populated Fabric `codegenConfig` (`android.javaPackageName: com.rnmaps.fabric`). Still recommend a Wave 0 smoke-test render (see Common Pitfalls) before building screens on top of it, since this is unverified in this exact codebase/build. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none new) | — | — | Idempotency-key state (`useRef`), countdown state (`useState`+`useEffect`+`setInterval`), and the itemized-fare display all use only React/RN primitives + libraries already in the Phase 1 stack (`@tanstack/react-query`, `zustand`, `react-hook-form`+`zod` for the confirm-screen inputs if any, `nativewind` for styling). No new supporting libraries are needed for this phase's requirements. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `expo-crypto`'s `Crypto.randomUUID()` | `uuid` package + `react-native-get-random-values` polyfill | More total dependencies (2 packages vs. 1), requires the polyfill to be the literal first import in the app's entrypoint before any code (including third-party libs) touches `crypto` — an easy-to-violate ordering constraint. `expo-crypto`'s native binding has no such ordering requirement. Only reason to prefer `uuid` would be needing UUID v1/v5 or non-Expo-managed workflows, neither of which applies here. |
| A hand-rolled UUID-ish string (`Date.now() + Math.random()`) | `expo-crypto`'s `randomUUID()` | Rejected outright — the backend's `idempotency_key` column has a `128`-char max (confirmed in `validateCreateCabRequestRequest`) but no uniqueness format requirement server-side; a weak/collision-prone key generator is a correctness risk for the exact guarantee this phase exists to provide (RIDE-02's "no duplicate trip" claim), not a place to cut a dependency corner. |
| Two-screen `expo-router` flow for pickup→dropoff | Single screen with internal step state (no route navigation) | CONTEXT.md leaves this to discretion. A single screen holding `step: 'pickup' | 'dropoff'` local state avoids having to serialize lat/lng floats through router params/query-string between two route files, and avoids a redundant `_layout.tsx` Stack entry for a two-step flow with no independent back-button semantics beyond "go to the other step" — recommend this as the simpler implementation, though a two-route `expo-router` Stack (mirroring the Profile `edit.tsx`-as-separate-screen precedent) is equally valid if the planner prefers route-level separation. Either satisfies CONTEXT.md's "functionally equivalent" framing. |

**Installation:**
```bash
npx expo install expo-location expo-crypto
# Then regenerate the native project (see Common Pitfalls — Pitfall 1):
npx expo run:android
```

**Version verification performed 2026-08-12:**
- `expo-location` dist-tags / bundled SDK pin: `~57.0.9` (from `expo`'s own `bundledNativeModules.json`, the authoritative source for what `npx expo install` will resolve)
- `expo-crypto` dist-tags.latest: `57.0.1` (live `npm view`)
- `react-native-maps` installed: `1.27.2`, `codegenConfig` present and populated (inspected `node_modules/react-native-maps/package.json` directly)
- `uuid` dist-tags.latest: `14.0.1` (checked as the rejected alternative, for completeness)

## Architecture Patterns

### Recommended Project Structure
```
src/
├── app/
│   └── (app)/(tabs)/
│       └── book/                        # NEW route subtree replacing Home's placeholder
│           ├── _layout.tsx               # Stack: index (location picker) -> quote -> (confirmation is same-screen state, not a route)
│           ├── index.tsx                 # Pickup/dropoff map-tap screen (single screen, internal step state — see Alternatives Considered)
│           └── quote.tsx                 # Fare breakdown + countdown + "Book this ride"
├── features/
│   └── booking/
│       ├── api.ts                        # cabClient (fareEstimate, requestCab) + useFareEstimateMutation/useRequestCabMutation
│       ├── types.ts                      # fareEstimateResponse, createCabRequestResponse, cab-service ApiErrorBody ({error,message})
│       ├── hooks/
│       │   ├── useCountdown.ts           # NEW — generalizes SessionExpiryBanner's anchored-timestamp pattern for expires_at
│       │   └── useCurrentLocation.ts     # NEW — wraps expo-location permission+one-shot-position flow, graceful-denial fallback
│       └── components/
│           ├── LocationPickerMap.tsx     # MapView + Marker, onPress tap-to-reposition
│           ├── FareBreakdown.tsx         # itemized rows, conditional surcharge/discount
│           └── QuoteCountdown.tsx        # visible MM:SS against expires_at, "expired" state
├── api/
│   └── cab-client.ts                     # NEW — parallel to http-client.ts, different BASE_URL (port 8082) + {error,message} body shape (see Pitfall 3)
└── lib/
    └── idempotency.ts                    # NEW — thin wrapper around Crypto.randomUUID(), isolated for easy jest.mock()
```

### Pattern 1: Tap-to-Pin `MapView` (single controlled marker, uncontrolled initial viewport)
**What:** Render `MapView` with `initialRegion` set once (from GPS or a sane fallback), and a single `Marker` whose `coordinate` is controlled component state. `MapView`'s `onPress` handler updates that state on every tap, moving the marker — no dragging needed, no `Marker`-level `onPress`/`onDragEnd` required for the core interaction (only the map's own tap).
**When to use:** Both the "Set pickup" and "Set dropoff" screens (CONTEXT.md's locked map-tap-to-pin decision).
**Example:**
```tsx
// Source: react-native-maps official docs (github.com/react-native-maps/react-native-maps/blob/master/docs/mapview.md, mapview.md), fetched 2026-08-12
// onPress/onLongPress event shape: { coordinate: LatLng, position: Point }
import MapView, { Marker } from 'react-native-maps';

function LocationPickerMap({ initial, onChange }: { initial: LatLng; onChange: (c: LatLng) => void }) {
  const [coord, setCoord] = useState<LatLng>(initial);

  return (
    <MapView
      style={{ flex: 1 }}
      initialRegion={{ ...initial, latitudeDelta: 0.01, longitudeDelta: 0.01 }}
      onPress={(e) => {
        const next = e.nativeEvent.coordinate;
        setCoord(next);
        onChange(next);
      }}
    >
      <Marker coordinate={coord} />
    </MapView>
  );
}
```
**Note on `region` vs `initialRegion`:** `region` is a fully controlled prop — every parent re-render that passes a `region` value will force the map's viewport, fighting the user's own pan/zoom gestures. `initialRegion` is uncontrolled after first mount (same semantics as a text input's `defaultValue`) — use `initialRegion`, not `region`, so the rider can freely pan/zoom the map while placing a pin without the component snapping the viewport back on every state update.

### Pattern 2: GPS-Default With Graceful Manual-Pin Fallback
**What:** On the pickup screen only, attempt `requestForegroundPermissionsAsync()` → `getCurrentPositionAsync()` before first render of the map, but never block the screen on it — show the map immediately with a reasonable fallback region (e.g. a hardcoded city-center coordinate) and re-center only if/when GPS resolves. Both calls resolve (not throw) on permission denial; `getCurrentPositionAsync` can still reject if location services are off entirely even with permission granted, so wrap it in try/catch regardless.
**When to use:** `useCurrentLocation()` hook, consumed only by the "Set pickup" screen (dropoff has no default per CONTEXT.md).
**Example:**
```tsx
// Source: Expo official docs (docs.expo.dev/versions/latest/sdk/location/), fetched 2026-08-12
import * as Location from 'expo-location';

async function getInitialPickupRegion(): Promise<LatLng | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null; // fall back to manual pin placement, not a crash
    const loc = await Location.getCurrentPositionAsync({});
    return { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
  } catch {
    return null; // GPS/location-services error — same manual-fallback path
  }
}
```
**Why this satisfies "must not crash; let the rider place the pickup pin manually":** Neither call throws on a plain "denied" status (`requestForegroundPermissionsAsync` resolves `{status: 'denied', canAskAgain}`), and the `try/catch` absorbs the rarer "services disabled" rejection from `getCurrentPositionAsync`. Either path returns `null`, which the screen treats identically to "no GPS available" — render the map at a fallback region and let the rider tap to place the pin themselves.

### Pattern 3: Anchored-Timestamp Countdown (adapted from `SessionExpiryBanner`, not copied verbatim)
**What:** `SessionExpiryBanner.tsx` already establishes the correct drift-avoidance shape for this project: never decrement a local counter each tick (drifts under backgrounding/JS-thread pauses); instead recompute `remaining = targetTimestampMs - Date.now()` fresh on every tick, anchored to an absolute epoch value. The fare-quote countdown reuses this shape but differs in three ways the plan should account for: (1) tick interval — the banner uses a background 30-second tick since it's a passive warning; a fare countdown is the *primary focus* of the quote screen and should tick every 1 second for a live MM:SS display; (2) the target is `expires_at` from the fare-estimate response (parsed once via `new Date(expires_at).getTime()`), not a decoded JWT claim; (3) at zero it must flip to an explicit "Quote expired" UI state (CONTEXT.md), not just disappear like the banner does.
**When to use:** `QuoteCountdown.tsx` / a `useCountdown(targetMs: number | null)` hook.
**Example:**
```tsx
// Source: pattern adapted from src/features/auth/components/SessionExpiryBanner.tsx (read directly 2026-08-12)
// — reuses the "recompute from Date.now() each tick" shape, NOT copied verbatim (different tick rate, different terminal-state UI).
function useCountdown(targetMs: number | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!targetMs) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [targetMs]);

  if (!targetMs) return { msRemaining: null, expired: false };
  const msRemaining = Math.max(0, targetMs - now);
  return { msRemaining, expired: msRemaining <= 0 };
}
```
**App-foreground consideration:** Since the quote window is 15 minutes (long enough for a rider to background the app and return), the recompute-from-`Date.now()` shape already self-corrects on the next tick after foregrounding with no special `AppState` handling needed — unlike a decrementing-counter approach, which would have accumulated drift while backgrounded. No extra code required, just confirms the chosen pattern is the right one for this exact scenario.

### Pattern 4: Idempotency Key Held Outside the Mutation, Not Inside It
**What:** TanStack Query v5's `useMutation` has no query-key-style caching/deduplication — every `mutate()`/`mutateAsync()` call is independent, and its own `retry` option (if set) only re-invokes the *same* `mutationFn` call with the *same* captured variables for automatic network-level retries. It does **not** help with the "rider double-taps the button" case, because each tap is a brand-new `mutate()` invocation with its own variables object. The idempotency key must therefore live in state that survives across separate `mutate()` calls but resets on a genuinely new booking intent — a `useRef<string | null>(null)` (or equivalent component state) at the screen/hook level, lazily minted on first tap and passed as part of the mutation's variables, is the correct shape. Reset the ref to `null` only when the rider re-estimates after expiry (mints a new fare + a new key), never on a mere retry of the same tap.
**When to use:** The "Book this ride" mutation (RIDE-02).
**Example:**
```tsx
// Source: reasoned from TanStack Query v5's documented useMutation semantics (tanstack.com/query/v5/docs/framework/react/guides/mutations,
// fetched 2026-08-12 — confirms mutate() takes a single variables object per call and describes no cross-call deduplication mechanism)
// plus the backend's confirmed (rider_id, idempotency_key) replay-returns-existing-request behavior
// (go-ride-kafka-consumers/services/cab-request-handler/internal/api/server.go: createOrLoadCabRequest, read directly 2026-08-12).
function useBookingIdempotencyKey() {
  const keyRef = useRef<string | null>(null);
  const getOrCreateKey = () => {
    if (!keyRef.current) keyRef.current = Crypto.randomUUID();
    return keyRef.current;
  };
  const resetKey = () => { keyRef.current = null; }; // call only on "Get new estimate" after expiry
  return { getOrCreateKey, resetKey };
}

// In the quote screen:
const { getOrCreateKey, resetKey } = useBookingIdempotencyKey();
const requestCab = useRequestCabMutation();

function onBookPress() {
  requestCab.mutate({
    rider_id: user.id,
    fare_id: fare.fare_id,
    idempotencyKey: getOrCreateKey(), // stable across repeated taps of THIS quote
  });
}

// On "Get new estimate" (post-expiry re-quote):
function onNewEstimate() {
  resetKey(); // next "Book this ride" tap mints a genuinely new key
  fareEstimate.mutate({ /* same pickup/dropoff coords */ });
}
```
**Also disable the button while pending:** `disabled={requestCab.isPending}` on "Book this ride" is good UX hygiene to reduce accidental double-taps, but the idempotency key — not the disabled state — is what actually guarantees no duplicate trip; the disabled state alone is not sufficient (a fast double-tap before React re-renders, or two separate app instances/tabs, could both fire before `isPending` flips).

### Pattern 5: Cab-Service Client — Adapted, Not Reused, From `http-client.ts`
**What:** `cab-request-handler` runs on a different `BASE_URL` (port 8082, not 8080) and its error body is `{error, message}` (field `error`), not `go-ride-backend`'s `{code, message}`. A new `cab-client.ts` mirrors `apiRequest`'s shape (fetch wrapper, JSON headers, non-2xx → thrown typed error) but reads a different env var / constant for its base URL and maps `json.error` (not `json.code`) into its error class. It does **not** need `apiRequest`'s centralized-401 logic, since this service has no auth middleware at all — every request is anonymous from the HTTP layer's perspective, `rider_id` travels in the body only.
**When to use:** All `/fare-estimate` and `/request-cab` calls.
**Example:**
```typescript
// Source: pattern mirrors src/api/http-client.ts's shape (read directly 2026-08-12); error-field name and base-URL
// difference confirmed directly against go-ride-kafka-consumers/services/cab-request-handler/internal/api/server.go
// (errorResponse{Error, Message} at line ~85; writeJSONError encodes {error: code, message: message})
const CAB_BASE_URL = process.env.EXPO_PUBLIC_CAB_API_BASE_URL; // NEW env var — do not reuse EXPO_PUBLIC_API_BASE_URL

export class CabApiError extends Error {
  errorCode: string;
  status: number;
  constructor(status: number, body: { error: string; message: string }) {
    super(body.message);
    this.errorCode = body.error; // NOT body.code — different field name than go-ride-backend
    this.status = status;
  }
}

export async function cabRequest<T>(path: string, options: { method?: string; body?: unknown; idempotencyKey?: string } = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey; // matches go-ride-utils/httpheaders.Idempotency
  const response = await fetch(`${CAB_BASE_URL}${path}`, {
    method: options.method ?? 'POST',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new CabApiError(response.status, { error: json.error ?? 'unknown_error', message: json.message ?? 'Something went wrong.' });
  }
  return json as T;
}
```

### Anti-Patterns to Avoid
- **Auto-refetching a new fare quote silently when the countdown hits zero:** CONTEXT.md and the backend both explicitly reject this — `fare_expired` is a hard `409` "rejects rather than silently repricing" by backend design; the client must show an explicit "Quote expired" state with a manual "Get new estimate" action, never a background refetch.
- **Relying on `useMutation`'s `retry` option (or a disabled button) as the sole duplicate-booking guard:** Neither covers the actual failure mode (repeated independent `mutate()` calls from separate taps, or a client that force-quits and reopens mid-request). The idempotency key, generated and held outside the mutation call itself, is the only mechanism that guarantees exactly-once booking end-to-end (the backend enforces it server-side; the client's job is just to keep sending the *same* key for the *same* intent).
- **Using `region` (controlled) instead of `initialRegion` (uncontrolled) for the map viewport:** Fights the user's pan/zoom gestures on every parent re-render (e.g., every time the marker's coordinate state updates from a tap) — use `initialRegion` and let the map own its own viewport thereafter.
- **Treating a `denied` location-permission status as an error to surface in a banner:** CONTEXT.md/the phase description require this to be a silent, graceful fallback to manual pin placement — no error banner, no crash, just skip the GPS-default step.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| Cryptographically-unpredictable idempotency keys | `Date.now() + Math.random()` string concatenation, or a custom counter | `expo-crypto`'s `Crypto.randomUUID()` | The whole point of RIDE-02 is a strong duplicate-booking guard; a weak/predictable key generator undermines the guarantee this phase exists to deliver, for a one-line function call that's already a dependency. |
| GPS position retrieval / permission dialogs | Direct Android `LocationManager`/`FusedLocationProviderClient` JNI bridging | `expo-location`'s `requestForegroundPermissionsAsync`/`getCurrentPositionAsync` | Already the Expo-blessed, tested-across-the-ecosystem wrapper; hand-rolling native location code for a one-shot GPS read on a v1 feature is pure waste. |
| Tap-to-pin map interaction / marker rendering | A custom `PanResponder`-based draggable overlay on a static map image | `react-native-maps`'s `MapView`/`Marker` + `onPress` | Already an installed, Fabric-compatible dependency from Phase 1; a custom gesture-based pin picker would need to reimplement pan/zoom/tap-coordinate-to-lat-lng math that `react-native-maps` already handles correctly against the real Google Maps SDK. |
| Countdown-timer drift correction | A decrementing local counter (`setInterval(() => setSeconds(s => s - 1), 1000)`) | The anchored-timestamp `targetMs - Date.now()` recompute pattern (Pattern 3) | A decrementing counter drifts under any JS-thread pause (backgrounding, GC pause, debugger attach) and has no self-correction; the anchored pattern is already proven correct in this exact codebase via `SessionExpiryBanner`. |

**Key insight:** Every "hand-roll or use a library" decision in this phase's *new* technical surface (maps, location, idempotency keys) has a clear, low-risk, already-adjacent-to-this-stack answer — the only genuinely bespoke code this phase writes is the countdown hook (adapted, not copied, from an existing proven pattern) and the cab-service HTTP client (adapted from `http-client.ts`'s shape, not reused as-is, per the confirmed `{error,message}` vs. `{code,message}` contract difference).

## Common Pitfalls

### Pitfall 1: Adding a Native Dependency to an Already-Prebuilt `android/` Directory Without Regenerating It
**What goes wrong:** `expo-location` and `expo-crypto` both ship native (Kotlin/Java) code that must be autolinked into the Android Gradle project. This project already has a generated `android/` directory from Phase 1's `npx expo run:android` (plan 01-08). Running `npm install`/`npx expo install expo-location expo-crypto` alone updates `node_modules` and `package.json` but does **not** touch the already-generated native project — the app will build and run against the *old* linked-module set until a fresh prebuild happens, then fail at runtime with a "native module not found"/`TurboModuleRegistry` error the first time JS calls `Location.requestForegroundPermissionsAsync()` or `Crypto.randomUUID()`.
**Why it happens:** Expo's config-plugin/autolinking system only re-runs when you explicitly regenerate the native project (`npx expo prebuild` or another `npx expo run:android`, which prebuilds implicitly) — it doesn't watch `package.json` for changes.
**How to avoid:** After installing both packages and adding their config-plugin entries (if any — `expo-location` typically only needs a bare `'expo-location'` entry in `app.config.js`'s `plugins` array for default Android permission strings) to `app.config.js`, run `npx expo run:android` again before writing/running any code that calls either module. Treat this the same way Phase 1 treated the Maps API key — a native rebuild is part of the deliverable, not a side effect to discover later.
**Warning signs:** `TurboModuleRegistry.getEnforcing(...): 'ExpoLocation' could not be found` (or similar for `ExpoCrypto`) at runtime, despite `npm ls expo-location` showing it installed correctly.

### Pitfall 2: Assuming `react-native-maps` Renders Correctly Under RN 0.86's Mandatory New Architecture Without Checking
**What goes wrong:** RN `0.86.2` is fully bridgeless/New-Architecture-only (Old Architecture has been removed as of recent RN releases). `react-native-maps` has a documented, sometimes-contradictory history here: a widely-surfaced 2022 GitHub issue (#4383) says New Architecture support is "not planned" and describes a pink "Unimplemented component" crash screen; but the library's own current compatibility table states Fabric support was added starting `1.26.1+` (requires RN `>= 0.81.1`), and the installed `1.27.2` package's `package.json` already carries a populated `codegenConfig` with Android Fabric wiring (`android.javaPackageName: com.rnmaps.fabric`). Since this codebase has genuinely never rendered a `<MapView>` (Phase 1 only configured the API key, never used the component), there is no empirical confirmation either way in this exact stack.
**Why it happens:** Search results and cached knowledge about this library's New Architecture status are unusually stale/contradictory because Fabric support was added incrementally across versions after the original "not planned" issue was filed and closed.
**How to avoid:** Make "render one bare `<MapView>` with a hardcoded `<Marker>` on the real device" the very first task of Wave 0 for this phase — before any tap-to-pin logic, GPS integration, or screen chrome is built on top of it. If it renders correctly, everything else in this research proceeds as planned. If it doesn't, this becomes a phase-blocking spike (potential need to bump to a newer `react-native-maps` version, e.g. the `1.29.0` line which added further iOS-specific Fabric work per its changelog — though this project is Android-only, so verify the Android-specific Fabric path independently rather than assuming iOS fixes imply Android ones).
**Warning signs:** A pink/red "Unimplemented component: \<AIRMap\>" (or similar) error screen instead of a rendered map; a blank screen with no error at all (the other common New-Architecture-interop-layer failure mode).

### Pitfall 3: Reusing `http-client.ts`'s `ApiError`/`apiRequest` As-Is for the Cab Service
**What goes wrong:** `apiRequest<T>()` reads `json.code` for its error class and calls `useSessionStore.getState().clearSession(...)` on any `401`. `cab-request-handler` returns `{error, message}` (field `error`, not `code`) and has no auth middleware, so it will never legitimately return a `401` for auth reasons — but if a network/proxy layer ever does return a `401` for some other reason, blindly reusing `apiRequest` would incorrectly log the rider out of the *entire app* over a booking-service hiccup that has nothing to do with their session. A parallel `cab-client.ts`/`cabRequest()` (Pattern 5 above) avoids both issues by construction.
**Why it happens:** `http-client.ts` is right there, already working, and copy-paste is the path of least resistance — but this is exactly the kind of "looks compatible, isn't" trap CONTEXT.md's canonical_refs already flagged.
**How to avoid:** Write `cab-client.ts` as a new, small, purpose-built fetch wrapper (Pattern 5) rather than extending or reusing `apiRequest`. Do not import `useSessionStore` into it for 401-handling purposes — only for reading `user.id` as `rider_id`.
**Warning signs:** A booking-flow test asserting session-clearing behavior that shouldn't exist for this service; `ApiError`'s `.code` reading `undefined` at runtime because the actual field is `.error`.

### Pitfall 4: `jest-expo`'s Native-Module Auto-Mocks Resolve to `undefined`, Not Meaningful Defaults
**What goes wrong:** `jest-expo`'s bundled preset (`node_modules/jest-expo/src/preset/moduleMocks/expoModules.js`) *does* know about `ExpoLocation` and auto-generates stub functions for every one of its native methods (`requestForegroundPermissionsAsync`, `getCurrentPositionAsync`, etc.) — but the generic mock-generation logic (`node_modules/jest-expo/src/preset/setup.js`) wraps each as `jest.fn(async () => {})`, i.e. every call **resolves to `undefined`** by default, not to a realistic `{status: 'granted'}` or a coordinate object. A test that calls the real (unmocked-per-test) `requestForegroundPermissionsAsync()` and destructures `{status}` from the result will get `status === undefined`, which is falsy-but-not-`'granted'` — code branches on "not granted" will silently execute, masking bugs in the "granted" path since it's never actually exercised. This is the same class of trap Phase 1 hit with `expo-secure-store`'s non-persisting native stub (documented in `01-02-SUMMARY.md`).
**Why it happens:** `jest-expo`'s auto-mock system only knows method *signatures* (name + argument count) from its bundled Expo-SDK metadata, not sensible return *values* — it can't know what a realistic permission-granted response looks like for every module it covers.
**How to avoid:** Every test exercising the pickup-GPS-default flow must explicitly `jest.mock('expo-location', () => ({ requestForegroundPermissionsAsync: jest.fn(), getCurrentPositionAsync: jest.fn() }))` (or use `jest.spyOn` on the imported module) and set concrete resolved values per test case — one test for granted+success, one for denied, one for granted+`getCurrentPositionAsync` rejecting (services-disabled case) — never rely on the preset's silent `undefined` default to mean anything.
**Warning signs:** A "GPS default" test that passes without ever asserting the map actually centered on a specific coordinate; a permission-denied code path test that "passes" for the wrong reason (because the default mock already looks like "denied").

### Pitfall 5: `expo-crypto`'s Module Is NOT in `jest-expo`'s Auto-Mock List — It Needs a Fully Manual Mock
**What goes wrong:** Grepping `jest-expo`'s bundled mock-module list (`expoModules.js`) for `ExpoCrypto` finds only `ExpoCryptoAES` (a different, AES-specific sub-module) — there is no generic `ExpoCrypto`/`randomUUID` entry. Unlike `expo-location` (Pitfall 4, where a mock *exists* but resolves to unhelpful defaults), `expo-crypto`'s `randomUUID()` may not be auto-mocked at all by the preset, meaning a Jest test calling it for real could throw a native-module-resolution error rather than silently returning something wrong.
**Why it happens:** `jest-expo`'s bundled coverage list doesn't include every Expo SDK module symmetrically; newer or less-common modules can be missing entirely.
**How to avoid:** Isolate all `Crypto.randomUUID()` usage behind a thin project-local wrapper (`src/lib/idempotency.ts`, per the Recommended Project Structure above) and `jest.mock('../../lib/idempotency')` (or `jest.mock('expo-crypto', () => ({ randomUUID: jest.fn(() => 'test-uuid-fixed-value') }))` directly) in every test that exercises the booking mutation — do not assume the preset covers this module the way it covers `expo-location`. Confirm with one trivial passing smoke test before relying on it across the booking-mutation test suite, mirroring the `createSecureStoreMock()` precedent from Phase 1.
**Warning signs:** `Cannot find native module 'ExpoCrypto'` (or similar) thrown mid-test-run for any test that imports a file transitively calling `Crypto.randomUUID()` without an explicit mock in place.

### Pitfall 6: No `jest-expo`/Community Mock Exists for `react-native-maps` — a Hand-Written `__mocks__` File Is Required
**What goes wrong:** `react-native-maps` is a third-party native library, not part of the Expo SDK, so `jest-expo`'s auto-mock system has zero knowledge of it. Any test that renders a component tree including `MapView`/`Marker` without a manual mock will fail (or emit noisy warnings) trying to resolve the underlying native view managers (historically surfaced as missing `AIRMap`/`AIRMapMarker` native component errors in community reports for this exact library).
**Why it happens:** `jest-expo`'s mocking coverage is scoped to first-party Expo SDK native modules; third-party native UI libraries are explicitly out of its scope by design (the project is expected to supply its own manual mock).
**How to avoid:** Create `__mocks__/react-native-maps.js` at the project root (Jest's manual-mock convention — a file at this exact path is auto-used whenever `react-native-maps` is imported in a test, no explicit `jest.mock()` call needed per test file) exporting simple RN-`View`-based stand-ins for `MapView` and `Marker` that still accept and forward the props tests need to assert against (e.g. a stub `MapView` that renders its children and exposes an `onPress` trigger a test can call directly, rather than trying to simulate real native gesture events). This lets component tests for `LocationPickerMap` verify "tapping the map updates the coordinate" logic without ever touching real native map rendering.
**Warning signs:** Jest errors mentioning `AIRMap`, `RNMapsMapView`, or "Native component not found" when running any test that imports a screen/component using `react-native-maps`; test output listing unhandled console warnings about unmocked native view managers.

## Code Examples

Verified patterns from official sources and direct backend-source reads:

### Confirmed fare-estimate response shape (RIDE-01)
```typescript
// Source: go-ride-kafka-consumers/services/cab-request-handler/internal/api/server.go, read directly 2026-08-12
// fareEstimateResponse struct (POST /api/v1/cab/fare-estimate -> 201 Created)
interface FareEstimateResponse {
  fare_id: string;
  currency_code: string;
  base_fare: number;
  distance_fare: number;
  time_fare: number;
  surcharge_total: number;   // render only if nonzero, per CONTEXT.md
  discount_total: number;    // render only if nonzero, per CONTEXT.md
  surge_multiplier: number;  // NEVER render, per CONTEXT.md/PROJECT.md Out of Scope
  total_fare: number;
  pricing_version: string;
  locked_at: string;         // ISO 8601, ends up as a JS Date-parseable string over the wire
  expires_at?: string;       // ISO 8601 — omitempty on the Go side, but always present for a fresh estimate per FARE_LOCK_TTL_MINUTES logic
}

// fareEstimateRequest — confirmed field-level validation in validateFareEstimateRequest:
// rider_id must be a valid UUID; pickup/dropoff lat in [-90,90], lng in [-180,180]; search_radius_km >= 0 (optional, server defaults to DEFAULT_SEARCH_RADIUS_KM=20 if omitted/<=0)
interface FareEstimateRequest {
  rider_id: string;
  pickup_lat: number;
  pickup_lng: number;
  dropoff_lat: number;
  dropoff_lng: number;
  search_radius_km?: number;
}
```

### Confirmed request-cab response shape and error sentinels (RIDE-02)
```typescript
// Source: go-ride-kafka-consumers/services/cab-request-handler/internal/api/server.go, read directly 2026-08-12
// createCabRequestResponse (POST /api/v1/cab/request-cab -> 202 Accepted on success)
interface RequestCabResponse {
  accepted: boolean;
  request_id: string;
  trip_id: string;
  fare_id?: string;
  status: string;             // "search_started" on initial creation
  correlation_id?: string;
  event_id: string;
  published_at: string;
  currency_code?: string;
  estimated_total_fare?: number;
}

// createCabRequestRequest — idempotency_key is body-optional (header takes precedence, see firstNonEmpty below); max 128 chars
interface RequestCabRequest {
  rider_id: string;
  fare_id: string;
  idempotency_key?: string;   // prefer the Idempotency-Key HEADER instead — see below
  correlation_id?: string;
  requested_at?: string;
}

// Error sentinel -> HTTP status mapping, confirmed directly in handleCreateCabRequest's switch:
// errFareNotFound    -> 404 {error: "fare_not_found",     message: "fare_id was not found"}
// errFareExpired     -> 409 {error: "fare_expired",       message: "fare quote has expired; request a new fare estimate"}
// errFareAlreadyUsed -> 409 {error: "fare_already_used",  message: "fare_id has already been booked"}
```

### Confirmed idempotency-key precedence and replay behavior
```go
// Source: go-ride-kafka-consumers/services/cab-request-handler/internal/api/server.go, read directly 2026-08-12
// Header wins over body field:
req.IdempotencyKey = firstNonEmpty(strings.TrimSpace(r.Header.Get(httpheaders.Idempotency)), strings.TrimSpace(req.IdempotencyKey))

// Replay behavior (createOrLoadCabRequest): if an existing TripRequest row already exists for
// (rider_id, idempotency_key), it is loaded and returned AS-IS — no new row created, no re-validation
// of the fare's expired/consumed state — so a retried "Book this ride" tap with the SAME key
// always gets back the SAME request_id/trip_id, even if the fare would otherwise now read as expired/consumed.
// This is exactly the guarantee RIDE-02 needs; the client's only job is to keep sending the same key.
```

### `react-native-maps` onPress event shape (confirmed against official docs)
```typescript
// Source: react-native-maps docs/mapview.md, fetched 2026-08-12
// onPress={(event: MapPressEvent) => void}
// event.nativeEvent = { coordinate: { latitude: number, longitude: number }, position: { x: number, y: number } }
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|-------------------|---------------|--------|
| `react-native-maps` unusable under RN's New Architecture (pink "Unimplemented component" screen) | Fabric support added, requiring `react-native-maps >= 1.26.1` + RN `>= 0.81.1` | `react-native-maps` `1.26.1` release | The installed `1.27.2` clears this bar; older cached knowledge/search results describing this library as New-Architecture-incompatible are now stale for this exact version pin — still worth a Wave 0 smoke test given zero prior usage in this codebase (Pitfall 2). |
| `uuid`/`react-native-get-random-values` polyfill-ordering dance for client-side UUID generation | `expo-crypto`'s native `Crypto.randomUUID()` binding, no polyfill-ordering constraint | Available since `expo-crypto` gained `randomUUID()` (well before SDK 57) | Simpler, fewer dependencies, no risk of a badly-ordered import silently breaking UUID generation. |

**Deprecated/outdated:**
- The 2022-era GitHub issue framing "`react-native-maps` does not support New Architecture, closed as not planned" — superseded by the library's own later `1.26.1+` Fabric support addition; do not treat that issue as current guidance (see Pitfall 2 for the correct, version-specific verification approach).

## Open Questions

1. **Does `react-native-maps@1.27.2` actually render correctly on this project's real Android device under RN `0.86.2`'s New Architecture?**
   - What we know: The library's documented compatibility table says Fabric support starts at `1.26.1+`/RN `>=0.81.1`, both of which this project clears; the installed package's `codegenConfig` corroborates Android Fabric wiring exists in this version line.
   - What's unclear: No one has yet rendered a `<MapView>` in this exact codebase/build — Phase 1 only configured the API key, never the component itself. Given a stale-but-still-prominent GitHub issue claiming outright non-support, empirical confirmation is warranted before designing five screens around it.
   - Recommendation: Make this Wave 0's very first task (bare `<MapView>` + one hardcoded `<Marker>`, rendered and visually confirmed on the real device), per the Summary's primary recommendation. If it fails, this becomes a phase-blocking spike, not a mid-plan surprise.

2. **Exact port/env-var convention for the new `EXPO_PUBLIC_CAB_API_BASE_URL` (or similarly-named) variable**
   - What we know: `cab-request-handler` runs locally on port `8082` (confirmed via `.env.example`'s `HTTP_ADDR=:8082` and CONTEXT.md's session-verified port); Phase 1 only wired `EXPO_PUBLIC_API_BASE_URL` for `go-ride-backend` (port `8080`).
   - What's unclear: No decision has been made yet on the exact new env var's name, nor whether physical-device testing (per Phase 1's established LAN-IP pattern) needs a parallel `192.168.x.x:8082` value alongside the existing `:8080` one in the same `.env`.
   - Recommendation: Add `EXPO_PUBLIC_CAB_API_BASE_URL` to `.env`/`.env.example` following the exact same LAN-IP-for-physical-device convention Phase 1 already established (`01-08-SUMMARY.md`'s "Physical-device networking" pattern) — same host, different port, no new networking pattern needed, just a second variable.

3. **Whether a single-screen (internal step state) or two-route (`expo-router` Stack) pickup→dropoff flow is preferable**
   - What we know: CONTEXT.md explicitly leaves this to discretion, framing both as functionally equivalent.
   - What's unclear: No strong technical reason favors one over the other; this research recommends single-screen (avoids serializing lat/lng through router params) but a two-route Stack (mirroring the Profile `edit.tsx` precedent) is equally valid.
   - Recommendation: Planner's call — pick whichever fits the plan's task-decomposition more naturally; not worth further research.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest `~29.7.0` + `jest-expo/android` preset + `@testing-library/react-native@^14.0.1` (unchanged from Phase 1) |
| Config file | `jest.config.js` (exists, unchanged) — `jest.setup.js` needs new additions: `jest.mock('expo-location', ...)` global default (optional — can also be per-test) and confirmation that `expo-crypto` needs an explicit per-test/global mock (Pitfall 5) |
| Quick run command | `npx jest <path/to/file>.test.ts(x) --watchAll=false` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|---------------------|--------------|
| RIDE-01 | `useCountdown`/`QuoteCountdown` shows correct MM:SS against a fixed `expires_at`, flips to "expired" state at zero, uses fake timers to avoid real 15-min waits; `FareBreakdown` renders `base_fare`/`distance_fare`/`time_fare`/`total_fare` always, `surcharge_total`/`discount_total` only when nonzero, never renders `surge_multiplier` | unit + component | `npx jest src/features/booking/hooks/useCountdown.test.ts src/features/booking/components/FareBreakdown.test.tsx --watchAll=false` | ❌ Wave 0 |
| RIDE-01 | `useFareEstimateMutation` posts `rider_id` (from session store, not decoded JWT) + pickup/dropoff coords to `/fare-estimate`, surfaces the parsed response including `expires_at` | unit + hook | `npx jest src/features/booking/api.test.ts --watchAll=false` | ❌ Wave 0 |
| RIDE-01 | `LocationPickerMap` — tapping the (mocked) map updates the marker coordinate and calls `onChange` with `{latitude, longitude}`; pickup screen defaults to a GPS-resolved region when `expo-location` mock resolves granted+success, falls back gracefully (no crash, no error banner) when mock resolves denied or rejects | component | `npx jest src/features/booking/components/LocationPickerMap.test.tsx src/features/booking/hooks/useCurrentLocation.test.ts --watchAll=false` | ❌ Wave 0 |
| RIDE-02 | Idempotency key is minted once (via mocked `Crypto.randomUUID()`) on first "Book this ride" tap, reused unchanged across a simulated retry (second `mutate()` call with same ref state), and a fresh key is minted only after `resetKey()`/re-estimate | unit + hook | `npx jest src/lib/idempotency.test.ts src/features/booking/hooks/useBookingIdempotencyKey.test.ts --watchAll=false` | ❌ Wave 0 |
| RIDE-02 | `useRequestCabMutation` sends the `Idempotency-Key` header (not just the body field); `fare_expired`/`fare_already_used`/`fare_not_found` map to the exact CONTEXT.md-specified UI branches (expired→same re-estimate action, already_used→success confirmation, not_found→generic banner) | unit + hook | `npx jest src/features/booking/api.test.ts --watchAll=false` | ❌ Wave 0 |
| RIDE-02 | `cab-client.ts`'s `CabApiError` reads `json.error` (not `json.code`); does NOT call `clearSession` on a `401`-shaped response (distinguishing it from `http-client.ts`'s behavior) | unit | `npx jest src/api/cab-client.test.ts --watchAll=false` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** targeted `npx jest <relevant file(s)> --watchAll=false`
- **Per wave merge:** `npm test` (full suite)
- **Phase gate:** Full suite green before `/gsd:verify-work`, plus a manual real-device walkthrough (get estimate → watch countdown tick → let it expire and confirm the "Get new estimate" path → book successfully → double-tap-retry a booking and confirm no duplicate `trip_requests` row/rider-visible duplicate) — mirrors Phase 1's plan-01-08 real-hardware verification precedent.

### Wave 0 Gaps
- [ ] `expo-location` + `expo-crypto` installed and native project regenerated (`npx expo run:android`) — see Pitfall 1; nothing in this phase can be meaningfully tested end-to-end on-device until this is done, though unit/component tests with mocks can proceed in parallel.
- [ ] `app.config.js`'s `plugins` array updated with an `expo-location` entry (default permission strings are likely sufficient — no custom Android permission-rationale string is specified in CONTEXT.md).
- [ ] `__mocks__/react-native-maps.js` — manual Jest mock for `MapView`/`Marker`, does not exist anywhere in this codebase or (per the CONTEXT.md canonical_refs) the sibling driver app. See Pitfall 6.
- [ ] `jest.mock('expo-location', ...)` pattern established (per-test, not global default) for `requestForegroundPermissionsAsync`/`getCurrentPositionAsync` — see Pitfall 4.
- [ ] `jest.mock('expo-crypto', ...)` (or a mocked local `src/lib/idempotency.ts` wrapper) established — see Pitfall 5.
- [ ] `EXPO_PUBLIC_CAB_API_BASE_URL` (or equivalent) added to `.env`/`.env.example` — see Open Question 2.
- [ ] `src/api/cab-client.ts` + its own error type — does not exist yet, needed before any booking-feature test can run against a realistic mocked `fetch`.

*Wave 0 here is unusually large relative to Phase 1's — this phase introduces two new native dependencies and one new backend service, none of which Phase 1 touched.*

## Sources

### Primary (HIGH confidence)
- `go-ride-user-app/.planning/phases/02-fare-estimate-booking/02-CONTEXT.md` — locked decisions for this phase (read in full)
- `go-ride-user-app/.planning/REQUIREMENTS.md`, `.planning/STATE.md` — RIDE-01/RIDE-02 acceptance criteria, project decision history
- `go-ride-user-app/.planning/phases/01-foundation-auth/{01-CONTEXT,01-RESEARCH}.md` and all `01-0N-SUMMARY.md` files (01-01 through 01-08) — read directly, ground truth for existing patterns/versions/pitfalls this phase builds on
- `go-ride-user-app/src/api/http-client.ts`, `src/stores/session-store.ts`, `src/features/auth/components/SessionExpiryBanner.tsx`, `src/api/types.ts`, `jest.setup.js`, `package.json` — read directly, current as of 2026-08-12
- `go-ride-kafka-consumers/services/cab-request-handler/internal/api/server.go` — read directly in full for the relevant sections (route table, all four DTO structs, `handleCreateCabRequest`/`handleFareEstimate`/`createOrLoadCabRequest`, `validateFareEstimateRequest`/`validateCreateCabRequestRequest`, `writeJSONError`, `firstNonEmpty`) — confirms every backend-contract claim in this document and in `02-CONTEXT.md`, still current as of 2026-08-12
- `go-ride-kafka-consumers/services/cab-request-handler/internal/config/config.go` + `.env.example` — read directly, confirms `HTTP_ADDR=:8082` default, `FARE_LOCK_TTL_MINUTES=15` default
- `go-ride-kafka-consumers/CLAUDE.md` — confirms the idempotency/correlation conventions described are repo-wide, not `cab-request-handler`-specific
- Live npm/local checks 2026-08-12: `node_modules/expo/bundledNativeModules.json` (`expo-location: ~57.0.9`), `npm view expo-crypto` (`57.0.1` current), `node_modules/react-native-maps/package.json` (`1.27.2`, populated `codegenConfig`), `node_modules/jest-expo/src/preset/moduleMocks/expoModules.js` (confirms `ExpoLocation` IS covered by the auto-mock list, `ExpoCrypto`/`randomUUID` is NOT — only `ExpoCryptoAES` appears), `node_modules/jest-expo/src/preset/setup.js` (confirms auto-mocked native functions default to `jest.fn(async () => {})`, i.e. resolve to `undefined`)

### Secondary (MEDIUM confidence)
- [react-native-maps mapview.md docs](https://github.com/react-native-maps/react-native-maps/blob/master/docs/mapview.md) — WebFetch, `onPress`/`onLongPress` event shape, `region` vs `initialRegion` semantics, `provider` prop default behavior on Android, `onMapReady`/`onRegionChangeComplete` — no independent way to verify short of the Wave 0 smoke test itself, but internally consistent with the installed package's TypeScript types
- [react-native-maps npm README compatibility table](https://www.npmjs.com/package/react-native-maps) (fetched via GitHub README mirror) — Fabric support starting `1.26.1+`/RN `>=0.81.1`, cross-verified against the installed package's `codegenConfig` presence (matches)
- [Expo Location documentation](https://docs.expo.dev/versions/latest/sdk/location/) — WebFetch, permission flow, one-shot position API, Android config-plugin requirement, denial-handling behavior
- [expo-crypto npm/docs](https://docs.expo.dev/versions/latest/sdk/crypto/) — WebSearch, `randomUUID()` basic usage confirmed
- [TanStack Query v5 Mutations guide](https://tanstack.com/query/v5/docs/framework/react/guides/mutations) — WebFetch; confirms no built-in idempotency-key/deduplication feature exists (explicitly checked for and absent), confirms `mutate()`'s single-variables-object call shape
- WebSearch: "Hermes crypto.randomUUID() built-in global React Native 0.86 no polyfill" — confirms Hermes has no built-in Web Crypto API implementation, justifying the `expo-crypto` dependency choice over a hoped-for zero-dependency global

### Tertiary (LOW confidence)
- A 2022 GitHub issue (react-native-maps/react-native-maps#4383) describing New Architecture as "not planned" — explicitly flagged in this document as stale/superseded (see Pitfall 2, State of the Art); included only to explain why the Wave 0 smoke-test recommendation exists, not as current guidance.

## Metadata

**Confidence breakdown:**
- Backend contract (cab-request-handler routes/DTOs/idempotency/error shapes): HIGH — read directly from Go source in the sibling repo today, matches CONTEXT.md's own prior verification exactly
- Phase 1 pattern reuse (SessionExpiryBanner, http-client shape, session-store, jest tooling): HIGH — read directly from this repo's actual shipped code, not inferred
- `react-native-maps` API surface (onPress/Marker/region semantics): MEDIUM-HIGH — official docs cross-verified against installed package types, but zero empirical on-device confirmation yet in this codebase (see Open Question 1)
- `react-native-maps` New Architecture compatibility: MEDIUM — resolved a real, stale-vs-current information conflict using the library's own compatibility table + installed `codegenConfig` evidence, but explicitly flagged for a Wave 0 empirical check rather than asserted as certain
- `expo-location` API/permission flow: HIGH — official Expo docs, directly matches the version pin confirmed against this project's own `expo` package metadata
- Test-mocking mechanics (`jest-expo` auto-mock behavior for `ExpoLocation`/absence for `ExpoCrypto`, absence of any `react-native-maps` mock): HIGH for what's IN the bundled preset (inspected the actual shipped file), MEDIUM for the exact runtime failure mode of the missing `ExpoCrypto`/`react-native-maps` mocks (reasoned from the preset's structure, not yet empirically triggered in this session)
- Idempotency-key/TanStack Query mutation pattern: MEDIUM-HIGH — grounded in TanStack's own documented `useMutation` semantics (confirmed no built-in dedup feature exists) plus the backend's confirmed replay behavior; the client-side `useRef` shape itself is standard React reasoning, not a sourced library recommendation (TanStack's docs don't prescribe this specific pattern, they simply don't contradict it)

**Research date:** 2026-08-12
**Valid until:** ~14 days for `react-native-maps` New-Architecture-compatibility findings specifically (fast-moving area, re-verify with a fresh WebSearch/changelog check if planning is delayed); ~30 days for the rest (backend contract is stable per PROJECT.md's "backend is a dependency" principle, Phase 1 pattern reuse is proven-in-repo and won't drift).

---
*Phase: 02-fare-estimate-booking*
*Research completed: 2026-08-12*
