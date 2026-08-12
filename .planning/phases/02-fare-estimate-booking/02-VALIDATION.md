---
phase: 02
slug: fare-estimate-booking
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-08-12
updated: 2026-08-12
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest `~29.7.0` + `jest-expo/android` preset + `@testing-library/react-native@^14.0.1` (unchanged from Phase 1) |
| **Config file** | `jest.config.js` (unchanged) — `jest.setup.js` gains `EXPO_PUBLIC_CAB_API_BASE_URL` plus global `expo-crypto` and `expo-location` mocks; a new root `__mocks__/react-native-maps.js` is added |
| **Quick run command** | `npx jest <path/to/file>.test.ts(x) --watchAll=false` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~30-60 seconds (growing suite; Phase 1 baseline was 72 tests / 13 suites) |

---

## Sampling Rate

- **After every task commit:** targeted `npx jest <relevant file(s)> --watchAll=false`
- **After every plan wave:** `npm test` (full suite) + `npx tsc --noEmit`
- **Before `/gsd:verify-work`:** Full suite green, `npx expo lint` green, plus the manual real-device walkthrough below
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

Plans execute sequentially, one plan per wave (parallelization is disabled project-wide in `.planning/config.json`).

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01 Task 1 — install deps, config plugin, cab base URL | 02-01 | 1 | infra (expo-location, expo-crypto, env) | setup | `npm ls expo-location expo-crypto && npx tsc --noEmit && npm test` | ✅ after 02-01 | ⬜ pending |
| 02-01 Task 2 — expo-crypto + expo-location Jest mocks | 02-01 | 1 | infra (Pitfalls 4, 5) | unit | `npx jest src/test-utils/smoke.test.ts --watchAll=false` | ✅ after 02-01 | ⬜ pending |
| 02-01 Task 3 — `__mocks__/react-native-maps.js` | 02-01 | 1 | infra (Pitfall 6) | component | `npx jest src/test-utils/maps-mock.test.tsx --watchAll=false` | ✅ after 02-01 | ⬜ pending |
| 02-02 Task 1 — native rebuild + smoke screen install | 02-02 | 2 | infra (Pitfall 1) | setup | `grep -q ACCESS_FINE_LOCATION android/app/src/main/AndroidManifest.xml && adb shell pm list packages \| grep com.goride.rider` | n/a (build output) | ⬜ pending |
| 02-02 Task 2 — MapView renders under New Architecture | 02-02 | 2 | infra (Pitfall 2 / Open Q1) | manual on-device | Human-gated. Automated companion: `npx jest src/test-utils/maps-mock.test.tsx --watchAll=false` | n/a | ⬜ pending |
| 02-03 Task 1 — cab-client + booking DTO types | 02-03 | 3 | infra (Pitfall 3) | unit | `npx jest src/api/cab-client.test.ts --watchAll=false` | ✅ after 02-03 | ⬜ pending |
| 02-03 Task 2 — `newIdempotencyKey` | 02-03 | 3 | RIDE-02 | unit | `npx jest src/lib/idempotency.test.ts --watchAll=false` | ✅ after 02-03 | ⬜ pending |
| 02-03 Task 3 — booking draft store | 02-03 | 3 | RIDE-01 | unit | `npx jest src/features/booking/store.test.ts --watchAll=false` | ✅ after 02-03 | ⬜ pending |
| 02-04 Task 1 — `useBookingIdempotencyKey` | 02-04 | 4 | RIDE-02 | unit + hook | `npx jest src/features/booking/hooks/useBookingIdempotencyKey.test.ts --watchAll=false` | ✅ after 02-04 | ⬜ pending |
| 02-04 Task 2 — fare-estimate + request-cab mutations | 02-04 | 4 | RIDE-01, RIDE-02 | unit + hook | `npx jest src/features/booking/api.test.ts --watchAll=false` | ✅ after 02-04 | ⬜ pending |
| 02-04 Task 3 — `useRiderId` cold-start fallback | 02-04 | 4 | RIDE-01, RIDE-02 | hook | `npx jest src/features/booking/hooks/useRiderId.test.tsx --watchAll=false` | ✅ after 02-04 | ⬜ pending |
| 02-05 Task 1 — `useCountdown` + `formatMmSs` | 02-05 | 5 | RIDE-01 | unit | `npx jest src/features/booking/hooks/useCountdown.test.ts --watchAll=false` | ✅ after 02-05 | ⬜ pending |
| 02-05 Task 2 — `QuoteCountdown` | 02-05 | 5 | RIDE-01 | component | `npx jest src/features/booking/components/QuoteCountdown.test.tsx --watchAll=false` | ✅ after 02-05 | ⬜ pending |
| 02-05 Task 3 — `FareBreakdown` | 02-05 | 5 | RIDE-01 | component | `npx jest src/features/booking/components/FareBreakdown.test.tsx --watchAll=false` | ✅ after 02-05 | ⬜ pending |
| 02-06 Task 1 — `useCurrentLocation` | 02-06 | 6 | RIDE-01 | hook | `npx jest src/features/booking/hooks/useCurrentLocation.test.ts --watchAll=false` | ✅ after 02-06 | ⬜ pending |
| 02-06 Task 2 — `LocationPickerMap` | 02-06 | 6 | RIDE-01 | component | `npx jest src/features/booking/components/LocationPickerMap.test.tsx --watchAll=false` | ✅ after 02-06 | ⬜ pending |
| 02-07 Task 1 — `LocationPickerScreen` | 02-07 | 7 | RIDE-01 | component | `npx jest src/features/booking/components/LocationPickerScreen.test.tsx --watchAll=false` | ✅ after 02-07 | ⬜ pending |
| 02-07 Task 2 — book routes, Book tab, Home entry point | 02-07 | 7 | RIDE-01 | typecheck + suite | `npm test && npx tsc --noEmit && npx expo lint` | n/a (route wiring) | ⬜ pending |
| 02-08 Task 1 — `FareQuoteScreen` | 02-08 | 8 | RIDE-01, RIDE-02 | component | `npx jest src/features/booking/components/FareQuoteScreen.test.tsx --watchAll=false` | ✅ after 02-08 | ⬜ pending |
| 02-08 Task 2 — quote route wrapper | 02-08 | 8 | RIDE-01, RIDE-02 | typecheck + suite | `npm test && npx tsc --noEmit && npx expo lint` | n/a (route wiring) | ⬜ pending |
| 02-09 Task 1 — automated phase gate + device build | 02-09 | 9 | RIDE-01, RIDE-02 (gate) | typecheck + suite + lint | `npx tsc --noEmit && npm test && npx expo lint` | n/a | ⬜ pending |
| 02-09 Task 2 — real-device walkthrough + duplicate-booking row count | 02-09 | 9 | RIDE-01, RIDE-02 (gate) | manual on-device | Human-gated. See Manual-Only Verifications below. | n/a | ⬜ pending |
| 02-09 Task 3 — validation/state/roadmap close-out | 02-09 | 9 | RIDE-01, RIDE-02 (gate) | docs | `! grep -q "⬜ pending" .planning/phases/02-fare-estimate-booking/02-VALIDATION.md` | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Sampling continuity check:** no three consecutive tasks lack an automated verify. The only two human-gated tasks (02-02 Task 2 and 02-09 Task 2) are each immediately preceded by an automated-gate task and each carry an automated companion assertion.

