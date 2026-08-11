# Stack Research

**Domain:** Rider-side map/location UX + address geocoding + test tooling for a ride-hailing Expo/React Native app
**Researched:** 2026-08-11
**Confidence:** HIGH (versions verified live against npm registry + official Google/Expo docs on research date), MEDIUM (react-native-maps New Architecture maturity, exact Places/Routes REST shapes not yet exercised in this codebase)

## Scope Note — Read This First

This research does **NOT** re-evaluate the core stack. Per `PROJECT.md`, the following are **already decided, locked, and mirrored exactly from `go-ride-driver-app`** — do not deviate:

| Already Decided (mirror driver app) | Version | Notes |
|---|---|---|
| Expo SDK 57 (custom dev client, not Expo Go) | `~57.0.9` | |
| React Native | `0.86.2` | New Architecture is mandatory at this RN version — legacy architecture is not an option |
| React | `19.2.3` | |
| TypeScript strict | `~6.0.3` | |
| expo-router `(auth)`/`(app)` groups + `Stack.Protected` | `~57.0.9` | |
| TanStack Query v5 + Zustand v5 | `^5.101.4` / `^5.0.14` | |
| react-hook-form + zod | `^7.84.0` / `^4.4.3` | |
| NativeWind v4 | `^4.2.6` | |
| Hand-rolled WebSocket client singleton | — | No library (e.g. no `socket.io-client`) |
| expo-secure-store for JWT | `~57.0.1` | |
| **react-native-maps** | **`1.27.2`** | Locked — see below for how to *use* it for rider-specific needs, not whether to use it |
| expo-location | `~57.0.9` (driver pinned `~57.0.7`; `57.0.9` is current `latest`/`next` as of today — use `npx expo install expo-location` to resolve the exact SDK-57-compatible patch) | Driver app uses it for background tracking; rider app's usage is different (see below) |
| react-native-reanimated / worklets | `4.5.1` / `0.10.1` | |
| react-native-gesture-handler | `~2.32.0` | |

This document covers only the **new decisions** required for the rider side: (1) how to animate/render the driver's live location and the pickup→dropoff route on top of the already-locked `react-native-maps`, (2) address search/geocoding for pickup and dropoff selection, and (3) test tooling versions for a Phase-1 TDD start (vs. the driver app's mid-build retrofit).

