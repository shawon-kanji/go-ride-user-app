// Hand-maintained mirrors of go-ride-backend's Go DTOs — no OpenAPI/codegen exists,
// see .planning/PROJECT.md. Keep in sync with application/user/dto.go and
// domain/user/entity.go in go-ride-backend when the backend contract changes.

// Riders have exactly TWO account statuses. This is NOT the driver app's
// three-value status union — go-ride-backend/domain/user/entity.go
// defines only AccountStatusActive and AccountStatusDeactivated for riders.
export type AccountStatus = 'active' | 'deactivated';

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  account_status: AccountStatus;
  // No email-verification flag — the rider entity has no such field. Do not add one.
}

export type UserSummary = Pick<User, 'id' | 'email' | 'first_name' | 'last_name'>;

export interface SignupPayload {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

/** POST /auth/login -> 200. `user` is NOT further nested under another wrapper. */
export interface LoginResult {
  access_token: string;
  user: User;
}

export interface UpdateProfilePayload {
  first_name: string;
  last_name: string;
}

export interface ChangePasswordPayload {
  old_password: string;
  new_password: string;
}

/** Flat {code, message} error body — go-ride-backend's pkg/apperror shape, no nested wrapper. */
export interface ApiErrorBody {
  code: string;
  message: string;
}
