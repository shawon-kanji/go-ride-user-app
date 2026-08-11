---
phase: 01-foundation-auth
plan: 01
subsystem: infra
tags: [expo, expo-router, react-native, nativewind, tailwind, google-maps, dotenv]

# Dependency graph
requires: []
provides:
  - Runnable Expo SDK 57 project scaffold (package.json, node_modules) mirroring go-ride-driver-app's locked dependency versions
  - app.config.js with dotenv-resolved Google Maps API key wired into react-native-maps config plugin
  - Android package name locked to com.goride.rider (iOS bundleIdentifier matches)
  - NativeWind v4 / Tailwind v3 metro + babel + tailwind config, sourcing src/global.css and src/theme/colors.js (colors.js itself arrives in plan 01-02)
  - .env / .env.example convention with GOOGLE_MAPS_API_KEY and EXPO_PUBLIC_API_BASE_URL
affects: [01-02, 01-03, 01-04, 01-05, 01-06, 01-07, 01-08, phase-02, phase-03, phase-04]

# Tech tracking
tech-stack:
  added: [expo@~57.0.9, expo-router@~57.0.9, expo-secure-store@~57.0.1, nativewind@^4.2.6, react-native-maps@1.27.2, zustand@^5.0.14, "@tanstack/react-query@^5.101.4", react-hook-form@^7.84.0, zod@^4.4.3, dotenv@^17.2.1]
  patterns:
    - "app.config.js (JS-evaluated) instead of app.json for env-var resolution at config/prebuild time"
    - "Config-plugin array form for react-native-maps: ['react-native-maps', { androidGoogleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY }]"

key-files:
  created: [package.json, .npmrc, .gitignore, assets/icon.png, assets/splash-icon.png, assets/favicon.png, assets/android-icon-foreground.png, assets/android-icon-background.png, assets/android-icon-monochrome.png, app.config.js, .env, .env.example, babel.config.js, metro.config.js, tailwind.config.js, tsconfig.json, eslint.config.js, nativewind-env.d.ts, src/global.css]
  modified: []

key-decisions:
  - "Android package name / bundle identifier locked to com.goride.rider (matches driver app's com.goride.driver naming convention); this exact string is what plan 01-08 registers as the API-key Android-app restriction in Google Cloud Console."
  - "Maps key resolved via app.config.js + dotenv, not app.json — static JSON cannot evaluate process.env.X, which would leak the literal string 'process.env.GOOGLE_MAPS_API_KEY' into AndroidManifest.xml. No app.json exists in this repo."
  - "npx expo install --check reported all pinned versions already aligned with the SDK 57 manifest — zero corrections needed, so the driver app's locked version set carries over unchanged."

patterns-established:
  - "New Expo dependencies are hand-pinned in package.json to match go-ride-driver-app's locked versions rather than using create-expo-app or accepting expo install's suggestions blindly."
  - ".env stores the real secret (gitignored); .env.example documents the same keys with placeholders and is committed."

requirements-completed: [AUTH-02]

# Metrics
duration: 4min
completed: 2026-08-11
---

# Phase 01 Plan 01: Expo Scaffold + Maps Config Summary

**Hand-pinned Expo SDK 57 scaffold mirroring go-ride-driver-app's dependency set, with app.config.js resolving a real Google Maps API key via dotenv into the react-native-maps config plugin (android.package locked to com.goride.rider).**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-08-11T19:20:07+08:00
- **Completed:** 2026-08-11T19:23:53+08:00
- **Tasks:** 2
- **Files modified:** 19 (10 in Task 1, 9 in Task 2)

