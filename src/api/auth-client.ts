import { apiRequest } from './http-client';
import type { LoginPayload, LoginResult, SignupPayload, User } from './types';

export const authClient = {
  // 201 {user} — no token. Callers must chain into login() to authenticate.
  signup: (payload: SignupPayload) =>
    apiRequest<{ user: User }>('/auth/signup', { method: 'POST', body: payload, skipAuth: true }),

  login: (payload: LoginPayload) =>
    apiRequest<LoginResult>('/auth/login', { method: 'POST', body: payload, skipAuth: true }),
};
