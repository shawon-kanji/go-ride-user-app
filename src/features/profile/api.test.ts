jest.mock('../../api/profile-client', () => ({
  profileClient: { getProfile: jest.fn(), updateProfile: jest.fn(), changePassword: jest.fn() },
}));

import { act, renderHook, waitFor } from '@testing-library/react-native';

import { ApiError } from '../../api/http-client';
import { profileClient } from '../../api/profile-client';
import { useSessionStore } from '../../stores/session-store';
import { createQueryWrapper, createTestQueryClient } from '../../test-utils/query-wrapper';
import { makeJwt, makeUser } from '../../test-utils/auth-fixtures';
import { changePasswordSchema } from './schemas';
import {
  profileKeys,
  useChangePasswordMutation,
  useProfileQuery,
  useUpdateProfileMutation,
} from './api';

const mockGetProfile = profileClient.getProfile as jest.Mock;
const mockUpdateProfile = profileClient.updateProfile as jest.Mock;
const mockChangePassword = profileClient.changePassword as jest.Mock;

beforeEach(() => {
  mockGetProfile.mockReset();
  mockUpdateProfile.mockReset();
  mockChangePassword.mockReset();
});

describe('useProfileQuery', () => {
  it('resolves to the wrapped {user} envelope without unwrapping', async () => {
    const user = makeUser({ email: 'rider@example.com' });
    mockGetProfile.mockResolvedValue({ user });

    const client = createTestQueryClient();
    const { result } = await renderHook(() => useProfileQuery(), {
      wrapper: createQueryWrapper(client),
    });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(result.current.data?.user.email).toBe('rider@example.com');
    expect((result.current.data as { email?: string })?.email).toBeUndefined();
  });

  it('uses the query key ["profile"]', () => {
    expect(profileKeys.detail()).toEqual(['profile']);
  });
});

describe('useUpdateProfileMutation', () => {
  it('calls profileClient.updateProfile with exactly {first_name, last_name}', async () => {
    mockUpdateProfile.mockResolvedValue({ user: makeUser() });

    const client = createTestQueryClient();
    const { result } = await renderHook(() => useUpdateProfileMutation(), {
      wrapper: createQueryWrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync({ first_name: 'Ada', last_name: 'Rider' });
    });

    const callArg = mockUpdateProfile.mock.calls[0][0];
    expect(Object.keys(callArg).sort()).toEqual(['first_name', 'last_name']);
  });

  it('writes the returned {user} envelope into the ["profile"] cache on success', async () => {
    const initialUser = makeUser();
    const updatedUser = makeUser({ first_name: 'Updated' });
    mockGetProfile.mockResolvedValue({ user: initialUser });
    mockUpdateProfile.mockResolvedValue({ user: updatedUser });

    const client = createTestQueryClient();
    // Keep an active query observer (mirrors real ProfileView usage) so the written
    // cache entry survives gcTime:0 — an unobserved entry is eligible for immediate GC.
    const { result } = await renderHook(
      () => ({ query: useProfileQuery(), mutation: useUpdateProfileMutation() }),
      { wrapper: createQueryWrapper(client) },
    );

    await waitFor(() => {
      expect(result.current.query.data).toEqual({ user: initialUser });
    });

    await act(async () => {
      await result.current.mutation.mutateAsync({ first_name: 'Updated', last_name: 'Rider' });
    });

    expect(client.getQueryData(profileKeys.detail())).toEqual({ user: updatedUser });
  });

  it('surfaces the error and leaves the ["profile"] cache entry unchanged on rejection', async () => {
    const seeded = { user: makeUser() };
    mockGetProfile.mockResolvedValue(seeded);
    mockUpdateProfile.mockRejectedValue(new Error('update failed'));

    const client = createTestQueryClient();
    // Keep an active query observer (mirrors real ProfileView usage) so the seeded
    // cache entry survives gcTime:0 — an unobserved entry is eligible for immediate GC.
    const { result } = await renderHook(
      () => ({ query: useProfileQuery(), mutation: useUpdateProfileMutation() }),
      { wrapper: createQueryWrapper(client) },
    );

    await waitFor(() => {
      expect(result.current.query.data).toEqual(seeded);
    });

    await act(async () => {
      await expect(
        result.current.mutation.mutateAsync({ first_name: 'Ada', last_name: 'Rider' }),
      ).rejects.toThrow('update failed');
    });

    expect(client.getQueryData(profileKeys.detail())).toEqual(seeded);
  });
});

