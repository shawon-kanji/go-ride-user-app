import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';

import { useSessionStore } from '../../stores/session-store';

export function useLogout() {
  const queryClient = useQueryClient();

  return async () => {
    await useSessionStore.getState().clearSession();
    queryClient.clear();
    router.replace('/(auth)/login');
  };
}
