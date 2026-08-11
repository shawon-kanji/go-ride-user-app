jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));
jest.mock('../../api/profile-client', () => ({
  profileClient: { getProfile: jest.fn(), updateProfile: jest.fn(), changePassword: jest.fn() },
}));

import { renderHook } from '@testing-library/react-native';
import { router } from 'expo-router';

import { profileClient } from '../../api/profile-client';
import { tokenStorage } from '../../lib/secure-store';
import { useSessionStore } from '../../stores/session-store';
import { createQueryWrapper, createTestQueryClient } from '../../test-utils/query-wrapper';
import { makeUser } from '../../test-utils/auth-fixtures';
import { profileKeys } from './api';
import { useLogout } from './logout';

const mockRouterReplace = router.replace as jest.Mock;

beforeEach(async () => {
  mockRouterReplace.mockReset();
  (profileClient.getProfile as jest.Mock).mockReset();
  (profileClient.updateProfile as jest.Mock).mockReset();
  (profileClient.changePassword as jest.Mock).mockReset();

  await tokenStorage.set('a-real-token');
  useSessionStore.setState({
    status: 'authenticated',
    token: 'a-real-token',
    tokenExpiresAt: Date.now() + 60 * 60 * 1000,
    user: makeUser(),
    sessionExpiredReason: null,
  });
});

describe('useLogout', () => {
  it('clears the session store to unauthenticated with a null token', async () => {
    const client = createTestQueryClient();
    const { result } = await renderHook(() => useLogout(), {
      wrapper: createQueryWrapper(client),
    });

    await result.current();

    expect(useSessionStore.getState().status).toBe('unauthenticated');
    expect(useSessionStore.getState().token).toBeNull();
  });

  it('removes the token from secure storage', async () => {
    const client = createTestQueryClient();
    const { result } = await renderHook(() => useLogout(), {
      wrapper: createQueryWrapper(client),
    });

    await result.current();

    await expect(tokenStorage.get()).resolves.toBeNull();
  });

  it('clears the query cache — a value seeded under ["profile"] is gone afterward', async () => {
    const client = createTestQueryClient();
    client.setQueryData(profileKeys.detail(), { user: makeUser() });

    const { result } = await renderHook(() => useLogout(), {
      wrapper: createQueryWrapper(client),
    });

    await result.current();

    expect(client.getQueryData(profileKeys.detail())).toBeUndefined();
  });

  it('calls router.replace exactly once with "/(auth)/login"', async () => {
    const client = createTestQueryClient();
    const { result } = await renderHook(() => useLogout(), {
      wrapper: createQueryWrapper(client),
    });

    await result.current();

    expect(mockRouterReplace).toHaveBeenCalledTimes(1);
    expect(mockRouterReplace).toHaveBeenCalledWith('/(auth)/login');
  });

  it('makes no profile/online-status network call', async () => {
    const client = createTestQueryClient();
    const { result } = await renderHook(() => useLogout(), {
      wrapper: createQueryWrapper(client),
    });

    await result.current();

    expect(profileClient.getProfile).not.toHaveBeenCalled();
    expect(profileClient.updateProfile).not.toHaveBeenCalled();
    expect(profileClient.changePassword).not.toHaveBeenCalled();
  });
});
