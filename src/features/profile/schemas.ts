import { z } from 'zod';

// Only first_name/last_name are editable — mirrors PATCH /api/v1/profile exactly.
// Email has no editable path anywhere in the rider backend.
export const editProfileSchema = z.object({
  first_name: z.string().trim().min(2).max(100),
  last_name: z.string().trim().min(2).max(100),
});
export type EditProfileFormValues = z.infer<typeof editProfileSchema>;
