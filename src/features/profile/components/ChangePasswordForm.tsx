import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';

import { ApiError } from '../../../api/http-client';
import { Banner } from '../../../components/Banner';
import { Button } from '../../../components/Button';
import { TextInput } from '../../../components/TextInput';
import { useChangePasswordMutation } from '../api';
import { changePasswordSchema, type ChangePasswordFormValues } from '../schemas';

export function ChangePasswordForm() {
  const { mutate, isPending } = useChangePasswordMutation();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [succeeded, setSucceeded] = useState(false);

  const { control, handleSubmit } = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { old_password: '', new_password: '' },
  });

  const onValid = (values: ChangePasswordFormValues) => {
    setErrorMessage(null);
    mutate(values, {
      onSuccess: () => setSucceeded(true),
      onError: (error: unknown) => {
        setErrorMessage(
          error instanceof ApiError ? error.message : 'Unable to change your password.',
        );
      },
    });
  };

  const onInvalid = (errors: Record<string, { message?: string }>) => {
    const firstError = Object.values(errors)[0]?.message;
    setErrorMessage(firstError ?? 'Please check the form and try again.');
  };

  // Success state replaces the form entirely rather than auto-navigating away,
  // so the rider sees the success message before returning to Profile — see
  // .planning/phases/01-foundation-auth/01-CONTEXT.md.
  if (succeeded) {
    return (
      <View className="px-6 py-6">
        <Banner message="Password changed" variant="success" />
        <Button label="Back to profile" variant="ghost" onPress={() => router.back()} />
      </View>
    );
  }

  return (
    <View className="px-6 py-6">
      {errorMessage && (
        <Banner message={errorMessage} variant="error" onDismiss={() => setErrorMessage(null)} />
      )}

      <Controller
        control={control}
        name="old_password"
        render={({ field }) => (
          <TextInput
            label="Current password"
            accessibilityLabel="Current password"
            secureTextEntry
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
          />
        )}
      />

      <Controller
        control={control}
        name="new_password"
        render={({ field }) => (
          <TextInput
            label="New password"
            accessibilityLabel="New password"
            secureTextEntry
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
          />
        )}
      />

      <Button
        label="Change password"
        onPress={handleSubmit(onValid, onInvalid)}
        loading={isPending}
      />
    </View>
  );
}
