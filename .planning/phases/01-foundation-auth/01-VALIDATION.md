---
phase: 01
slug: foundation-auth
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-08-11
---

# Phase 01 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest `~29.7.0` + `jest-expo/android` preset + `@testing-library/react-native@^14.0.1` |
| **Config file** | `jest.config.js` — does not exist yet (Wave 0, from-scratch repo) |
| **Quick run command** | `npx jest <path/to/file>.test.ts(x) --watchAll=false` |
| **Full suite command** | `npm test` (maps to `jest --watchAll=false`, matching driver app's `package.json` script) |
| **Estimated runtime** | ~15-30 seconds |

---

## Sampling Rate

- **After every task commit:** targeted `npx jest <relevant file(s)> --watchAll=false`
- **After every plan wave:** `npm test` (full suite)
- **Before `/gsd:verify-work`:** Full suite must be green, plus the manual local-build verification pass below
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-T1/T2 | 01 | 1 | infra (scaffold) | setup | `npx expo config --json` | n/a | ⬜ pending |
| 01-02-T1 | 02 | 2 | infra (test tooling) | setup | `npx jest src/test-utils/smoke.test.ts --watchAll=false` | ❌ W0 | ⬜ pending |
| 01-02-T2/T3 | 02 | 2 | infra (theme/components/fixtures/types) | typecheck+unit | `npx tsc --noEmit && npm test` | ❌ W0 | ⬜ pending |
| 01-03-T1 | 03 | 3 | AUTH-02 | unit+store | `npx jest src/lib/secure-store.test.ts src/stores/session-store.test.ts --watchAll=false` | ❌ W0 | ⬜ pending |
| 01-03-T2 | 03 | 3 | cross-cutting (401) | unit | `npx jest src/api/http-client.test.ts --watchAll=false` | ❌ W0 | ⬜ pending |
| 01-04-T1 | 04 | 4 | AUTH-01 | unit | `npx jest src/features/auth/schemas.test.ts --watchAll=false` | ❌ W0 | ⬜ pending |
| 01-04-T2 | 04 | 4 | AUTH-01, AUTH-02 | hook | `npx jest src/features/auth/api.test.ts --watchAll=false` | ❌ W0 | ⬜ pending |
| 01-04-T3 | 04 | 4 | AUTH-01, AUTH-02 | typecheck+suite | `npx tsc --noEmit && npx jest src/features/auth --watchAll=false` | ❌ W0 | ⬜ pending |
| 01-05-T1 | 05 | 5 | AUTH-06 | component (fake timers) | `npx jest src/features/auth/components/SessionExpiryBanner.test.tsx --watchAll=false` | ❌ W0 | ⬜ pending |
| 01-05-T2 | 05 | 5 | AUTH-02 (shell) | typecheck+suite | `npx tsc --noEmit && npm test` | ❌ W0 | ⬜ pending |
| 01-06-T1 | 06 | 6 | AUTH-03 | hook | `npx jest src/features/profile/api.test.ts --watchAll=false` | ❌ W0 | ⬜ pending |
| 01-06-T2 | 06 | 6 | AUTH-03 | component | `npx jest src/features/profile --watchAll=false` | ❌ W0 | ⬜ pending |
| 01-06-T3 | 06 | 6 | AUTH-04 | unit | `npx jest src/features/profile/logout.test.ts --watchAll=false` | ❌ W0 | ⬜ pending |
| 01-07-T1 | 07 | 7 | AUTH-05 | unit+hook | `npx jest src/features/profile/api.test.ts --watchAll=false` | ❌ W0 | ⬜ pending |
| 01-07-T2 | 07 | 7 | AUTH-05 | component | `npx jest src/features/profile/api.test.ts src/features/profile/components/ChangePasswordForm.test.tsx --watchAll=false` | ❌ W0 | ⬜ pending |
| 01-08-T1 | 08 | 8 | AUTH-01..06 (gate) | typecheck+suite+manifest | `npx tsc --noEmit && npm test && grep -A1 "com.google.android.geo.API_KEY" android/app/src/main/AndroidManifest.xml` | ❌ W0 | ⬜ pending |
| 01-08-T2 | 08 | 8 | maps key (human) | manual | Google Cloud Console — no gcloud CLI on this machine | n/a | ⬜ pending |
| 01-08-T3 | 08 | 8 | AUTH-01..06 | manual on device | `npx expo run:android` + 10-step flow; `adb shell pm list packages \| grep com.goride.rider` | n/a | ⬜ pending |

**Wave 0 mapping:** this phase's "Wave 0" (project scaffold + Jest/RNTL + test-utils + theme/components) is delivered by plans 01-01 (execution wave 1) and 01-02 (execution wave 2). No feature-logic plan runs before both are green.

*Task IDs assigned during planning on 2026-08-11. Every row of the original requirement→test mapping is preserved and claimed by exactly one task.*

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `package.json` + `jest.config.js` + `babel.config.js` — none exist yet, repo is currently empty (only `.git`, `AGENTS.md`, `BRIEFING.md`, `.planning/`)
- [ ] `src/test-utils/query-wrapper.tsx` — `createTestQueryClient()`/`createQueryWrapper()`, copy pattern from `go-ride-driver-app`
- [ ] `src/test-utils/auth-fixtures.ts` — `makeUser()`, `makeLoginResult()`, etc. (rider-shaped, new — no direct driver-app equivalent since driver fixtures are KYC-shaped)
- [ ] Framework install: `npx expo install jest-expo jest --dev && npm install -D @react-native/jest-preset@^0.86.2 @testing-library/react-native@^14.0.1 test-renderer@^1.2.0 @types/jest`
- [ ] `expo-secure-store` mock — verify `jest-expo/android` mocks it automatically, confirm with one trivial passing test before relying on it across the session-store test suite

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Full auth/profile flow on a real Android build | AUTH-01..06 | Session persistence across app restart, secure-storage round-trip, and the session-expiry banner's real timing can't be fully proven by mocked unit tests alone | Build via `npx expo run:android` (local, no EAS) on a physical device over USB debugging or a freshly installed AVD (none currently installed on this machine — `sdkmanager`/`avdmanager` setup is a prerequisite if no physical device is available). Sign up → confirm landed in authenticated app → close and reopen the app → confirm still logged in → view/edit profile → change password → log out → confirm returned to login. |
| Google Maps API key resolves under a local debug build | (supports later Phase 3, folded in now since cheap) | `androidGoogleMapsApiKey` in `app.json` doesn't resolve `process.env.X` (static JSON) — needs verification the key is actually wired correctly before Phase 3 depends on it | Register the local debug keystore's SHA-1 (`keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android` or `./gradlew signingReport`) in Google Cloud Console against the existing Maps API key; confirm the manifest/config actually carries the key value through to the built APK (does not require rendering a `<MapView>` yet — that's Phase 3). |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-08-11 (gsd-plan-checker VERIFICATION PASSED)