## Recommended Stack (New Decisions Only)

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Google Routes API `computeRoutes`, `polylineEncoding: GEO_JSON_LINESTRING` | v2 REST (no SDK) | Pickup→dropoff route polyline for the map | The Maps API key already provisioned for this project (per `go-ride-driver-app/PROJECT.md`, shared Google Cloud project) is restricted to **Maps SDK for Android, Places API (New), and Routes API only** — Routes API is already enabled, no new API needs turning on. Requesting `GEO_JSON_LINESTRING` instead of the default `ENCODED_POLYLINE` returns coordinates directly as a GeoJSON `LineString` — **this eliminates the need for any polyline-decoding library** (`@mapbox/polyline` etc.), because `react-native-maps`'s `<Polyline coordinates={...}>` just wants an array of `{latitude, longitude}` points. Verified against official `computeRoutes` reference docs, 2026-08-11. |
| Google Places API (New) — Autocomplete (New) + Place Details (New), called directly via `fetch` | REST, no SDK | Pickup/dropoff address search-as-you-type | Same already-enabled key covers Places API (New). Hand-roll a thin client function (2 endpoints: `POST places:autocomplete`, `GET places/{id}` with a field mask) behind this app's existing typed-API-client convention — **do not add a third-party autocomplete widget** (see "What NOT to Use"). This mirrors the driver app's own architecture guidance: "Routes/Places calls should go through the typed API client layer like any other external call, not be scattered in map components." |
| `react-native-maps` `Marker` ref + `animateMarkerToCoordinate(coordinate, duration)` (imperative method, not `AnimatedRegion`) | Built into locked `1.27.2` — no new dependency | Smoothly move the assigned driver's marker icon between location pushes instead of teleporting it | This project is Android-first with iOS explicitly deferred, and `animateMarkerToCoordinate()` is specifically the **Android-native, non-JS-driven** animation path documented for `react-native-maps` — it avoids `AnimatedRegion`, which is the cross-platform (iOS-oriented) API built on the legacy `Animated` module and has a long history of jank/threading complaints on Android, especially now that RN 0.86 mandates the New Architecture and `react-native-maps`'s Fabric support is still described by its own maintainers as "stabilizing" (GitHub discussions #5355, #5616, as of 2026). Since iOS isn't in scope this milestone, there's no need to maintain the `AnimatedRegion` cross-platform branch at all — use the simpler, more reliable Android path exclusively. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none — hand-rolled hook) `useSmoothMarkerPosition` or equivalent | — | Ease the marker between two coordinates over the ~2-5s gap between WebSocket location pushes, calling `animateMarkerToCoordinate` on each new push with a duration matched to the expected push interval | Wrap in a small custom hook (`src/features/trip/use-driver-marker.ts`), not a dependency — this is ~20 lines calling a single imperative ref method, not infrastructure. Confirms this project's existing "hand-roll thin glue, don't add a library for something the platform already provides" pattern (same reasoning already applied to the WS client). |
| `expo-location` `getCurrentPositionAsync` | Already a locked dependency (see mirror table) | Center the map on the rider's current location as the default pickup point | Rider-specific usage differs from the driver app's: no background task/foreground-service tracking needed here — just a one-shot foreground location read when the booking screen opens, plus permission request. Do not add `expo-task-manager`/`expo-background-task` for the rider app (those are locked driver-app dependencies for background tracking, not needed for a rider who only requests a fare estimate and watches the map in-app). |
| `expo-location` `reverseGeocodeAsync` | Already a locked dependency | Zero-network, instant *fallback* label while a network reverse-geocode resolves, for the "drag pin to adjust pickup" flow | **Do not rely on this as the primary source of truth** — see "What NOT to Use" below; it has documented reliability issues on Android and no longer falls back to Google's geocoder itself. |
| Google Geocoding API (reverse geocoding only) | REST, no SDK | Primary reverse-geocode of a dragged-pin's lat/lng into a display address | **New API — needs enabling on the existing Maps key** (currently restricted to Maps SDK/Places New/Routes only; Geocoding API is a separate, additional API to turn on in Google Cloud Console — cheap, single checkbox, same project). Places API (New) has no standalone "reverse geocode an arbitrary point" endpoint (Autocomplete/Nearby Search are prediction/category search, not coordinate→address); Geocoding API is the correct, purpose-built API for this. Flag this as a setup task, not a client-side blocker. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `jest-expo` | Jest preset that mocks Expo/RN native modules | Pin `^57.0.4` (current `latest`/`next` dist-tag for the SDK-57 line as of 2026-08-11 — one patch ahead of what the driver app pinned on 2026-08-10, `57.0.3`; the `57.0.0` release had a broken peer dep on `@react-native/jest-preset@^0.85.0` vs this repo's RN `0.86.2`, fixed `57.0.1`+, so anything `≥57.0.1` is safe but `^57.0.4` is the current recommendation). Verified live via `npm view jest-expo dist-tags` today. |
| `jest` | Test runner | Pin `~29.7.0` explicitly, do not take `jest@latest` (which resolves to `30.4.2`). `jest-expo@57.0.4`'s own bundled sub-dependencies (`jest-snapshot`, `babel-jest`, `@jest/globals`) are still pinned to `^29.2.1` as of today — confirms jest 29.x, not 30.x, is the correct pairing for this Expo SDK line right now. |
| `@react-native/jest-preset` | RN-specific Jest transform/mock preset, required peer of `jest-expo` | Pin `^0.86.2` explicitly as a devDependency (matches this repo's locked `react-native@0.86.2`) — `jest-expo` lists it only as a `peerDependency` (`^0.86.2`), it is not auto-installed as a transitive dependency, and its own `latest`/`next` npm tag currently points at `0.88.0` nightlies (ahead of this repo's RN version) — installing without an explicit pin risks resolving a mismatched preset. |
| `@testing-library/react-native` | Component/hook rendering + queries | Pin `^14.0.1` (current `latest` as of today). Peer requires `react >=19.0.0`, `react-native >=0.78`, `test-renderer ^1.0.0` — all satisfied. |
| `test-renderer` | Shim package RNTL v14 depends on in place of the now-deprecated `react-test-renderer` under React 19 | Add explicitly as a devDependency (`^1.2.0`, matching the driver app) — it's a peer dependency of `@testing-library/react-native`, not always auto-resolved. |
| `@types/jest` | TS types for Jest globals | Pin to match whatever `jest` resolves to (`~29.x` types) if not using `@jest/globals` imports directly. |

