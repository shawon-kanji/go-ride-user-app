import { useSessionStore } from '../stores/session-store';
import type { ApiErrorBody } from './types';

const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

export class ApiError extends Error {
  code: string;
  status: number;

  constructor(status: number, body: ApiErrorBody) {
    super(body.message);
    this.code = body.code;
    this.status = status;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Skip Authorization header — signup/login only. */
  skipAuth?: boolean;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, skipAuth = false } = options;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (!skipAuth) {
    const token = useSessionStore.getState().token;
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const json = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorBody: ApiErrorBody = {
      code: json.code ?? 'UNKNOWN_ERROR',
      message: json.message ?? 'Something went wrong. Please try again.',
    };

    // Centralized 401 handling: if we believed we had a session, the token is
    // dead (no refresh endpoint exists) — clear it so the auth guard redirects,
    // rather than leaving screens to each handle this individually.
    if (response.status === 401 && !skipAuth) {
      useSessionStore.getState().clearSession('Your session ended. Please log in again.');
    }

    throw new ApiError(response.status, errorBody);
  }

  return json as T;
}
