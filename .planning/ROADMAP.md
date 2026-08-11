# Roadmap: go-ride-user-app

## Overview

Four phases deliver one reliable rider journey end-to-end: create an account and stay in it (Foundation & Auth), get a trustworthy fare quote and book against it exactly once (Fare Estimate & Booking), watch that trip through dispatch and live tracking without ever losing state — including cancelling it — even through a dropped WebSocket (Realtime Trip Tracking), and see it through to a plain-language completion with cash-collection status (Trip Lifecycle & Completion). The phase count is deliberately thin relative to the sibling `go-ride-driver-app` (6 phases) because this app has no vehicle/KYC-equivalent onboarding — the four phases map directly onto the four natural requirement clusters (AUTH, RIDE, TRACK, LIFECYCLE) and their real dependency chain: auth unlocks booking, booking creates the trip that Realtime Tracking's rank-guarded reducer watches over, and Trip Lifecycle is presentation built on that reducer once it's proven correct.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation & Auth** - Rider can sign up, log in, manage their profile, and never get silently logged out mid-trip
- [ ] **Phase 2: Fare Estimate & Booking** - Rider can get a fare quote and book a cab against it exactly once
- [ ] **Phase 3: Realtime Trip Tracking** - Rider always has an accurate live view of a pending/active trip — including cancelling it — through WebSocket drops and reconnects
- [ ] **Phase 4: Trip Lifecycle & Completion** - Rider sees the trip through start, final fare, and cash-collection completion in plain language

## Phase Details

### Phase 1: Foundation & Auth
**Goal**: Rider can create an account, securely stay logged in, manage their profile, and is warned before a session lapse rather than silently kicked out — with project scaffolding, shared theme/components, test tooling, and the Google Maps key all verified against a real local Android debug build (`npx expo run:android`; this project does not use EAS — see 01-RESEARCH.md Pitfall 3) before later phases depend on them.
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06
**Success Criteria** (what must be TRUE):
  1. Rider can sign up with email + password and lands in the authenticated app
  2. Rider can log in and remains logged in after closing and reopening the app (session persisted via secure storage)
  3. Rider can view and edit their profile (first/last name) and change their password
  4. Rider can log out from the app
  5. Rider sees a proactive warning before their session/JWT expires, rather than being silently force-logged-out (most critical while a trip is being tracked)
**Plans**: 8 plans across 8 waves (sequential — each builds on the previous; 01-01 + 01-02 are the Wave 0 infrastructure that must complete before any feature-logic plan)

Plans:
- [ ] 01-01-PLAN.md — Expo SDK 57 scaffold, locked dependency set, app.config.js with resolved Google Maps key (package com.goride.rider)
- [ ] 01-02-PLAN.md — Jest + RNTL install/config, test-utils, rider API type contracts, theme + UI primitives copied from go-ride-driver-app
- [ ] 01-03-PLAN.md — JWT expiry decoder, secure token storage, Zustand session store, apiRequest with centralized 401 handling, three typed rider clients
- [ ] 01-04-PLAN.md — Auth zod schemas, login/signup mutations (signup→login chain), forms, (auth) route group
- [ ] 01-05-PLAN.md — SessionExpiryBanner (AUTH-06), root hydration gate + Stack.Protected guard, Home + Profile tabs, Home placeholder
- [ ] 01-06-PLAN.md — Profile query/mutation, AccountStatusBadge (2-value), ProfileView, EditProfileForm, logout, profile routes
- [ ] 01-07-PLAN.md — changePasswordSchema, useChangePasswordMutation, ChangePasswordForm + route
- [ ] 01-08-PLAN.md — Phase gate: full suite + prebuild + manifest key check, debug SHA-1 registration (checkpoint), end-to-end verification on a real Android build (checkpoint)

### Phase 2: Fare Estimate & Booking
**Goal**: Rider can get a trustworthy fare quote and book a cab against it exactly once, with no duplicate-booking risk from retries or double-taps.
**Depends on**: Phase 1
**Requirements**: RIDE-01, RIDE-02
**Success Criteria** (what must be TRUE):
  1. Rider can select pickup/dropoff and receive a fare estimate with an itemized breakdown
  2. Rider sees a visible countdown against the quote's expiry, and booking against an expired quote is never silently accepted
  3. Rider can book a cab against the quote, and repeated taps or network retries of the same intent never create a duplicate trip
**Plans**: TBD

### Phase 3: Realtime Trip Tracking
**Goal**: While a trip request is pending or active, the rider always has an accurate, real-time view of trip status — and can cancel it at any point — even through a dropped or missed WebSocket connection, cold start, or reconnect.
**Depends on**: Phase 2
**Requirements**: RIDE-03, TRACK-01, TRACK-02, TRACK-03, TRACK-04, TRACK-05, TRACK-06
**Success Criteria** (what must be TRUE):
  1. Rider sees a "finding driver" state that tolerates silent dispatch retries with escalating long-wait messaging, and can cancel the request at any time from an always-reachable affordance
  2. Rider sees the assigned driver revealed (name/vehicle/plate) and appearing on the map once matched
  3. Rider sees the driver's live location update on the map throughout the active trip, routed through a single rank-guarded trip-state reducer so no source (HTTP, WS, poll) ever conflicts or causes flicker
  4. Rider's trip state is correctly reconciled via `/current-trip` polling on every WebSocket reconnect, app-foreground transition, and cold start
  5. Rider sees any trip cancellation — rider-initiated, driver-initiated, or system — reflected immediately and consistently, without flicker or duplicate notices
**Plans**: TBD

### Phase 4: Trip Lifecycle & Completion
**Goal**: Rider sees the trip through from pickup to cash-payment completion, in plain language built on top of Phase 3's already-proven trip-state reducer.
**Depends on**: Phase 3
**Requirements**: LIFECYCLE-01, LIFECYCLE-02, LIFECYCLE-03
**Success Criteria** (what must be TRUE):
  1. Rider sees trip start reflected as a plain-language status label, not a raw backend enum
  2. Rider sees the final fare once the trip ends
  3. Rider sees cash-collection status and trip completion on a screen that clearly separates "amount due" from "payment confirmed" (rider observes only; driver confirms collection)
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Auth | 0/8 | Not started | - |
| 2. Fare Estimate & Booking | 0/TBD | Not started | - |
| 3. Realtime Trip Tracking | 0/TBD | Not started | - |
| 4. Trip Lifecycle & Completion | 0/TBD | Not started | - |
