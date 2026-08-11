import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ActivityIndicator, View } from 'react-native';

import { Banner } from '../../../components/Banner';
import { Button } from '../../../components/Button';
import { TextInput } from '../../../components/TextInput';
import { ApiError } from '../../../api/http-client';
import { useProfileQuery, useUpdateProfileMutation } from '../api';
import { editProfileSchema, type EditProfileFormValues } from '../schemas';

export function EditProfileForm() {
  const { data, isLoading } = useProfileQuery();
  const { mutate, isPending } = useUpdateProfileMutation();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { control, handleSubmit } = useForm<EditProfileFormValues>({
    resolver: zodResolver(editProfileSchema),
    values: data
      ? { first_name: data.user.first_name, last_name: data.user.last_name }
      : undefined,
  });

  if (isLoading || !data) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator />
      </View>
    );
  }

  const onValid = (values: EditProfileFormValues) => {
    setErrorMessage(null);
    mutate(values, {
      onSuccess: () => router.back(),
      onError: (error) => {
        setErrorMessage(error instanceof ApiError ? error.message : 'Unable to save changes.');
      },
    });
  };

  const onInvalid = (errors: Record<string, { message?: string }>) => {
    const firstError = Object.values(errors)[0]?.message;
    setErrorMessage(firstError ?? 'Please check the form and try again.');
  };

  return (
    <View className="px-6 py-6">
      {errorMessage && (
        <Banner message={errorMessage} variant="error" onDismiss={() => setErrorMessage(null)} />
      )}

      <Controller
        control={control}
        name="first_name"
        render={({ field }) => (
          <TextInput
            label="First name"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
          />
        )}
      />

      <Controller
        control={control}
        name="last_name"
        render={({ field }) => (
          <TextInput
            label="Last name"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
          />
        )}
      />

      <Button label="Save" onPress={handleSubmit(onValid, onInvalid)} loading={isPending} />
    </View>
  );
}
