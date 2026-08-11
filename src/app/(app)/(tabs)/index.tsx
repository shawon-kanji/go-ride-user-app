import { Text, View } from 'react-native';

import { Card } from '../../../components/Card';

export default function HomeScreen() {
  return (
    <View className="flex-1 px-6 py-6">
      <Text className="mb-1 text-2xl font-bold text-neutral-900">Welcome</Text>
      <Text className="mb-6 text-sm text-neutral-600">
        Your account is ready. Ride booking arrives in the next release.
      </Text>

      <Card>
        <Text className="text-base font-semibold text-neutral-900">Booking a ride is coming soon</Text>
        <Text className="mt-1 text-sm text-neutral-600">
          You&apos;ll be able to get a fare estimate and book a cab from here.
        </Text>
      </Card>
    </View>
  );
}