## Installation

```bash
# Rider-specific map/geocoding: no new native packages — react-native-maps 1.27.2 is
# already the locked dependency; Places/Routes API calls are plain fetch(), no SDK to install.

# Test tooling — start from Phase 1, unlike the driver app's mid-build retrofit
npx expo install jest-expo jest --dev
npm install -D @react-native/jest-preset@^0.86.2 @testing-library/react-native@^14.0.1 test-renderer@^1.2.0 @types/jest
```

```json
// jest.config.js — mirror the driver app's actual (not its research doc's) config exactly:
// module.exports = {
//   preset: 'jest-expo/android',
//   testPathIgnorePatterns: ['/node_modules/', '/android/', '/.expo/', '/dist/'],
// };
```
Use `jest-expo/android` (not the bare `jest-expo` preset) — this repo is Android-first per `PROJECT.md`, and the driver app's *actual shipped config* (verified by reading `go-ride-driver-app/jest.config.js` directly) uses the platform-scoped preset, not the generic one shown in that app's own earlier research doc — trust the shipped file over the research doc where they disagree.

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Hand-rolled `fetch` calls to Places API (New) Autocomplete + Place Details | `react-native-google-places-textinput` (npm, actively maintained, purpose-built for Places API (New), handles session tokens automatically) | If address-search UI needs to ship very fast and the team is willing to accept a third-party component's own styling model fighting against this project's NativeWind/`TextInput` primitive conventions. Not recommended here: this project's existing primitives (`TextInput`, `Select`) and its "hand-roll thin glue over already-provisioned APIs" pattern (established by the KYC presigned-upload flow in the sibling driver app) both favor a small first-party component over a new dependency for what is fundamentally two REST calls. |
| Hand-rolled `fetch` calls to Places API (New) | `react-native-google-places-autocomplete` (older, most popular, legacy Places API only) | Never for this project — it targets the **legacy** Places API, which is a different (and Google-deprecated-for-new-usage) API surface than what this project's key is restricted to (Places API **(New)**). Using it would require either a second, differently-scoped API key or re-enabling the legacy API on the existing one — avoid. |
| `GEO_JSON_LINESTRING` polyline from Routes API (no decode library) | `ENCODED_POLYLINE` (default) + `@mapbox/polyline` or `@googlemaps/polyline-codec` to decode | If bandwidth is a hard constraint (encoded polylines are more compact over the wire than GeoJSON coordinate arrays) — unlikely to matter at this app's scale (one route per trip, not thousands). Decoding is a solved, well-tested one-line library either way if this tradeoff is later revisited. |
| `animateMarkerToCoordinate()` (Android-only imperative API) | `AnimatedRegion` + `Marker.Animated` (cross-platform) | If/when iOS support is picked back up (explicitly deferred per `PROJECT.md`) — at that point, re-research `AnimatedRegion`'s current Fabric compatibility rather than assuming this recommendation still holds, since `react-native-maps`'s New Architecture support was still described as actively stabilizing as of this research date. |
| Google Geocoding API for reverse-geocoding a dragged pin | `expo-location`'s `reverseGeocodeAsync` as primary | If avoiding any new Google API enablement is a hard constraint and occasional reverse-geocode failures/empty results on Android are acceptable UX (e.g., always let the rider manually confirm/edit the resolved address text). Not recommended as primary given the documented Android reliability issues below. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `react-native-maps`'s `AnimatedRegion` / `Marker.Animated` for the driver-tracking marker | Built on the legacy `Animated` API, historically Android-jank-prone, and cross-platform value this app doesn't need since iOS is explicitly out of scope this milestone; RN 0.86's mandatory New Architecture adds further uncertainty to a code path this app doesn't need at all | `markerRef.current.animateMarkerToCoordinate(coordinate, duration)` — Android-native, simpler, no extra library or animated-value bookkeeping |
| Legacy (non-"New") Google Places API / `react-native-google-places-autocomplete` | Different API surface than what the existing, already-restricted Maps key is scoped to (Places API **(New)** only); would require re-scoping or a second key | Places API (New) `:autocomplete` + Place Details (New), called directly |
| `expo-location`'s `reverseGeocodeAsync` as the sole/primary reverse-geocode source | No longer falls back to Google's geocoder on Android (relies purely on the on-device Android Geocoder/Play Services), and has an open, credible reliability report (expo/expo#36116) of failing outright on Android across several recent SDK lines | Google Geocoding API (new, needs enabling) as primary; `reverseGeocodeAsync` only as an instant, best-effort placeholder label while the network call is in flight |
| A polyline-decoding library (`@mapbox/polyline`, etc.) for the route line | Unnecessary — Routes API can return GeoJSON coordinates directly via `polylineEncoding: GEO_JSON_LINESTRING`, consumable as-is by `<Polyline coordinates={...}>` | Request `GEO_JSON_LINESTRING` in the `computeRoutes` request body |
| `jest@latest` / unpinned `jest` | Resolves to `30.4.2`, which `jest-expo`'s current SDK-57 build (`57.0.4`) does not pair with (its own bundled sub-deps are still on the `29.2.1` line) | Pin `jest ~29.7.0` explicitly |
| Bare `preset: 'jest-expo'` in `jest.config.js` | Contradicts what the sibling driver app actually shipped and verified working (`jest-expo/android`) — the platform-scoped preset is more correct for an Android-first app and avoids pulling in iOS-only mock surface | `preset: 'jest-expo/android'` |
| Rendering the driver's marker as a custom `<View>`-based icon without `tracksViewChanges={false}` | `react-native-maps` re-rasterizes any custom marker view on every re-render by default (`tracksViewChanges` defaults to `true`), which is a well-documented, severe Android performance killer once the marker updates every 2-5s on live location pushes | Set `tracksViewChanges={false}` on the driver marker once its icon/rotation has settled, only flipping it briefly `true` when the icon asset itself actually changes (e.g. vehicle-type icon swap), not on every coordinate update |

## Stack Patterns by Variant

**If a later phase adds iOS support (currently deferred):**
- Re-research `react-native-maps`'s Fabric/New-Architecture status for `AnimatedRegion` at that time before assuming the Android-only `animateMarkerToCoordinate()` recommendation extends cross-platform — this was an explicit known gap as of this research date, not a settled fact.

**If Places (New) Autocomplete billing becomes a concern at scale:**
- Add a session token (a client-generated UUID) to the Autocomplete request and reuse it through the paired Place Details call, then discard it — Google's own session-token mechanism bundles the whole search-then-select flow into single-session pricing instead of per-keystroke pricing. Not a new dependency; just a UUID (RN's built-in `crypto.randomUUID()` under Hermes, or `expo-crypto`, already effectively free) threaded through the existing hand-rolled Places client function.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `jest-expo@^57.0.4` | `jest@~29.7.0` | `jest-expo@57.0.0` had a broken peer on `@react-native/jest-preset@^0.85.0` vs this repo's RN `0.86.2` — fixed `57.0.1`+; verified live today that `57.0.4`'s bundled sub-deps still target the Jest 29.x line, not 30.x |
| `@react-native/jest-preset@^0.86.2` | `react-native@0.86.2` | Must match RN's own version exactly (peer-declared by `jest-expo` as `^0.86.2`) — do not take this package's own `latest` tag, which as of today resolves to `0.88.0` nightlies ahead of this repo's RN version |
| `@testing-library/react-native@^14.0.1` | `react@19.2.3`, `react-native@0.86.2`, `test-renderer@^1.2.0` | Peers satisfied; `test-renderer` (not `react-test-renderer`) is the correct shim package for React 19 |
| `react-native-maps@1.27.2` (locked) | `react-native@>=0.76.0`, `react@>=18.3.1` | Both satisfied; New Architecture support described by maintainers as still stabilizing as of this research date (GitHub discussions #5355/#5616) — this shouldn't block adoption (it's already locked), but budget time to verify marker/polyline rendering behaves correctly under RN 0.86.2's mandatory Fabric at implementation time, since neither app in this family has built a map screen yet |
| Google Maps API key (existing, shared project) | Currently restricted to: Maps SDK for Android, Places API (New), Routes API | Geocoding API is a **separate API not yet enabled on this key** — required if adopting the reverse-geocoding recommendation above; enabling it is a Google Cloud Console change, not a client dependency change |

## Sources

- `go-ride-driver-app/package.json`, `go-ride-driver-app/jest.config.js`, `go-ride-driver-app/babel.config.js` — read directly, 2026-08-11, ground truth for exact locked versions and the *actual shipped* (not just researched) Jest config
- `go-ride-driver-app/.planning/PROJECT.md` — confirms the shared Google Maps API key's exact restriction scope ("Maps SDK for Android, Places API (New), and Routes API")
- `go-ride-driver-app/.planning/phases/01.1-.../01.1-RESEARCH.md` — prior first-hand account of the `jest-expo@57.0.0` peer-dep bug and its fix version, cross-checked and reconfirmed live against npm today
- npm registry, queried live 2026-08-11: `jest-expo` dist-tags/versions/dependencies (`latest`=`next`=`57.0.4`), `jest` versions (`latest`=`30.4.2`, 29.x line tops out `29.7.0`), `@react-native/jest-preset` versions (`latest`/`next` = `0.88.0` nightlies), `@testing-library/react-native@latest` (`14.0.1`) + peerDependencies, `react-native-maps@1.27.2` peerDependencies and `react-native-maps@latest` (`1.29.0`, confirming `1.27.2` is a recent-but-not-bleeding-edge pin)
- [Google Routes API — `computeRoutes` reference](https://developers.google.com/maps/documentation/routes/reference/rest/v2/TopLevel/computeRoutes) — `polylineEncoding` field, `GEO_JSON_LINESTRING` vs `ENCODED_POLYLINE`, field mask requirements
- [Google Places API (New) — Place Autocomplete](https://developers.google.com/maps/documentation/places/web-service/place-autocomplete) — confirmed Autocomplete (New) responses do not include coordinates (Place Details (New) required), session token support
- [react-native-maps GitHub — New Architecture discussions #5355](https://github.com/react-native-maps/react-native-maps/discussions/5355), [#5616](https://github.com/react-native-maps/react-native-maps/discussions/5616), [issue #4383](https://github.com/react-native-maps/react-native-maps/issues/4383) — MEDIUM confidence, community/maintainer discussion not an official compatibility statement; corroborated across multiple threads
- [expo/expo issue #36116 — `reverseGeocodeAsync` fails on Android SDK 50+](https://github.com/expo/expo/issues/36116) — MEDIUM confidence, single GitHub issue, used only to justify treating on-device reverse geocoding as a fallback rather than primary source
- WebSearch (multiple queries, 2026-08-11) on `animateMarkerToCoordinate` vs `AnimatedRegion` platform guidance, `react-native-google-places-textinput` — MEDIUM confidence, cross-referenced across 2-3 sources each, consistent with official docs where checked

---
*Stack research for: go-ride-user-app rider-side map/geocoding + test tooling*
*Researched: 2026-08-11*
