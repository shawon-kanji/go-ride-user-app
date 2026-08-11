import '../global.css';

import { QueryClientProvider } from '@tanstack/react-query';
import * as SplashScreen from 'expo-splash-screen';
import { Stack } from 'expo-router';
import { useEffect } from 'react';

import { queryClient } from '../api/query-client';
import { useSessionStore } from '../stores/session-store';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const status = useSessionStore((s) => s.status);

  useEffect(() => {
    useSessionStore.getState().hydrate();
  }, []);

  useEffect(() => {
    if (status !== 'unknown') {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [status]);

  if (status === 'unknown') return null;

  return (
    <QueryClientProvider client={queryClient}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={status === 'unauthenticated'}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
        <Stack.Protected guard={status === 'authenticated'}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
      </Stack>
    </QueryClientProvider>
  );
}
