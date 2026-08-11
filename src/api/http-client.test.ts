import { makeJwt, makeUser } from '../test-utils/auth-fixtures';
import { useSessionStore } from '../stores/session-store';
import { apiRequest, ApiError } from './http-client';

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

beforeEach(() => {
  global.fetch = jest.fn();
  useSessionStore.setState({
    status: 'unknown',
    token: null,
    tokenExpiresAt: null,
    user: null,
    sessionExpiredReason: null,
  });
});

describe('apiRequest', () => {
  it('returns the parsed body of a 200 JSON response', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(jsonResponse(200, { ok: true }));

    await expect(apiRequest('/me')).resolves.toEqual({ ok: true });
  });

  it('sends an Authorization header when a token is present', async () => {
    const token = makeJwt(Date.now() + 60 * 60 * 1000);
    await useSessionStore.getState().setSession(token, makeUser());
    (global.fetch as jest.Mock).mockResolvedValueOnce(jsonResponse(200, { user: makeUser() }));

    await apiRequest('/me');

    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(init.headers.Authorization).toBe(`Bearer ${token}`);
  });

  it('sends no Authorization header when skipAuth is true, even with a token in the store', async () => {
    const token = makeJwt(Date.now() + 60 * 60 * 1000);
    await useSessionStore.getState().setSession(token, makeUser());
    (global.fetch as jest.Mock).mockResolvedValueOnce(jsonResponse(200, { access_token: token }));

    await apiRequest('/auth/login', { skipAuth: true, method: 'POST', body: {} });

    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(init.headers.Authorization).toBeUndefined();
  });

  it('clears the session on a 401 for a non-skipAuth request', async () => {
    const token = makeJwt(Date.now() + 60 * 60 * 1000);
    await useSessionStore.getState().setSession(token, makeUser());
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      jsonResponse(401, { code: 'UNAUTHORIZED', message: 'invalid token' })
    );

    await expect(apiRequest('/me')).rejects.toThrow(ApiError);

    expect(useSessionStore.getState().status).toBe('unauthenticated');
    expect(useSessionStore.getState().consumeSessionExpiredReason()).toBe(
      'Your session ended. Please log in again.'
    );
  });

  it('does not clear the session on a 401 for a skipAuth request', async () => {
    const token = makeJwt(Date.now() + 60 * 60 * 1000);
    await useSessionStore.getState().setSession(token, makeUser());
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      jsonResponse(401, { code: 'INVALID_CREDENTIALS', message: 'wrong password' })
    );

    await expect(
      apiRequest('/auth/login', { skipAuth: true, method: 'POST', body: {} })
    ).rejects.toThrow(ApiError);

    expect(useSessionStore.getState().status).toBe('authenticated');
  });

  it('throws ApiError with status/code/message from a flat error body', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      jsonResponse(400, { code: 'VALIDATION_ERROR', message: 'email is required' })
    );

    try {
      await apiRequest('/auth/signup', { skipAuth: true, method: 'POST', body: {} });
      throw new Error('expected apiRequest to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).status).toBe(400);
      expect((err as ApiError).code).toBe('VALIDATION_ERROR');
      expect((err as ApiError).message).toBe('email is required');
    }
  });

  it('throws ApiError with UNKNOWN_ERROR when the error body is unparseable', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error('not json');
      },
    } as unknown as Response);

    try {
      await apiRequest('/me');
      throw new Error('expected apiRequest to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).code).toBe('UNKNOWN_ERROR');
      expect((err as ApiError).message.length).toBeGreaterThan(0);
    }
  });

  it('appends the path to the base URL without a duplicated /api/v1', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(jsonResponse(200, { user: makeUser() }));

    await apiRequest('/me');

    const [url] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe('http://localhost:8080/api/v1/me');
  });
});
