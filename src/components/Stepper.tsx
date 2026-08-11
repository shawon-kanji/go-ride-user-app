import { Pressable, Text, View } from 'react-native';

interface StepperProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}

export function Stepper({ label, value, min, max, onChange }: StepperProps) {
  const decrement = () => onChange(Math.max(min, value - 1));
  const increment = () => onChange(Math.min(max, value + 1));

  return (
    <View className="mb-4">
      <Text className="mb-1 text-sm font-medium text-neutral-700">{label}</Text>
      <View className="flex-row items-center justify-between rounded-md border border-neutral-300 px-3 py-2">
        <Pressable
          onPress={decrement}
          disabled={value <= min}
          hitSlop={8}
          className={`h-8 w-8 items-center justify-center rounded-full bg-neutral-100 ${value <= min ? 'opacity-40' : ''}`}
        >
          <Text className="text-lg font-semibold text-neutral-800">−</Text>
        </Pressable>
        <Text className="text-base font-semibold text-neutral-900">{value}</Text>
        <Pressable
          onPress={increment}
          disabled={value >= max}
          hitSlop={8}
          className={`h-8 w-8 items-center justify-center rounded-full bg-neutral-100 ${value >= max ? 'opacity-40' : ''}`}
        >
          <Text className="text-lg font-semibold text-neutral-800">+</Text>
        </Pressable>
      </View>
    </View>
  );
}