---

## Requirement Coverage

| Requirement | Covered by | Proven by |
|-------------|------------|-----------|
| **RIDE-01** — fare estimate with itemized breakdown and visible expiry countdown | 02-03 (types/store), 02-04 (estimate mutation, riderId), 02-05 (countdown, breakdown), 02-06 (map/GPS), 02-07 (picker screen), 02-08 (quote screen), 02-09 (gate) | `FareBreakdown.test.tsx` (row rules incl. no-surge and no-zero-rows), `useCountdown.test.ts` (drift correction), `FareQuoteScreen.test.tsx` (mount estimate, countdown display, explicit expiry, no silent refetch), device walkthrough steps 4-11 |
| **RIDE-02** — idempotent booking via `Idempotency-Key` | 02-03 (`newIdempotencyKey`, cab-client header), 02-04 (`useBookingIdempotencyKey`, request-cab mutation), 02-08 (quote screen booking + error mapping), 02-09 (gate) | `cab-client.test.ts` (header present/absent), `useBookingIdempotencyKey.test.ts` (stable across taps, fresh only after reset), `api.test.ts` (header not body), `FareQuoteScreen.test.tsx` (identical key across two taps; all three sentinels mapped), device walkthrough steps 12-16 with the `trip_requests` row-count delta |

---

