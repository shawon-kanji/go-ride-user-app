// Placeholder palette — final "bold/vibrant" brand identity is a separate UI-spec pass.
// Single hand-maintained source of truth: consumed by tailwind.config.js directly,
// and re-exported via ./tokens.ts for RN APIs that can't read a className.
module.exports = {
  primary: { 50: '#EEF2FF', 500: '#4F46E5', 600: '#4338CA', 700: '#3730A3' },
  secondary: { 50: '#F0FDFA', 500: '#0D9488', 600: '#0F766E', 700: '#115E59' },
  success: { 50: '#F0FDF4', 500: '#16A34A', 600: '#15803D', 700: '#166534' },
  warning: { 50: '#FFFBEB', 500: '#D97706', 600: '#B45309', 700: '#92400E' },
  danger: { 50: '#FEF2F2', 500: '#DC2626', 600: '#B91C1C', 700: '#991B1B' },
  neutral: {
    0: '#FFFFFF',
    50: '#F9FAFB',
    100: '#F3F4F6',
    200: '#E5E7EB',
    300: '#D1D5DB',
    400: '#9CA3AF',
    500: '#6B7280',
    600: '#4B5563',
    700: '#374151',
    800: '#1F2937',
    900: '#111827',
  },
};
