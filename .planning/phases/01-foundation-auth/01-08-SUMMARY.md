---
phase: 01-foundation-auth
plan: 08
subsystem: infra
tags: [expo-run-android, google-maps, android-manifest, real-device-verification]

# Dependency graph
requires:
  - phase: 01-foundation-auth (plan 01-01 through 01-07)
    provides: full AUTH-01..06 implementation and 72-test suite baseline
provides:
  - Verified local Android build (npx expo run:android) on a physical device
  - Registered Maps API key restriction for com.goride.rider
  - Corrected physical-device networking pattern (Wi-Fi LAN IP, not adb reverse)
affects: [Phase 2 (Fare Estimate & Booking), Phase 3 (Realtime Trip Tracking — Maps key now provably resolves)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Physical-device networking: EXPO_PUBLIC_API_BASE_URL set to the laptop's Wi-Fi LAN IP (e.g. http://192.168.100.136:8080/api/v1), not 10.0.2.2 (emulator-only) and not adb-reverse'd localhost — the device was tested over Wi-Fi, not USB tether, so LAN IP was the correct choice here. Both localhost+adb-reverse and LAN-IP approaches work for a USB-attached device; LAN IP additionally works wirelessly."
    - "expo run:android's own port-detection: if something is already answering on 8081 (any HTTP service, not just Metro), the CLI assumes Metro is already running there and skips starting its own bundler. Any backend/service occupying 8081 must be identified and Metro started explicitly on a free port (npx expo start --port <N> --dev-client) with the dev client pointed at it manually."

key-files:
  created: []
  modified:
    - .env (EXPO_PUBLIC_API_BASE_URL changed from http://10.0.2.2:8080/api/v1 to the LAN IP)

key-decisions:
  - "AUTH-06 (session-expiry banner) verified via its existing automated fake-timer component test only, not a live real-time wait — user explicitly waived the live timing check since the banner's logic is already covered by a passing unit test from plan 01-05"
  - "Physical device (Samsung Galaxy S21, USB-attached but tested over Wi-Fi) used as the verification target, not an AVD — no emulator/system-image was ever installed on this machine"

requirements-completed: [AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05]

# Metrics
duration: ~35min (including a first-ever 7m21s native build and a port-conflict debug detour)
completed: 2026-08-12
---

# Phase 01 Plan 08: Phase Gate — Real Device Verification & Maps Key Registration Summary

**Closed out Phase 1 against reality: automated gate green, native Android project built and installed on a physical device over Wi-Fi, Maps API key resolved into the manifest and registered in Google Cloud Console, and all AUTH-01..05 flows walked live by the user on a real build against the real backend.**

## Performance

- **Started:** 2026-08-12 (continuation from 01-07)
- **Completed:** 2026-08-12
- **Tasks:** 3 (automated gate, human SHA-1 registration checkpoint, human end-to-end walkthrough checkpoint) — all closed

## Accomplishments

- **Automated gate:** `npx tsc --noEmit` and `npm test` both green — 72 tests across 13 suites, no regressions since 01-07
- **First-ever native build:** `npx expo run:android` succeeded (7m21s, 473 tasks, 384 executed / 89 cached) and installed `com.goride.rider` onto a physical Samsung Galaxy S21
- **Maps key verified end-to-end:** `AndroidManifest.xml` carries a real `AIza...` value under `com.google.android.geo.API_KEY` — the `.env` → `app.config.js` → config-plugin → manifest path works on a local debug build
- **Debug keystore SHA-1 extracted and registered:** `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25` added to the shared Maps API key's Android-app restrictions alongside `com.goride.rider`, without disturbing the existing `com.goride.driver` entry
- **Live walkthrough on real hardware, all confirmed working:**
  - AUTH-01 (sign up) — new rider row confirmed directly in Postgres (`account_status: active`)
  - AUTH-02 (session persistence) — app force-quit and reopened, still logged in
  - AUTH-03 (view/edit profile) — name edit persisted and reflected on reload
  - AUTH-04 (logout) — returns cleanly to the Login screen
  - AUTH-05 (change password) — old→new password flow confirmed, re-login with new password implied working
  - AUTH-06 — **not live-tested**; relies on the existing automated fake-timer `SessionExpiryBanner` test from plan 01-05, per explicit user decision to skip the real-time wait

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Plan's `EXPO_PUBLIC_API_BASE_URL` guidance assumed USB + adb-reverse; actual setup used Wi-Fi + LAN IP**
- **Found during:** Task 1/3 device networking setup
- **Issue:** `.env` initially held `http://10.0.2.2:8080/api/v1` (emulator-only alias). Plan's fallback for a physical device was `adb reverse tcp:8080 tcp:8080` + `localhost`. User instead chose to test over Wi-Fi (device not staying USB-tethered), which needed the laptop's actual LAN IP instead.
- **Fix:** Set `EXPO_PUBLIC_API_BASE_URL=http://192.168.100.136:8080/api/v1` (laptop's `en0` Wi-Fi IP). Confirmed backend listens on `*:8080` (all interfaces), so LAN access works.
- **Files modified:** `.env`
- **Verification:** Full auth flow (steps 1-9 of the plan's walkthrough) worked live over this connection.

**2. [Rule 1 - Bug] `expo run:android` did not start its own Metro bundler — port 8081 was already occupied by a Go backend service**
- **Found during:** Task 3, first app launch — dev client landed on `DevLauncherErrorActivity` instead of the app
- **Issue:** One of the locally-running `go-ride-kafka-consumers` services was already listening on `*:8081`. Expo's CLI detected *something* answering on 8081 and assumed it was an already-running Metro instance, so it never started its own bundler. The dev client then tried to load a JS bundle from a Go HTTP server returning `404 page not found`.
- **Fix:** Started Metro explicitly on a free port: `npx expo start --port 8090 --dev-client`. Guided user to use the dev client's "Fetch development servers" / "Enter URL manually" (`192.168.100.136:8090`) to connect. Confirmed via `curl http://localhost:8090/status` → `packager-status:running`.
- **Files modified:** none (runtime-only; no code change needed)
- **Verification:** App loaded past the dev-client launcher into the actual Login screen; full walkthrough proceeded normally from there.

---

**Total deviations:** 2 auto-fixed (both environment/networking, no application code changes)
**Impact on plan:** None on delivered functionality. Both are now documented patterns for any future device-testing session on this machine (see `key-files`/`tech-stack` above and `STATE.md` Decisions).

## Issues Encountered

- `node_modules/dotenv@17.4.2` prints a randomized self-promotional "tip" line (including a `vestauth.com` ad) into stdout during `.env` loading. Initially flagged as a possible prompt-injection risk; traced to `dotenv`'s own hardcoded `TIPS` array in `lib/main.js` — confirmed benign, no action needed.

## User Setup Required

- **Google Cloud Console:** Android-app restriction entry (package `com.goride.rider` + the SHA-1 above) added to the shared Maps API key by the user, confirmed saved. Completed, no longer outstanding.

## Next Phase Readiness

- Phase 1 (Foundation & Auth) is functionally complete: all 6 AUTH requirements implemented, 5 of 6 verified live on real hardware against the real backend, 1 (AUTH-06) verified via automated test only per explicit user decision.
- Maps API key path is now proven all the way to a real installed APK — Phase 3's map rendering will not hit a fresh "blank map" debugging detour for the key itself.
- Physical-device-over-Wi-Fi networking pattern (LAN IP, explicit Metro port) is now the established pattern for this machine — reuse directly in Phase 2/3 device testing instead of re-deriving.

---
*Phase: 01-foundation-auth*
*Completed: 2026-08-12*
