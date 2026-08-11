import { Link, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { Banner } from '../../components/Banner';
import { LoginForm } from '../../features/auth/components/LoginForm';
import { useSessionStore } from '../../stores/session-store';

export default function LoginScreen() {
  const { email } = useLocalSearchParams<{ email?: string }>();

  // One-time read-and-clear of the session store's expiry reason at mount —
  // a lazy initializer (not an effect) so it runs exactly once per screen instance.
  const [infoMessage, setInfoMessage] = useState<string | null>(() => {
    const reason = useSessionStore.getState().consumeSessionExpiredReason();
    if (reason) return reason;
    if (email) return 'Account created — please log in.';
    return null;
  });

  return (
    <ScrollView className="flex-1 bg-white" contentContainerClassName="flex-grow justify-center px-6 py-12">
      <Text className="mb-8 text-2xl font-bold text-neutral-900">Log in</Text>

      {infoMessage && (
        <Banner message={infoMessage} variant="info" onDismiss={() => setInfoMessage(null)} />
      )}

      <LoginForm initialEmail={email} />

      <View className="mt-6 flex-row justify-center">
        <Text className="text-sm text-neutral-600">{"Don't have an account? "}</Text>
        <Link href="/(auth)/signup" className="text-sm font-semibold text-primary-600">
          Sign up
        </Link>
      </View>
    </ScrollView>
  );
}
