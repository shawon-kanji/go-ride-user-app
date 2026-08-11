import { z } from 'zod';

// Mirrors go-ride-backend's application/user/dto.go validate tags exactly —
// don't invent stricter client-side rules than the backend actually enforces.
export const signupSchema = z.object({
  email: z.string().trim().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  first_name: z.string().trim().min(2).max(100),
  last_name: z.string().trim().min(2).max(100),
});
export type SignupFormValues = z.infer<typeof signupSchema>;

// LoginRequest also enforces password min=8 server-side — mirror it so a short
// password fails client-side instead of round-tripping to the API for nothing.
export const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});
export type LoginFormValues = z.infer<typeof loginSchema>;
