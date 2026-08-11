import { Text, View } from 'react-native';

// Covers both vehicle active/inactive and driver account_status (pending/active/blocked).
// Factual/neutral styling for "pending" — this is a status label, not a warning.
type Variant = 'active' | 'inactive' | 'pending' | 'blocked';

const VARIANT_CLASSES: Record<Variant, string> = {
  active: 'bg-success-50',
  inactive: 'bg-neutral-100',
  pending: 'bg-neutral-100',
  blocked: 'bg-danger-50',
};

const VARIANT_TEXT_CLASSES: Record<Variant, string> = {
  active: 'text-success-700',
  inactive: 'text-neutral-600',
  pending: 'text-neutral-600',
  blocked: 'text-danger-700',
};

interface BadgeProps {
  label: string;
  variant: Variant;
}

export function Badge({ label, variant }: BadgeProps) {
  return (
    <View className={`self-start rounded-full px-2.5 py-1 ${VARIANT_CLASSES[variant]}`}>
      <Text className={`text-xs font-medium ${VARIANT_TEXT_CLASSES[variant]}`}>{label}</Text>
    </View>
  );
}