describe('useChangePasswordMutation', () => {
  const seedAuthenticatedSession = () => {
    const token = makeJwt(Date.now() + 60 * 60 * 1000);
    useSessionStore.setState({
      status: 'authenticated',
      token,
      tokenExpiresAt: Date.now() + 60 * 60 * 1000,
      user: makeUser(),
      sessionExpiredReason: null,
    });
    return token;
  };

  it('calls profileClient.changePassword with exactly {old_password, new_password}', async () => {
    mockChangePassword.mockResolvedValue({ message: 'Password changed' });

    const client = createTestQueryClient();
    const { result } = await renderHook(() => useChangePasswordMutation(), {
      wrapper: createQueryWrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync({ old_password: 'oldpass1', new_password: 'newpass1' });
    });

    const callArg = mockChangePassword.mock.calls[0][0];
    expect(Object.keys(callArg).sort()).toEqual(['new_password', 'old_password']);
  });

  it('leaves the session store unchanged on success — no forced re-login', async () => {
    mockChangePassword.mockResolvedValue({ message: 'Password changed' });
    const token = seedAuthenticatedSession();

    const client = createTestQueryClient();
    const { result } = await renderHook(() => useChangePasswordMutation(), {
      wrapper: createQueryWrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync({ old_password: 'oldpass1', new_password: 'newpass1' });
    });

    expect(useSessionStore.getState().status).toBe('authenticated');
    expect(useSessionStore.getState().token).toBe(token);
  });

  it('resolves to the bare {message} — not wrapped in {user}', async () => {
    mockChangePassword.mockResolvedValue({ message: 'Password changed' });

    const client = createTestQueryClient();
    const { result } = await renderHook(() => useChangePasswordMutation(), {
      wrapper: createQueryWrapper(client),
    });

    let response: { message: string } | undefined;
    await act(async () => {
      response = await result.current.mutateAsync({
        old_password: 'oldpass1',
        new_password: 'newpass1',
      });
    });

    expect(response?.message).toBe('Password changed');
    expect((response as { user?: unknown })?.user).toBeUndefined();
  });

  it('surfaces an ApiError on rejection and leaves the session authenticated', async () => {
    seedAuthenticatedSession();
    mockChangePassword.mockRejectedValue(
      new ApiError(400, { code: 'invalid_password', message: 'Current password is incorrect' }),
    );

    const client = createTestQueryClient();
    const { result } = await renderHook(() => useChangePasswordMutation(), {
      wrapper: createQueryWrapper(client),
    });

    await act(async () => {
      await expect(
        result.current.mutateAsync({ old_password: 'wrongpass', new_password: 'newpass1' }),
      ).rejects.toThrow('Current password is incorrect');
    });

    expect(useSessionStore.getState().status).toBe('authenticated');
  });
});

describe('changePasswordSchema', () => {
  it('rejects an old_password shorter than 8 chars', () => {
    const result = changePasswordSchema.safeParse({ old_password: 'short', new_password: 'longenough1' });
    expect(result.success).toBe(false);
  });

  it('rejects a new_password shorter than 8 chars', () => {
    const result = changePasswordSchema.safeParse({ old_password: 'longenough1', new_password: 'short' });
    expect(result.success).toBe(false);
  });

  it('accepts two valid 8+ char passwords', () => {
    const result = changePasswordSchema.safeParse({
      old_password: 'longenough1',
      new_password: 'longenough2',
    });
    expect(result.success).toBe(true);
  });
});
