import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';

import { Banner } from '../../../components/Banner';
import { Button } from '../../../components/Button';
import { TextInput } from '../../../components/TextInput';
import { ApiError } from '../../../api/http-client';
import { useLoginMutation } from '../api';
import { loginSchema, type LoginFormValues } from '../schemas';

interface LoginFormProps {
  initialEmail?: string;
}

export function LoginForm({ initialEmail }: LoginFormProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { mutate, isPending } = useLoginMutation();

  const { control, handleSubmit } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: initialEmail ?? '', password: '' },
  });

  const onValid = (values: LoginFormValues) => {
    setErrorMessage(null);
    mutate(values, {
      onError: (error) => {
        setErrorMessage(error instanceof ApiError ? error.message : 'Unable to log in.');
      },
    });
  };

  // Validation errors surface as a single banner on submit, not inline per-field.
  const onInvalid = (errors: Record<string, { message?: string }>) => {
    const firstError = Object.values(errors)[0]?.message;
    setErrorMessage(firstError ?? 'Please check the form and try again.');
  };

  return (
    <View>
      {errorMessage && (
        <Banner message={errorMessage} variant="error" onDismiss={() => setErrorMessage(null)} />
      )}

      <Controller
        control={control}
        name="email"
        render={({ field }) => (
          <TextInput
            label="Email"
            keyboardType="email-address"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
          />
        )}
      />

      <Controller
        control={control}
        name="password"
        render={({ field }) => (
          <TextInput
            label="Password"
            secureTextEntry
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
          />
        )}
      />

      <Button label="Log in" onPress={handleSubmit(onValid, onInvalid)} loading={isPending} />
    </View>
  );
}
