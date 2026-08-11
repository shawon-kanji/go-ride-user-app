# go-ride-user-app

## What This Is

An Android-first (for now) Expo/React Native app for **riders** on the go-ride ride-hailing platform. A rider signs up, gets a fare estimate, books a cab against that quote, watches it get assigned and tracked live on a map, rides through to completion, and confirms cash payment (driver-confirmed, rider only observes) — reliably, end-to-end. Built in parallel with the sibling driver app (`go-ride-driver-app`, a separate git repo, already mid-build) against the same backend, and deliberately mirrors that app's tech stack and conventions rather than re-evaluating alternatives.

## Core Value

A rider can reliably book and complete one cash trip end-to-end, without losing track of their trip state even through a dropped WebSocket connection or a silently-retried dispatch.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Rider can sign up and log in with email + password
- [ ] Rider can view and edit their profile, and change their password
- [ ] Rider can get a fare estimate and book a cab against it (idempotent)
- [ ] Rider can cancel a pending or ongoing trip request
- [ ] Rider sees a "finding driver" state that tolerates silent dispatch retries, then sees the assigned driver on a map
- [ ] While a trip is active, the rider sees the driver's live location on the map
- [ ] Rider recovers trip state via polling if the WebSocket connection was missed or dropped
- [ ] Rider sees trip cancellation reflected immediately, however it was triggered
- [ ] Rider sees trip start, final fare on trip end, and cash-collection completion

### Out of Scope

- Ratings/reviews — no backend model or endpoint exists anywhere in the platform
- Rider ride-history — no GET endpoint exposes it, even though a `trip_history` table exists in the DB
- In-app payment gateway — MVP is cash, driver-confirmed, matching how the backend already works
- Promo/coupon codes — `discount_total` column exists on trip fares but nothing populates it
- Push notifications for riders — WebSocket-only for now
- Dynamic surge pricing display — hardcoded to 1.0 server-side, no UI for it
- Account deactivation — `POST /api/v1/deactivate` exists on the backend but is destructive/low-frequency; deserves its own confirm-UX pass rather than a rushed v1 add
- Phone number + OTP auth — email+password matches the existing backend exactly

## Context

- Sibling repos (checked out alongside this one): `go-ride-backend` (Gin + GORM + Postgres — rider/driver auth, JWT), `go-ride-kafka-consumers` (Kafka-driven microservices: `cab-request-handler`, `trip-dispatch-worker`, `websocket-gateway`, `location-producers`, `location-consumers`), `go-ride-db-schema` (owns the DB schema), and the sibling driver app `go-ride-driver-app` (Expo/React Native, already mid-build — Phase 1 done, Phase 01.1 KYC-upload in progress).
- Full backend/realtime API contracts (auth, cab-request-handler, `/ws/rider`) were verified directly against source during this project's initialization (2026-08-11) — no OpenAPI/Postman spec exists anywhere, so TypeScript API types in this app are hand-maintained mirrors of the Go DTOs, not codegenned.
- **Verified correction to initial briefing**: `GET /api/v1/me` and `PATCH /api/v1/profile` both wrap their response as `{"user": {...}}`, not a bare `UserResponse` object — easy to get wrong in client-side typing if assumed bare.
- **Verified correction to initial briefing**: `websocket-gateway` pushes a `trip_cancelled` message to the rider unconditionally on every ride-cancellation event (rider-initiated or system/driver-initiated) — this event exists and must be handled; it was missing from the original briefing's rider push-event list.
- **JWT audience alignment confirmed correct** (2026-08-11): rider tokens issue `aud=go-ride-clients`; `websocket-gateway`'s rider route validates against the same value (`JWTRiderAudience` config, default `go-ride-clients`). No mismatch exists — this was cross-checked while also correcting a stale mismatch note that had been carried in the driver app's own docs.
- Three separate Go services, no unified API gateway/BFF — this app talks to all three directly: `go-ride-backend` (auth/profile), `cab-request-handler` (booking), `websocket-gateway` (realtime).
- No refresh-token endpoint exists for riders (same as drivers) — a 401 means full re-login; UX should include a proactive session-expiry warning rather than expecting a backend fix.
- Rider WebSocket connection (`GET /api/v1/ws/rider?token=...&device_id=...`) is push-only — no ack protocol from the rider, unlike the driver side's job-offer accept flow. `GET /current-trip?rider_id=...` is the polling-based recovery path for a missed/dropped WS connection, not the primary update mechanism.
- Design system is shared with `go-ride-driver-app`: its `src/theme/*` token files and generic `src/components/` primitives (Button, Card, Badge, TextInput, Select, Stepper, Banner, ConfirmDialog, EmptyState) are copied verbatim as a starting point — both apps' visual identity is a placeholder pending a later joint "bold/vibrant, Bolt/Grab-esque" brand pass. No shared monorepo package between the two separate git repos yet; that's deferred until the joint brand pass happens.

## Constraints

- **Tech stack**: Expo SDK 57 with a custom dev client (not Expo Go, not bare RN CLI), RN 0.86.2, React 19.2.3, TypeScript strict — chosen to mirror `go-ride-driver-app` exactly, not re-decided here.
- **Platform**: Android-first. No iOS device available; iOS work explicitly deferred (same as the driver app).
- **Auth**: Email + password only, against the existing `go-ride-backend` — no OTP/phone auth work planned.
- **Payments**: Cash-only for MVP, rider only observes collection status — no payment gateway integration in this milestone.
- **Design**: Shares `go-ride-driver-app`'s placeholder theme/components; final "bold/vibrant" brand identity is a later joint pass across both apps, not this project's problem to solve alone.
- **Testing**: Unlike the driver app (which started without tests and retrofitted Jest + React Native Testing Library mid-build during its KYC phase), this app starts with test tooling in place from Phase 1 to avoid that retrofit cost.
- **Backend is a dependency, not something this project modifies**: backend gaps found during planning (no ratings, no ride-history, no refresh token) are flagged as external constraints/follow-ups, not work items for this repo.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Mirror `go-ride-driver-app`'s tech stack exactly (Expo Router, TanStack Query + Zustand, react-hook-form + zod, NativeWind v4, hand-rolled WS client) | Both apps hit the same backend; re-deciding the stack per-app would create unnecessary drift and slow down the later shared-component/brand pass | — Pending |
| Start with Jest + React Native Testing Library from Phase 1, not retrofitted later | The driver app had to retrofit test tooling mid-build during its KYC phase — avoid repeating that cost here | — Pending |
| Android-first, iOS deferred | No iOS device available; Expo keeps the code cross-platform so this is a scheduling choice, not an architecture one | — Pending |
| Cash-only MVP, rider observes but never confirms collection | Matches how the backend already works (driver confirms collection via their own endpoint) | — Pending |
| No shared monorepo package with `go-ride-driver-app` yet | Two separate git repos; a shared package is deferred until the joint brand pass, to avoid premature coupling | — Pending |

---
*Last updated: 2026-08-11 after initialization*
