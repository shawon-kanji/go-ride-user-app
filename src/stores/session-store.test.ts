import { makeJwt, makeUser } from '../test-utils/auth-fixtures';
import { tokenStorage } from '../lib/secure-store';
import { useSessionStore } from './session-store';

beforeEach(async () => {
  await tokenStorage.clear();
  useSessionStore.setState({
    status: 'unknown',
    token: null,
    tokenExpiresAt: null,
    user: null,
    sessionExpiredReason: null,
  });
});

describe('useSessionStore', () => {
  it('hydrate() with nothing stored ends unauthenticated', async () => {
    await useSessionStore.getState().hydrate();
    const state = useSessionStore.getState();
    expect(state.status).toBe('unauthenticated');
    expect(state.token).toBeNull();
  });

  it('hydrate() with a token expiring 30 min in the future ends authenticated', async () => {
    const expiresAtMs = Date.now() + 30 * 60 * 1000;
    const token = makeJwt(expiresAtMs);
    await tokenStorage.set(token);

    await useSessionStore.getState().hydrate();
    const state = useSessionStore.getState();
    expect(state.status).toBe('authenticated');
    expect(state.token).toBe(token);
    expect(state.tokenExpiresAt).not.toBeNull();
    expect(Math.abs((state.tokenExpiresAt as number) - expiresAtMs)).toBeLessThan(1000);
  });

  it('hydrate() with a token expired 1 min in the past ends unauthenticated and clears storage', async () => {
    const token = makeJwt(Date.now() - 60 * 1000);
    await tokenStorage.set(token);

    await useSessionStore.getState().hydrate();
    const state = useSessionStore.getState();
    expect(state.status).toBe('unauthenticated');
    expect(state.token).toBeNull();
    await expect(tokenStorage.get()).resolves.toBeNull();
  });

  it('hydrate() with a garbage token ends unauthenticated and clears storage', async () => {
    await tokenStorage.set('not-a-jwt');

    await useSessionStore.getState().hydrate();
    const state = useSessionStore.getState();
    expect(state.status).toBe('unauthenticated');
    await expect(tokenStorage.get()).resolves.toBeNull();
  });

  it('setSession() persists the token and sets authenticated state', async () => {
    const token = makeJwt(Date.now() + 60 * 60 * 1000);
    const user = makeUser();

    await useSessionStore.getState().setSession(token, user);

    await expect(tokenStorage.get()).resolves.toBe(token);
    const state = useSessionStore.getState();
    expect(state.status).toBe('authenticated');
    expect(state.user).toEqual(user);
    expect(state.sessionExpiredReason).toBeNull();
  });

  it('clearSession() clears storage and state, and the reason is consumed exactly once', async () => {
    const token = makeJwt(Date.now() + 60 * 60 * 1000);
    await useSessionStore.getState().setSession(token, makeUser());

    await useSessionStore.getState().clearSession('Your session ended. Please log in again.');

    await expect(tokenStorage.get()).resolves.toBeNull();
    const state = useSessionStore.getState();
    expect(state.status).toBe('unauthenticated');
    expect(state.user).toBeNull();

    expect(useSessionStore.getState().consumeSessionExpiredReason()).toBe(
      'Your session ended. Please log in again.'
    );
    expect(useSessionStore.getState().consumeSessionExpiredReason()).toBeNull();
  });
});
