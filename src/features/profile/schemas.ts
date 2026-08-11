import { z } from 'zod';

// Only first_name/last_name are editable — mirrors PATCH /api/v1/profile exactly.
// Email has no editable path anywhere in the rider backend.
export const editProfileSchema = z.object({
  first_name: z.string().trim().min(2).max(100),
  last_name: z.string().trim().min(2).max(100),
});
export type EditProfileFormValues = z.infer<typeof editProfileSchema>;

// Mirrors go-ride-backend's ChangePasswordRequest validate tags exactly:
// old_password required min=8, new_password required min=8. No "confirm password"
// field — the backend has none, and this phase does not invent stricter client rules.
export const changePasswordSchema = z.object({
  old_password: z.string().min(8, 'Password must be at least 8 characters'),
  new_password: z.string().min(8, 'New password must be at least 8 characters'),
});
export type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;
