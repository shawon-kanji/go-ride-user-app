# Deferred Items

Issues discovered during plan execution that are out of scope for the current task
(pre-existing, in unrelated files) and therefore not auto-fixed.

## From 01-05 execution

- **`src/features/auth/api.test.ts`**: `npm test` prints a React "not wrapped in act(...)" console warning
  originating from a TanStack Query notifyManager timeout callback triggering a HookContainer update.
  The test suite still passes (0 failures). This file was written in an earlier plan (01-04) and is
  unrelated to 01-05's task files (SessionExpiryBanner, app shell/root layout). Left unfixed per the
  scope boundary rule — only issues directly caused by the current task's changes are auto-fixed.
