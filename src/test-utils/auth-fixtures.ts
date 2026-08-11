import type { LoginResult, User } from '../api/types';

export const TEST_USER_ID = '22222222-2222-4222-8222-222222222222';

export function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: TEST_USER_ID,
    email: 'rider@example.com',
    first_name: 'Ada',
    last_name: 'Rider',
    account_status: 'active',
    ...overrides,
  };
}

/** Builds an unsigned JWT whose payload carries only the `exp` claim, in the exact
 *  base64url form src/lib/jwt.ts decodes. Used by session-store and
 *  SessionExpiryBanner tests to control expiry deterministically. */
export function makeJwt(expiresAtMs: number): string {
  const payload = Buffer.from(JSON.stringify({ exp: Math.floor(expiresAtMs / 1000) }))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `header.${payload}.signature`;
}

export function makeLoginResult(overrides: Partial<LoginResult> = {}): LoginResult {
  return {
    access_token: makeJwt(Date.now() + 60 * 60 * 1000),
    user: makeUser(),
    ...overrides,
  };
}
