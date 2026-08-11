import { Text, View } from 'react-native';

import { Button } from './Button';

interface EmptyStateProps {
  title: string;
  message: string;
  ctaLabel?: string;
  onPressCta?: () => void;
}

export function EmptyState({ title, message, ctaLabel, onPressCta }: EmptyStateProps) {
  return (
    <View className="flex-1 items-center justify-center px-8 py-16">
      <Text className="mb-2 text-lg font-semibold text-neutral-900">{title}</Text>
      <Text className="mb-6 text-center text-sm text-neutral-600">{message}</Text>
      {ctaLabel && onPressCta && (
        <View className="w-full max-w-xs">
          <Button label={ctaLabel} onPress={onPressCta} />
        </View>
      )}
    </View>
  );
}
