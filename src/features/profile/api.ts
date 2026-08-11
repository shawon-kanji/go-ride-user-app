import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { profileClient } from '../../api/profile-client';
import type { UpdateProfilePayload } from '../../api/types';

export const profileKeys = {
  detail: () => ['profile'] as const,
};

export function useProfileQuery() {
  return useQuery({
    queryKey: profileKeys.detail(),
    queryFn: profileClient.getProfile,
  });
}

export function useUpdateProfileMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateProfilePayload) => profileClient.updateProfile(payload),
    onSuccess: (result) => {
      queryClient.setQueryData(profileKeys.detail(), result);
    },
  });
}