## Wave 0 Requirements

All closed by plans 02-01 (wave 1) and 02-02 (wave 2).

- [ ] `expo-location` + `expo-crypto` installed (`npx expo install`) — **02-01 Task 1**
- [ ] Native project regenerated (`npx expo prebuild --clean` + `npx expo run:android`) so both modules autolink — **02-02 Task 1** (Pitfall 1)
- [ ] `app.config.js` `plugins` array updated with an `expo-location` entry — **02-01 Task 1**
- [ ] Bare `<MapView>` + hardcoded `<Marker>` rendered and visually confirmed on the real device — **02-02 Task 2** (Pitfall 2, Open Question 1)
- [ ] `__mocks__/react-native-maps.js` manual Jest mock for `MapView`/`Marker`/`PROVIDER_GOOGLE` — **02-01 Task 3** (Pitfall 6)
- [ ] `expo-location` mock with realistic granted-path defaults, overridable per test — **02-01 Task 2** (Pitfall 4)
- [ ] `expo-crypto` mock (counter-based, distinct per call) — **02-01 Task 2** (Pitfall 5)
- [ ] `EXPO_PUBLIC_CAB_API_BASE_URL` added to `.env`, `.env.example`, and `jest.setup.js` — **02-01 Task 1** (Open Question 2)
- [ ] `src/api/cab-client.ts` + `CabApiError` reading `{error, message}` with no 401/clearSession handling — **02-03 Task 1** (Pitfall 3)

*Wave 0 is unusually large relative to Phase 1's — this phase introduces two new native dependencies and one new backend service, none of which Phase 1 touched.*

---

## Manual-Only Verifications

| Behavior | Requirement | Where | Why Manual | Test Instructions |
|----------|-------------|-------|------------|-------------------|
| `react-native-maps` renders correctly under RN 0.86.2's New Architecture | RIDE-01 (blocks all map UI) | **02-02 Task 2** | No empirical confirmation exists anywhere in this codebase; a stale-vs-current library compatibility conflict makes this a real risk, not a formality. A Fabric view-registration failure renders a screen rather than throwing, so no automated check can see it. | Render the bare `<MapView>` + `<Marker>` smoke screen on the real Android device before any tap-to-pin logic exists. Confirm an actual Google Map, not a pink "Unimplemented component" screen or a blank view. Also confirm the on-screen readout shows a real UUID from `expo-crypto` and a real `granted`/`denied` status from `expo-location`. |
| Full fare-estimate → book flow on a real Android build against both real backends | RIDE-01, RIDE-02 | **02-09 Task 2** | GPS permission behaviour, real map gestures, the live `expires_at` countdown, and — decisively — the no-duplicate-trip guarantee under a genuine fast double-tap all live outside what mocked tests can assert. RIDE-02's claim is a statement about rows in the backend database. | Build via `npx expo run:android` on the physical device (Phase 1's Wi-Fi/LAN-IP pattern). Walk: Book a ride → set pickup (confirm GPS default and pan/zoom persistence) → set dropoff → itemized fare + ticking countdown → background for a minute and confirm the countdown corrected → let it expire and confirm "Get new estimate" appears with no silent refetch → re-quote → book once and confirm "Ride requested!" → then book a fresh ride and rapidly double/triple-tap "Book this ride". Compare the `trip_requests` row count against the baseline captured in 02-09 Task 1: the delta must be exactly 2. Optionally repeat with Wi-Fi toggled off mid-book to prove the retry reuses the same key. |

---

## Validation Sign-Off

- [ ] All tasks have an `<automated>` verify or an explicit human gate with an automated companion
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter
- [x] Every row's `TBD` plan/wave placeholder replaced with a real plan and wave assignment

**Approval:** pending — plans written 2026-08-12 (9 plans, 9 sequential waves); ticked off during execution, signed off in 02-09 Task 3.
