import { Link, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Text } from 'react-native';

import { PdfExtractionHost } from '@/extraction/extraction-host';
import { useAppColors } from '@/ui/app-theme';

export default function RootLayout() {
  const colors = useAppColors();
  return (
    <>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen
          name="index"
          options={{
            title: 'Library',
            headerRight: () => (
              <Link href="/vocabulary" style={{ padding: 8 }}>
                <Text style={{ fontSize: 20 }}>📚</Text>
              </Link>
            ),
          }}
        />
        <Stack.Screen name="vocabulary" options={{ title: 'Vocabulary Book' }} />
        <Stack.Screen name="review" options={{ title: 'Review' }} />
      </Stack>
      <PdfExtractionHost />
      <StatusBar style="auto" />
    </>
  );
}
