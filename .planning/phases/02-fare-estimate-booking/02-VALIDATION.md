---
phase: 02
slug: fare-estimate-booking
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-08-12
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest `~29.7.0` + `jest-expo/android` preset + `@testing-library/react-native@^14.0.1` (unchanged from Phase 1) |
| **Config file** | `jest.config.js` (exists, unchanged) — `jest.setup.js` needs new mock additions for `expo-crypto` and a new root `__mocks__/react-native-maps.js` |
| **Quick run command** | `npx jest <path/to/file>.test.ts(x) --watchAll=false` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~30-45 seconds (growing suite) |

---

## Sampling Rate

- **After every task commit:** targeted `npx jest <relevant file(s)> --watchAll=false`
- **After every plan wave:** `npm test` (full suite)
- **Before `/gsd:verify-work`:** Full suite must be green, plus the manual real-device walkthrough below
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-W0-maps-smoke | TBD | 0 | infra (react-native-maps New Arch check) | manual on-device | Render bare `<MapView>` + hardcoded `<Marker>`, visually confirm on real device | n/a | ⬜ pending |
| 02-W0-native-deps | TBD | 0 | infra (expo-location, expo-crypto) | setup | `npx expo install expo-location expo-crypto && npx expo run:android` | ❌ W0 | ⬜ pending |
| 02-W0-mocks | TBD | 0 | infra (test mocking) | setup | `npx jest src/test-utils/smoke.test.ts --watchAll=false` (extended to cover new mocks) | ❌ W0 | ⬜ pending |
| 02-cab-client | TBD | TBD | infra (cab-request-handler client) | unit | `npx jest src/api/cab-client.test.ts --watchAll=false` | ❌ W0 | ⬜ pending |
| 02-fare-estimate-api | TBD | TBD | RIDE-01 | unit + hook | `npx jest src/features/booking/api.test.ts --watchAll=false` | ❌ W0 | ⬜ pending |
| 02-countdown | TBD | TBD | RIDE-01 | unit | `npx jest src/features/booking/hooks/useCountdown.test.ts --watchAll=false` | ❌ W0 | ⬜ pending |
| 02-fare-breakdown | TBD | TBD | RIDE-01 | component | `npx jest src/features/booking/components/FareBreakdown.test.tsx --watchAll=false` | ❌ W0 | ⬜ pending |
| 02-location-picker | TBD | TBD | RIDE-01 | component | `npx jest src/features/booking/components/LocationPickerMap.test.tsx src/features/booking/hooks/useCurrentLocation.test.ts --watchAll=false` | ❌ W0 | ⬜ pending |
| 02-idempotency | TBD | TBD | RIDE-02 | unit + hook | `npx jest src/lib/idempotency.test.ts src/features/booking/hooks/useBookingIdempotencyKey.test.ts --watchAll=false` | ❌ W0 | ⬜ pending |
| 02-request-cab-api | TBD | TBD | RIDE-02 | unit + hook | `npx jest src/features/booking/api.test.ts --watchAll=false` | ❌ W0 | ⬜ pending |
| 02-phase-gate | TBD | last | RIDE-01, RIDE-02 (gate) | typecheck+suite+manual | `npx tsc --noEmit && npm test` + manual device walkthrough | n/a | ⬜ pending |

*Task IDs are placeholders (`TBD` plan/wave) — the planner assigns real plan/wave numbers; every row must be claimed by exactly one real task ID in the resulting PLAN.md files.*

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `expo-location` + `expo-crypto` installed (`npx expo install expo-location expo-crypto`) and native project regenerated (`npx expo run:android`) — nothing in this phase can be tested end-to-end on-device until this lands (Pitfall 1)
- [ ] `app.config.js`'s `plugins` array updated with an `expo-location` entry
- [ ] Bare `<MapView>` + hardcoded `<Marker>` rendered and visually confirmed on the real device — proves `react-native-maps@1.27.2` works under RN 0.86.2's mandatory New Architecture before any screen is built on top of it (Pitfall 2, Open Question 1)
- [ ] `__mocks__/react-native-maps.js` — manual Jest mock for `MapView`/`Marker` (Pitfall 6; does not exist anywhere in this codebase or the sibling driver app)
- [ ] `jest.mock('expo-location', ...)` pattern established per-test for `requestForegroundPermissionsAsync`/`getCurrentPositionAsync` (Pitfall 4 — the preset's auto-mock silently resolves `undefined`, not realistic values)
- [ ] `jest.mock('expo-crypto', ...)` or a mocked `src/lib/idempotency.ts` wrapper established (Pitfall 5 — `expo-crypto` has NO auto-mock coverage in `jest-expo` at all)
- [ ] `EXPO_PUBLIC_CAB_API_BASE_URL` added to `.env`/`.env.example` (port 8082, same LAN-IP-for-physical-device convention as Phase 1's `01-08-SUMMARY.md`)
- [ ] `src/api/cab-client.ts` + `CabApiError` — new, parallel to `http-client.ts`, reads `{error, message}` not `{code, message}`, no 401/clearSession handling (Pitfall 3)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `react-native-maps` renders correctly under RN 0.86.2's New Architecture | RIDE-01 (blocks all map UI) | No empirical confirmation exists anywhere in this codebase; a stale-vs-current library compatibility conflict makes this a real risk, not a formality | Render a bare `<MapView>` with one hardcoded `<Marker>` on the real Android device (Wave 0, before any tap-to-pin logic). Confirm it shows an actual Google Map, not a pink "Unimplemented component" screen or a blank view. |
| Full fare-estimate → book flow on a real Android build against the real backend | RIDE-01, RIDE-02 | GPS permission behavior, real map gestures, and duplicate-booking guarantees under a real slow/retried tap can't be fully proven by mocked unit tests alone | Build via `npx expo run:android` on the physical device (reuse Phase 1's established Wi-Fi/LAN-IP pattern). Walk: tap "Book a ride" → set pickup (confirm GPS-default or manual fallback works) → set dropoff → see itemized fare + countdown ticking → let it expire once and confirm "Get new estimate" (not silent refetch) → get a fresh quote → tap "Book this ride" → confirm "Ride requested!" confirmation → check `go-ride-kafka-consumers` DB (`trip_requests` table) for exactly one row. Then repeat a booking and rapidly double-tap "Book this ride" — confirm only one `trip_requests` row exists for that quote (no duplicate). |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending — planner assigns real task IDs, plan-checker verifies coverage
