import { useMutation } from '@tanstack/react-query';

import { authClient } from '../../api/auth-client';
import { useSessionStore } from '../../stores/session-store';
import type { LoginPayload, SignupPayload } from '../../api/types';

export function useLoginMutation() {
  return useMutation({
    mutationFn: (payload: LoginPayload) => authClient.login(payload),
    onSuccess: (result) => {
      const { access_token, user } = result;
      useSessionStore.getState().setSession(access_token, user);
    },
  });
}

/** Thrown when signup succeeded but the chained login call failed — the account
 * genuinely exists, so callers should route to Login rather than show a generic error. */
export class SignupSucceededLoginFailedError extends Error {
  email: string;
  constructor(email: string) {
    super('Account created — please log in.');
    this.email = email;
  }
}

export function useSignupMutation() {
  return useMutation({
    mutationFn: async (payload: SignupPayload) => {
      // SignupResponse has no access_token — chain an immediate login with the same
      // credentials to actually authenticate the rider (AUTH-01 success criterion).
      await authClient.signup(payload);
      try {
        return await authClient.login({ email: payload.email, password: payload.password });
      } catch {
        throw new SignupSucceededLoginFailedError(payload.email);
      }
    },
    onSuccess: (result) => {
      const { access_token, user } = result;
      useSessionStore.getState().setSession(access_token, user);
    },
  });
}
