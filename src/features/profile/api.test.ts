jest.mock('../../api/profile-client', () => ({
  profileClient: { getProfile: jest.fn(), updateProfile: jest.fn() },
}));

import { act, renderHook, waitFor } from '@testing-library/react-native';

import { profileClient } from '../../api/profile-client';
import { createQueryWrapper, createTestQueryClient } from '../../test-utils/query-wrapper';
import { makeUser } from '../../test-utils/auth-fixtures';
import { profileKeys, useProfileQuery, useUpdateProfileMutation } from './api';

const mockGetProfile = profileClient.getProfile as jest.Mock;
const mockUpdateProfile = profileClient.updateProfile as jest.Mock;

beforeEach(() => {
  mockGetProfile.mockReset();
  mockUpdateProfile.mockReset();
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
    const updatedUser = makeUser({ first_name: 'Updated' });
    mockUpdateProfile.mockResolvedValue({ user: updatedUser });

    const client = createTestQueryClient();
    const { result } = await renderHook(() => useUpdateProfileMutation(), {
      wrapper: createQueryWrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync({ first_name: 'Updated', last_name: 'Rider' });
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
