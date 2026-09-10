import { Stack } from 'expo-router';
import { AppColors } from '@/constants/AppColors';

export default function HomeLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: AppColors.background } }}>
      <Stack.Screen name="index" />
    </Stack>
  );
}
