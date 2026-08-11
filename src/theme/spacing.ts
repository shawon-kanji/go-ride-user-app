// Thin pass-through of Tailwind's own spacing scale — only add overrides here if a
// project-specific value is actually needed; don't invent a parallel scale.
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;
