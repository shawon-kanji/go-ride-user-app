import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { profileClient } from '../../api/profile-client';
import type { ChangePasswordPayload, UpdateProfilePayload } from '../../api/types';

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

/** POST /change-password returns a bare {message} with no session-invalidation
 *  semantics — deliberately does NOT clear the session or invalidate the profile
 *  query, per .planning/phases/01-foundation-auth/01-CONTEXT.md. */
export function useChangePasswordMutation() {
  return useMutation({
    mutationFn: (payload: ChangePasswordPayload) => profileClient.changePassword(payload),
  });
}
