import { makeJwt } from './auth-fixtures';

describe('makeJwt', () => {
  it('encodes exp as a decodable base64url JSON payload', () => {
    const expiresAt = 1800000000000;
    const token = makeJwt(expiresAt);
    const [, payload] = token.split('.');
    const json = JSON.parse(
      Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'),
    ) as { exp: number };
    expect(json.exp).toBe(Math.floor(expiresAt / 1000));
  });
});
