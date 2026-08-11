import { Pressable, View, type ViewProps } from 'react-native';

interface CardProps extends ViewProps {
  onPress?: () => void;
}

export function Card({ onPress, className = '', children, ...rest }: CardProps) {
  const classes = `rounded-lg border border-neutral-200 bg-white p-4 ${className}`;

  if (onPress) {
    return (
      <Pressable onPress={onPress} className={`${classes} active:bg-neutral-50`} {...rest}>
        {children}
      </Pressable>
    );
  }

  return (
    <View className={classes} {...rest}>
      {children}
    </View>
  );
}
