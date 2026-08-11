import { Stack } from 'expo-router';

import { SessionExpiryBanner } from '../../features/auth/components/SessionExpiryBanner';

export default function AppLayout() {
  return (
    <>
      <SessionExpiryBanner />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
    </>
  );
}
