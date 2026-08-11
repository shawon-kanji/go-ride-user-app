import { router } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';

import { Button } from '../../../components/Button';
import { useProfileQuery } from '../api';
import { useLogout } from '../logout';
import { AccountStatusBadge } from './AccountStatusBadge';

export function ProfileView() {
  const { data, isLoading } = useProfileQuery();
  const logout = useLogout();

  if (isLoading || !data) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator />
      </View>
    );
  }

  const { user } = data;

  return (
    <View className="flex-1 px-6 py-6">
      <View className="mb-6">
        <Text className="text-2xl font-bold text-neutral-900">
          {user.first_name} {user.last_name}
        </Text>
        <Text className="mt-1 text-sm text-neutral-500">{user.email}</Text>
        <View className="mt-3">
          <AccountStatusBadge status={user.account_status} />
        </View>
      </View>

      <View className="gap-3">
        <Button
          label="Edit profile"
          variant="ghost"
          onPress={() => router.push('/(app)/(tabs)/profile/edit')}
        />
        <Button
          label="Change password"
          variant="ghost"
          onPress={() => router.push('/(app)/(tabs)/profile/change-password')}
        />
        <Button label="Log out" variant="destructive" onPress={logout} />
      </View>
    </View>
  );
}
