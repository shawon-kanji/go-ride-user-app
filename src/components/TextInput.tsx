import { Text, TextInput as RNTextInput, View, type TextInputProps } from 'react-native';

interface Props extends TextInputProps {
  label: string;
}

export function TextInput({ label, ...inputProps }: Props) {
  return (
    <View className="mb-4">
      <Text className="mb-1 text-sm font-medium text-neutral-700">{label}</Text>
      <RNTextInput
        className="rounded-md border border-neutral-300 px-3 py-3 text-base text-neutral-900"
        placeholderTextColor="#9CA3AF"
        autoCapitalize="none"
        autoCorrect={false}
        {...inputProps}
      />
    </View>
  );
}
