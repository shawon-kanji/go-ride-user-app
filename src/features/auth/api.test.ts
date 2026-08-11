jest.mock('../../api/auth-client', () => ({
  authClient: { signup: jest.fn(), login: jest.fn() },
}));

import { act, renderHook } from '@testing-library/react-native';

import { authClient } from '../../api/auth-client';
import { useSessionStore } from '../../stores/session-store';
import { createQueryWrapper, createTestQueryClient } from '../../test-utils/query-wrapper';
import { makeLoginResult, makeUser } from '../../test-utils/auth-fixtures';
import { SignupSucceededLoginFailedError, useLoginMutation, useSignupMutation } from './api';

const mockLogin = authClient.login as jest.Mock;
const mockSignup = authClient.signup as jest.Mock;

beforeEach(() => {
  mockLogin.mockReset();
  mockSignup.mockReset();
  useSessionStore.setState({
    status: 'unknown',
    token: null,
    tokenExpiresAt: null,
    user: null,
    sessionExpiredReason: null,
  });
});

describe('useLoginMutation', () => {
  it('authenticates the session store on success', async () => {
    const loginResult = makeLoginResult();
    mockLogin.mockResolvedValue(loginResult);

    const client = createTestQueryClient();
    const { result } = await renderHook(() => useLoginMutation(), {
      wrapper: createQueryWrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync({ email: loginResult.user.email, password: 'password1' });
    });

    expect(useSessionStore.getState().status).toBe('authenticated');
    expect(useSessionStore.getState().token).toBe(loginResult.access_token);
    expect(useSessionStore.getState().user).toEqual(loginResult.user);
  });

  it('does not authenticate on a rejected login and surfaces the error', async () => {
    mockLogin.mockRejectedValue(new Error('invalid credentials'));

    const client = createTestQueryClient();
    const { result } = await renderHook(() => useLoginMutation(), {
      wrapper: createQueryWrapper(client),
    });

    await act(async () => {
      await expect(
        result.current.mutateAsync({ email: 'a@b.co', password: 'password1' }),
      ).rejects.toThrow('invalid credentials');
    });

    expect(useSessionStore.getState().status).not.toBe('authenticated');
  });
});

describe('useSignupMutation', () => {
  it('calls signup then login, in that order', async () => {
    const calls: string[] = [];
    const user = makeUser();
    mockSignup.mockImplementation(async () => {
      calls.push('signup');
      return { user };
    });
    mockLogin.mockImplementation(async () => {
      calls.push('login');
      return makeLoginResult({ user });
    });

    const client = createTestQueryClient();
    const { result } = await renderHook(() => useSignupMutation(), {
      wrapper: createQueryWrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync({
        email: user.email,
        password: 'password1',
        first_name: user.first_name,
        last_name: user.last_name,
      });
    });

    expect(calls).toEqual(['signup', 'login']);
    expect(mockLogin).toHaveBeenCalledWith({ email: user.email, password: 'password1' });
  });

  it('authenticates the session store on full success', async () => {
    const user = makeUser();
    mockSignup.mockResolvedValue({ user });
    const loginResult = makeLoginResult({ user });
    mockLogin.mockResolvedValue(loginResult);

    const client = createTestQueryClient();
    const { result } = await renderHook(() => useSignupMutation(), {
      wrapper: createQueryWrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync({
        email: user.email,
        password: 'password1',
        first_name: user.first_name,
        last_name: user.last_name,
      });
    });

    expect(useSessionStore.getState().status).toBe('authenticated');
  });

  it('throws SignupSucceededLoginFailedError when signup succeeds but login fails, and does not authenticate', async () => {
    const user = makeUser();
    mockSignup.mockResolvedValue({ user });
    mockLogin.mockRejectedValue(new Error('login failed'));

    const client = createTestQueryClient();
    const { result } = await renderHook(() => useSignupMutation(), {
      wrapper: createQueryWrapper(client),
    });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          email: user.email,
          password: 'password1',
          first_name: user.first_name,
          last_name: user.last_name,
        }),
      ).rejects.toThrow(SignupSucceededLoginFailedError);
    });

    expect(result.current.error).toBeInstanceOf(SignupSucceededLoginFailedError);
    expect((result.current.error as SignupSucceededLoginFailedError).email).toBe(user.email);
    expect(useSessionStore.getState().status).not.toBe('authenticated');
  });

  it('propagates the original error when signup itself rejects, and never calls login', async () => {
    mockSignup.mockRejectedValue(new Error('email already taken'));

    const client = createTestQueryClient();
    const { result } = await renderHook(() => useSignupMutation(), {
      wrapper: createQueryWrapper(client),
    });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          email: 'a@b.co',
          password: 'password1',
          first_name: 'Ada',
          last_name: 'Rider',
        }),
      ).rejects.toThrow('email already taken');
    });

    expect(mockLogin).not.toHaveBeenCalled();
  });
});
