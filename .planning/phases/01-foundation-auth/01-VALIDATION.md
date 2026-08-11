---
phase: 01
slug: foundation-auth
status: draft
nyquist_compliant: false
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
| 01-01-01 | 01 | 0 | infra | setup | `npx jest --version` | ❌ W0 | ⬜ pending |
| 01-0N-0N | TBD | TBD | AUTH-01 | unit+hook | `npx jest src/features/auth/schemas.test.ts src/features/auth/api.test.ts --watchAll=false` | ❌ W0 | ⬜ pending |
| 01-0N-0N | TBD | TBD | AUTH-02 | unit+store | `npx jest src/lib/secure-store.test.ts src/stores/session-store.test.ts src/features/auth/api.test.ts --watchAll=false` | ❌ W0 | ⬜ pending |
| 01-0N-0N | TBD | TBD | AUTH-03 | unit+component | `npx jest src/features/profile --watchAll=false` | ❌ W0 | ⬜ pending |
| 01-0N-0N | TBD | TBD | AUTH-04 | unit | `npx jest src/features/profile/logout.test.ts --watchAll=false` | ❌ W0 | ⬜ pending |
| 01-0N-0N | TBD | TBD | AUTH-05 | unit+component | `npx jest src/features/profile/api.test.ts src/features/profile/components/ChangePasswordForm.test.tsx --watchAll=false` | ❌ W0 | ⬜ pending |
| 01-0N-0N | TBD | TBD | AUTH-06 | component (fake timers) | `npx jest src/features/auth/components/SessionExpiryBanner.test.tsx --watchAll=false` | ❌ W0 | ⬜ pending |
| 01-0N-0N | TBD | TBD | cross-cutting | unit | `npx jest src/api/http-client.test.ts --watchAll=false` | ❌ W0 | ⬜ pending |

*Exact Task IDs filled in once the planner assigns plan/wave numbers — the requirement→test mapping above is locked from research and must not be dropped during planning.*

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

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
