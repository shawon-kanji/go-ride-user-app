import { loginSchema, signupSchema } from './schemas';

describe('signupSchema', () => {
  it('accepts a valid signup payload', () => {
    const result = signupSchema.safeParse({
      email: 'a@b.co',
      password: 'password1',
      first_name: 'Ada',
      last_name: 'Rider',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an invalid email', () => {
    const result = signupSchema.safeParse({
      email: 'not-an-email',
      password: 'password1',
      first_name: 'Ada',
      last_name: 'Rider',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Enter a valid email');
    }
  });

  it('rejects a password shorter than 8 characters', () => {
    const result = signupSchema.safeParse({
      email: 'a@b.co',
      password: 'short12',
      first_name: 'Ada',
      last_name: 'Rider',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Password must be at least 8 characters');
    }
  });

  it('rejects a first_name below the 2-character minimum', () => {
    const result = signupSchema.safeParse({
      email: 'a@b.co',
      password: 'password1',
      first_name: 'A',
      last_name: 'Rider',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a last_name above the 100-character maximum', () => {
    const result = signupSchema.safeParse({
      email: 'a@b.co',
      password: 'password1',
      first_name: 'Ada',
      last_name: 'A'.repeat(101),
    });
    expect(result.success).toBe(false);
  });

  it('trims surrounding whitespace on email, first_name, and last_name', () => {
    const result = signupSchema.safeParse({
      email: '  a@b.co  ',
      password: 'password1',
      first_name: '  Ada  ',
      last_name: '  Rider  ',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe('a@b.co');
      expect(result.data.first_name).toBe('Ada');
      expect(result.data.last_name).toBe('Rider');
    }
  });
});

describe('loginSchema', () => {
  it('accepts a valid login payload', () => {
    const result = loginSchema.safeParse({ email: 'a@b.co', password: 'password1' });
    expect(result.success).toBe(true);
  });

  it('rejects a password shorter than 8 characters', () => {
    const result = loginSchema.safeParse({ email: 'a@b.co', password: 'short12' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Password must be at least 8 characters');
    }
  });
});
