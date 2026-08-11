import { apiRequest } from './http-client';
import type { ChangePasswordPayload, UpdateProfilePayload, User } from './types';

export const profileClient = {
  // GET /me and PATCH /profile both wrap as {"user": {...}} — keep the envelope in
  // the return type and unwrap at the query-result/component boundary, not here.
  getProfile: () => apiRequest<{ user: User }>('/me'),

  updateProfile: (payload: UpdateProfilePayload) =>
    apiRequest<{ user: User }>('/profile', { method: 'PATCH', body: payload }),

  // NOT wrapped — ChangePasswordResponse is a bare {message}.
  changePassword: (payload: ChangePasswordPayload) =>
    apiRequest<{ message: string }>('/change-password', { method: 'POST', body: payload }),
};
