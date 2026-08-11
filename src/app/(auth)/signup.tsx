import { Link } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';

import { SignupForm } from '../../features/auth/components/SignupForm';

export default function SignupScreen() {
  return (
    <ScrollView className="flex-1 bg-white" contentContainerClassName="flex-grow justify-center px-6 py-12">
      <Text className="mb-8 text-2xl font-bold text-neutral-900">Create your account</Text>

      <SignupForm />

      <View className="mt-6 flex-row justify-center">
        <Text className="text-sm text-neutral-600">Already have an account? </Text>
        <Link href="/(auth)/login" className="text-sm font-semibold text-primary-600">
          Log in
        </Link>
      </View>
    </ScrollView>
  );
}
