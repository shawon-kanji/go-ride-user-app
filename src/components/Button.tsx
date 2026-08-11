import { ActivityIndicator, Pressable, Text } from 'react-native';

type Variant = 'primary' | 'secondary' | 'destructive' | 'ghost';

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: 'bg-primary-500 active:bg-primary-600',
  secondary: 'bg-secondary-500 active:bg-secondary-600',
  destructive: 'bg-danger-500 active:bg-danger-600',
  ghost: 'bg-transparent border border-neutral-300 active:bg-neutral-100',
};

const VARIANT_TEXT_CLASSES: Record<Variant, string> = {
  primary: 'text-white',
  secondary: 'text-white',
  destructive: 'text-white',
  ghost: 'text-neutral-800',
};

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      className={`flex-row items-center justify-center rounded-md px-4 py-3 ${VARIANT_CLASSES[variant]} ${isDisabled ? 'opacity-50' : ''}`}
    >
      {loading && (
        <ActivityIndicator
          size="small"
          color={variant === 'ghost' ? '#1F2937' : '#FFFFFF'}
          className="mr-2"
        />
      )}
      <Text className={`text-base font-semibold ${VARIANT_TEXT_CLASSES[variant]}`}>{label}</Text>
    </Pressable>
  );
}