## Accomplishments
- Empty repo turned into a runnable Expo SDK 57 project: `npm install` succeeded, all locked dependencies (`expo`, `expo-router`, `expo-secure-store`, `react-native-maps`, `nativewind`, `zustand`, etc.) resolve from `node_modules`, and `npx expo install --check` reported no drift from the pinned versions.
- `app.config.js` (no `app.json`) genuinely evaluates `process.env.GOOGLE_MAPS_API_KEY` via `dotenv` at config time — verified live: `npx expo config --json` resolves `android.package === "com.goride.rider"` and the `react-native-maps` plugin's `androidGoogleMapsApiKey` is a literal `AIza...` string (39 chars), not the unresolved string `"process.env.GOOGLE_MAPS_API_KEY"`.
- NativeWind v4 + Tailwind v3 wiring in place (`babel.config.js`, `metro.config.js` with `input: './src/global.css'`, `tailwind.config.js` sourcing `./src/theme/colors.js` which plan 01-02 will create) and `src/global.css` added as the Tailwind directives entrypoint.
- `.env` seeded with the same real Maps API key the driver app uses (read from its `.env` under `MAP_API_KEY`, written here as `GOOGLE_MAPS_API_KEY`); confirmed gitignored (`git status --porcelain` never listed it). `.env.example` committed with placeholders.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create package.json with driver-app-locked versions and install dependencies** - `c8dd465` (feat)
2. **Task 2: Write build/native config — app.config.js with resolved Maps key, babel, metro, tailwind, tsconfig, env files** - `72eaf4e` (feat)

**Plan metadata:** _(pending — see final commit after this summary)_

## Files Created/Modified
- `package.json` - Expo SDK 57 dependency set (react 19.2.3, react-native 0.86.2 locked), `main: expo-router/entry`, no test tooling (deferred to 01-02)
- `.npmrc` - `legacy-peer-deps=true` for the RN 0.86 / React 19 peer graph
- `.gitignore` - copied verbatim from driver app (ignores `node_modules/`, `.expo/`, `/android`, `/ios`, `.env`, allows `.env.example`)
- `assets/*.png` (6 files) - placeholder icons copied from driver app, branding deferred per `01-CONTEXT.md`
- `app.config.js` - JS-evaluated Expo config; `require('dotenv').config()` at top; `android.package`/`ios.bundleIdentifier` = `com.goride.rider`; `react-native-maps` plugin entry with `androidGoogleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY`
- `.env` (gitignored) - real `GOOGLE_MAPS_API_KEY` (shared with driver app) + `EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:8080/api/v1`
- `.env.example` (committed) - placeholder values, documents the emulator-vs-device API base URL distinction
- `babel.config.js`, `metro.config.js`, `tailwind.config.js`, `tsconfig.json`, `eslint.config.js`, `nativewind-env.d.ts` - copied verbatim from driver app
- `src/global.css` - `@tailwind base/components/utilities` directives, NativeWind's metro transform entrypoint

## Decisions Made
- Android package name locked to `com.goride.rider` (per plan's pre-made decision, matching driver app's `com.goride.driver` convention) — this exact string must be used in Google Cloud Console's API-key restriction in plan 01-08.
- Maps key mechanism locked to `app.config.js` + `dotenv`, not `app.json` — verified working end-to-end via `npx expo config --json`, not deferred.
- No version corrections applied: `npx expo install --check` returned "Dependencies are up to date", confirming the driver app's locked version set is directly reusable without adjustment.

## Deviations from Plan

None - plan executed exactly as written. All acceptance criteria and automated verification commands in both tasks passed on first attempt.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required. (The Google Maps API key used here is the same key already provisioned for go-ride-driver-app; Google Cloud Console restriction registration for `com.goride.rider` specifically is deferred to plan 01-08 per the phase plan.)

## Next Phase Readiness
- Project installs, and `npx expo config --json` resolves cleanly — later plans in this phase (01-02 through 01-08) and all subsequent phases can build on a working Expo project.
- Zero test tooling installed yet, by design — plan 01-02 owns Jest/RNTL installation, keeping its Wave 0 install commands verbatim-executable per `01-VALIDATION.md`.
- `tailwind.config.js` currently requires `./src/theme/colors.js`, which does not yet exist; this is expected and will be created by plan 01-02. Running Tailwind/NativeWind builds before 01-02 completes will fail on that missing file — not a blocker for this plan's own verification, which never triggers a Tailwind build.
- No native `android/` or `ios/` directories exist yet (not prebuilt) — expected, since this plan only sets up JS-level config; a native build (`npx expo run:android`) is not part of this plan's scope.

---
*Phase: 01-foundation-auth*
*Completed: 2026-08-11*

## Self-Check: PASSED

All 20 claimed files found on disk; both task commits (`c8dd465`, `72eaf4e`) found in git log.
